import asyncio
from services.evaluation import main as eval_main


def test_pipeline_crash_marks_session_error(monkeypatch):
    patched = []
    async def boom(req): raise RuntimeError("gemini down")
    async def fake_patch(iid, body): patched.append((iid, body))
    monkeypatch.setattr(eval_main, "_evaluate", boom)
    monkeypatch.setattr(eval_main, "_patch_interview", fake_patch)

    req = eval_main.EvaluateRequest(interview_id="abc", video_path="x.webm", company="Acme", job_description="jd")
    asyncio.run(eval_main._run_evaluation(req))

    assert patched == [("abc", {"status": "error"})]


def test_empty_server_transcript_falls_back_to_browser_transcripts(monkeypatch):
    import httpx
    answer = "I built a payments API in FastAPI that retried failed charges with idempotency keys."
    class _R:
        status_code = 200
        def json(self): return {"questions": [{"transcript": answer}]}
    async def fake_get(self, url, **kw): return _R()
    patched, graded = [], []
    async def fake_patch(iid, body): patched.append(body)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    monkeypatch.setattr(eval_main, "_ensure_local", lambda p: p)
    monkeypatch.setattr(eval_main, "_transcribe", lambda p: "")          # e.g. Gemini outage
    monkeypatch.setattr(eval_main, "_analyze_frames", lambda p: {})
    monkeypatch.setattr(eval_main, "_video_duration", lambda p: 60.0)
    monkeypatch.setattr(eval_main, "_evaluate_single_question", lambda **kw: graded.append(kw["answer"]) or {"overall": 70})
    monkeypatch.setattr(eval_main, "_compute_composite_score", lambda *a: {"overall_score": 70})
    monkeypatch.setattr(eval_main, "_synthesize_final", lambda **kw: {})
    monkeypatch.setattr(eval_main, "_patch_interview", fake_patch)

    req = eval_main.EvaluateRequest(interview_id="abc", video_path="x.webm", company="Acme", job_description="jd",
                                    questions=["Tell me about a project."], question_ids=[])
    asyncio.run(eval_main._evaluate(req))

    assert graded == [answer]
    assert patched[0]["overall_score"] == 70 and patched[0]["transcript"] == answer


def test_full_pipeline_without_llm_produces_a_result(monkeypatch):
    """Real grading/composite/synthesis code, no LLM configured: must finish 'evaluated', not crash."""
    import httpx
    answer = "I built a payments API in FastAPI that retried failed charges with idempotency keys."
    class _R:
        status_code = 200
        def json(self): return {"questions": [{"transcript": answer}]}
    async def fake_get(self, url, **kw): return _R()
    patched = []
    async def fake_patch(iid, body): patched.append(body)
    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    monkeypatch.setattr(eval_main, "gemini_model", None)
    monkeypatch.setattr(eval_main, "deepseek_client", None)
    monkeypatch.setattr(eval_main, "_ensure_local", lambda p: p)
    monkeypatch.setattr(eval_main, "_transcribe", lambda p: "")
    monkeypatch.setattr(eval_main, "_analyze_frames", lambda p: {})
    monkeypatch.setattr(eval_main, "_video_duration", lambda p: 60.0)
    monkeypatch.setattr(eval_main, "_patch_interview", fake_patch)

    req = eval_main.EvaluateRequest(interview_id="abc", video_path="x.webm", company="Acme", job_description="jd",
                                    questions=["Tell me about a project."], question_ids=["q1"])
    asyncio.run(eval_main._evaluate(req))

    assert patched[0]["status"] == "evaluated"
    assert patched[0]["per_question_data"][0]["question_id"] == "q1"


def test_start_evaluation_requires_internal_token(monkeypatch):
    from fastapi.testclient import TestClient
    monkeypatch.setattr(eval_main, "_run_evaluation", lambda req: None)
    c = TestClient(eval_main.app)
    body = {"interview_id": "abc", "video_path": "x.webm", "company": "Acme", "job_description": "jd"}
    assert c.post("/evaluation/start", json=body).status_code == 403
    assert c.post("/evaluation/start", json=body, headers={"X-Internal-Token": "test-internal-token"}).status_code == 200


