"""Routing order Modal -> Gemini, fallback reasons, readiness wait and the daily GPU budget."""
import httpx
import pytest

from services.evaluation import llm_router as router
from services.evaluation import main as eval_main


class _Resp:
    def __init__(self, status, payload=None):
        self.status_code, self._p = status, payload or {}

    def json(self):
        return self._p


def _ok(text):
    return _Resp(200, {"choices": [{"message": {"content": text}}]})


class _Gemini:
    def __init__(self):
        self.calls = 0

    def generate_content(self, prompt, generation_config=None):
        self.calls += 1
        return type("R", (), {"text": '{"from": "gemini"}'})()


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(router, "MODAL_LLM_URL", "https://modal.example")
    monkeypatch.setattr(router, "INFERENCE_TOKEN", "t")
    monkeypatch.setattr(router, "READY_WAIT_S", 0)
    monkeypatch.setattr(router, "_redis", None)
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setattr(router, "_local_usage", {})
    monkeypatch.setattr(router.time, "sleep", lambda s: None)
    gem = _Gemini()
    monkeypatch.setattr(eval_main, "gemini_model", gem)
    state = {"healthy": True, "post": lambda: _ok('{"from": "modal"}'), "posts": 0}

    def fake_get(url, timeout):
        return _Resp(200 if state["healthy"] else 503)

    def fake_post(url, json, timeout, headers):
        assert headers["Authorization"] == "Bearer t"
        state["posts"] += 1
        return state["post"]()

    monkeypatch.setattr(router.httpx, "get", fake_get)
    monkeypatch.setattr(router.httpx, "post", fake_post)
    return state, gem


def test_modal_first_and_logged(setup):
    state, gem = setup
    router.begin()
    assert eval_main._llm("p", json_mode=True, op="question_eval") == '{"from": "modal"}'
    meta = router.finish()
    assert gem.calls == 0 and meta["providers"] == {"modal": 1} and meta["modal_was_cold"] is False
    assert meta["calls"][0]["op"] == "question_eval" and meta["gpu_seconds_est"] >= router.IDLE_S


def test_modal_error_falls_back_to_gemini_with_reason(setup):
    state, gem = setup
    state["post"] = lambda: _Resp(400)  # e.g. prompt longer than the 8K context
    router.begin()
    assert eval_main._llm("p", op="synthesis") == '{"from": "gemini"}'
    meta = router.finish()
    assert meta["providers"] == {"gemini": 1}
    assert meta["calls"][0]["fallback_reason"] == "modal_http_400"


def test_cold_modal_not_ready_in_time_uses_gemini_and_charges_boot(setup):
    state, gem = setup
    state["healthy"] = False
    router.begin()
    assert eval_main._llm("p", op="segment") == '{"from": "gemini"}'
    meta = router.finish()
    assert state["posts"] == 0 and meta["modal_was_cold"] is True
    assert meta["calls"][0]["fallback_reason"] == "not_ready"
    # we woke a container we never used: it still boots and idles, so the budget is charged for it
    assert meta["gpu_seconds_est"] == router.EST_BOOT_S + router.IDLE_S


def test_budget_spent_skips_modal_entirely(setup, monkeypatch):
    state, gem = setup
    monkeypatch.setattr(router, "DAILY_GPU_SECONDS", 100)
    router._add_gpu_seconds(100)
    router.begin()
    assert eval_main._llm("p") == '{"from": "gemini"}'
    meta = router.finish()
    assert state["posts"] == 0 and meta["calls"][0]["fallback_reason"] == "budget"
    assert meta["modal_was_cold"] is None  # never pinged, so never woken


def test_disabled_without_url_is_plain_gemini(setup, monkeypatch):
    state, gem = setup
    monkeypatch.setattr(router, "MODAL_LLM_URL", "")
    router.begin()
    assert eval_main._llm("p") == '{"from": "gemini"}'
    meta = router.finish()
    assert state["posts"] == 0 and meta["gpu_seconds_est"] == 0
    assert "fallback_reason" not in meta["calls"][0] or meta["calls"][0]["fallback_reason"] == "disabled"


def test_budget_accumulates_per_day(setup):
    router._add_gpu_seconds(30)
    router._add_gpu_seconds(12.5)
    assert router.gpu_seconds_today() == pytest.approx(42.5)
