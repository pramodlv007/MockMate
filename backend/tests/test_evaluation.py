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


def test_start_evaluation_requires_internal_token(monkeypatch):
    from fastapi.testclient import TestClient
    monkeypatch.setattr(eval_main, "_run_evaluation", lambda req: None)
    c = TestClient(eval_main.app)
    body = {"interview_id": "abc", "video_path": "x.webm", "company": "Acme", "job_description": "jd"}
    assert c.post("/evaluation/start", json=body).status_code == 403
    assert c.post("/evaluation/start", json=body, headers={"X-Internal-Token": "test-internal-token"}).status_code == 200
