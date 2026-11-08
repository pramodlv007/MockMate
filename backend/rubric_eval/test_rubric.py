"""Run from backend/:  python -m pytest rubric_eval"""
import json, math
import pytest
from services.rubric.grader import BANK, grade, evidence_valid
from rubric_eval.metrics import kappa, f1, bootstrap_ci

TRANSCRIPT = "At my last job we had three weeks to ship invoice export. I wrote the export job myself."


def _reply(spans):
    pts = [{"point_id": p["id"], "covered": p["id"] in spans, "evidence_span": spans.get(p["id"]),
            "feedback": "ok"} for p in BANK["b1"]["points"]]
    return json.dumps({"points": pts})


def test_kappa_and_f1():
    assert kappa([1, 0, 1, 0], [1, 0, 1, 0]) == 1.0
    assert kappa([1, 0, 1, 0], [0, 1, 0, 1]) == -1.0
    assert math.isnan(kappa([1, 1], [1, 1]))
    assert f1([1, 1, 0, 0], [1, 0, 1, 0]) == 0.5
    lo, hi = bootstrap_ci(f1, [([1, 0], [1, 0]), ([1, 1], [1, 0]), ([0, 1], [0, 1])] * 10)
    assert lo <= hi


def test_evidence_must_be_verbatim():
    assert evidence_valid("three weeks to ship", TRANSCRIPT)
    assert evidence_valid("THREE  weeks to ship", TRANSCRIPT)  # case/whitespace tolerant
    assert not evidence_valid("two weeks to ship", TRANSCRIPT)
    assert not evidence_valid(None, TRANSCRIPT)


def test_grade_flags_invented_evidence():
    out = grade("b1", TRANSCRIPT, call=lambda _: (_reply({"situation": "three weeks to ship", "result": "made up quote"}), 5, 7))
    by = {p["point_id"]: p for p in out["points"]}
    assert by["situation"]["evidence_valid"] and not by["result"]["evidence_valid"]
    assert out["retries"] == 0 and out["tokens_in"] == 5


def test_grade_retries_once_then_fails():
    replies = iter([("not json", 1, 1), (_reply({}), 1, 1)])
    assert grade("b1", TRANSCRIPT, call=lambda _: next(replies))["retries"] == 1
    with pytest.raises(ValueError):
        grade("b1", TRANSCRIPT, call=lambda _: ('{"points": []}', 1, 1))
