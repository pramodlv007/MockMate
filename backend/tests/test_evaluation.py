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
