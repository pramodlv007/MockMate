"""Score one judge on the frozen eval set.

  python -m rubric_eval.run --eval data/eval.jsonl [--human2 data/human2.jsonl]
         [--expect-sha256 HASH] [--field transcript] [--out results.json]

Eval rows (JSONL): {"id", "question_id", "transcript", "labels": {point_id: bool}}.
--human2 rows: {"id", "labels": {...}} from the second labeler (human ceiling, ~50 answers).
--field picks the transcript key, e.g. "transcript_corrected" for the ASR-sensitivity run.
The judge is chosen by JUDGE_BASE_URL / JUDGE_MODEL / JUDGE_API_KEY (see services/rubric/grader.py).
"""
import argparse, hashlib, json, sys
from pathlib import Path
from services.rubric.grader import BANK, grade
from .metrics import kappa, f1, bootstrap_ci, percentile


def _rows(path):
    return [json.loads(l) for l in Path(path).read_text(encoding="utf-8").splitlines() if l.strip()]


def _flat(labels, q):
    return [bool(labels[p["id"]]) for p in q["points"]]


def agreement(answers):
    return {
        "n_answers": len(answers),
        "kappa": kappa([x for t, _ in answers for x in t], [x for _, p in answers for x in p]),
        "kappa_ci95": bootstrap_ci(kappa, answers),
        "f1": f1([x for t, _ in answers for x in t], [x for _, p in answers for x in p]),
        "f1_ci95": bootstrap_ci(f1, answers),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--eval", required=True)
    ap.add_argument("--human2")
    ap.add_argument("--expect-sha256")
    ap.add_argument("--field", default="transcript")
    ap.add_argument("--out")
    a = ap.parse_args()

    sha = hashlib.sha256(Path(a.eval).read_bytes()).hexdigest()
    if a.expect_sha256 and sha != a.expect_sha256:
        sys.exit(f"eval set changed (sha256 {sha} != {a.expect_sha256}); comparison invalid")
    rows = _rows(a.eval)

    answers, by_type, latencies, evidence = [], {}, [], []
    failed = first_pass = tok_in = tok_out = 0
    for r in rows:
        q = BANK[r["question_id"]]
        truth = _flat(r["labels"], q)
        try:
            g = grade(r["question_id"], r[a.field])
            got = {p["point_id"]: p["covered"] for p in g["points"]}
            pred = [got[p["id"]] for p in q["points"]]
            first_pass += g["retries"] == 0
            latencies.append(g["grade_ms"])
            tok_in += g["tokens_in"]
            tok_out += g["tokens_out"]
            evidence += [p["evidence_valid"] for p in g["points"] if p["evidence_span"]]
        except ValueError:  # invalid output after the retry: score as nothing covered
            failed += 1
            pred = [False] * len(truth)
        answers.append((truth, pred))
        by_type.setdefault(q["type"], []).append((truth, pred))

    out = {
        "eval_sha256": sha,
        "judge": {"n_failed_after_retry": failed, "schema_first_pass_rate": first_pass / len(rows),
                  "evidence_validity": sum(evidence) / len(evidence) if evidence else None,
                  "latency_ms_p50": percentile(latencies, 0.5) if latencies else None,
                  "latency_ms_p95": percentile(latencies, 0.95) if latencies else None,
                  "tokens_in": tok_in, "tokens_out": tok_out},
        "agreement_vs_human": agreement(answers),
        "agreement_by_type": {t: agreement(v) for t, v in by_type.items()},
    }
    if a.human2:
        h2 = {r["id"]: r["labels"] for r in _rows(a.human2)}
        pairs = [(_flat(r["labels"], BANK[r["question_id"]]), _flat(h2[r["id"]], BANK[r["question_id"]]))
                 for r in rows if r["id"] in h2]
        out["human_ceiling"] = agreement(pairs)
    text = json.dumps(out, indent=2)
    print(text)
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