def test_question_generate_requires_internal_token():
    from fastapi.testclient import TestClient
    from services.question import main as q_main
    body = {"company": "Acme", "target_role": "SWE", "job_description": "jd"}
    assert TestClient(q_main.app).post("/generate", json=body).status_code == 403


# ── Speech metrics ───────────────────────────────────────────────────────────
def test_filler_regex_counts_also_as_zero():
    assert eval_main._speech_metrics("I also also also worked there.", 60)["filler_word_count"] == 0


def test_filler_regex_word_boundaries_and_phrases():
    m = eval_main._speech_metrics("Um, I uh likely liked it, you know, basically. Like that. So right, actually.", 60)
    counts = {f["word"]: f["count"] for f in m["filler_breakdown"]}
    assert counts == {"um": 1, "uh": 1, "you know": 1, "basically": 1, "like": 1}


def test_wpm_uses_real_duration_and_handles_unknown():
    assert eval_main._speech_metrics("word " * 150, 60)["words_per_minute"] == 150
    unknown = eval_main._speech_metrics("word " * 150, None)
    assert unknown["words_per_minute"] is None and unknown["pace_assessment"] == "unknown"
    assert eval_main._compute_composite_score([], unknown, {})["score_breakdown"]["communication"]["score"] == 100


def test_video_duration_from_decoded_audio(tmp_path):
    import subprocess
    imageio_ffmpeg = __import__("pytest").importorskip("imageio_ffmpeg")
    out = tmp_path / "t.webm"
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=duration=2.5",
                    "-c:a", "libopus", str(out)], check=True)
    assert abs(eval_main._video_duration(str(out)) - 2.5) < 0.2
    assert eval_main._video_duration(str(tmp_path / "missing.webm")) is None


# ── Queue worker (arq) ───────────────────────────────────────────────────────
def _job(monkeypatch, evaluate):
    from services.evaluation import queue
    patched = []
    async def fake_patch(iid, body): patched.append(body)
    monkeypatch.setattr(eval_main, "_evaluate", evaluate)
    monkeypatch.setattr(eval_main, "_patch_interview", fake_patch)
    payload = {"interview_id": "abc", "video_path": "s3://b/v.webm", "company": "Acme", "job_description": "jd"}
    return queue, payload, patched


def test_worker_retries_then_marks_error(monkeypatch):
    import pytest
    from arq import Retry
    async def boom(req): raise RuntimeError("gemini down")
    queue, payload, patched = _job(monkeypatch, boom)

    for attempt in (1, 2):                                   # not the last try: retry with backoff, no status change
        with pytest.raises(Retry):
            asyncio.run(queue.evaluate_interview({"job_try": attempt}, payload))
    assert patched == []
    asyncio.run(queue.evaluate_interview({"job_try": queue.MAX_TRIES}, payload))  # last try: give up cleanly
    assert patched == [{"status": "error"}]


def test_worker_success_does_not_touch_status(monkeypatch):
    seen = []
    async def ok(req): seen.append(req.interview_id)
    queue, payload, patched = _job(monkeypatch, ok)
    asyncio.run(queue.evaluate_interview({"job_try": 1}, payload))
    assert seen == ["abc"] and patched == []


def test_start_evaluation_enqueues_when_redis_configured(monkeypatch):
    from fastapi.testclient import TestClient
    from services.evaluation import queue
    queued = []
    async def fake_enqueue(payload): queued.append(payload["interview_id"]); return True
    monkeypatch.setattr(queue, "REDIS_URL", "redis://example:6379")
    monkeypatch.setattr(queue, "enqueue", fake_enqueue)
    monkeypatch.setattr(eval_main, "_run_evaluation", lambda req: (_ for _ in ()).throw(AssertionError("ran in-process")))
    body = {"interview_id": "abc", "video_path": "s3://b/v.webm", "company": "Acme", "job_description": "jd"}
    r = TestClient(eval_main.app).post("/evaluation/start", json=body, headers={"X-Internal-Token": "test-internal-token"})
    assert r.status_code == 200 and queued == ["abc"]
