"""
MockMate Rubric Service (v2) — mounted at /rubric.
Pick a question from the curated bank, answer by voice, get rubric feedback.
"""
import os, tempfile, time
from typing import Optional
from fastapi import FastAPI, Depends, File, Form, HTTPException, Request, UploadFile
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from common.auth import get_current_user_id, user_or_ip_key
from .grader import BANK, grade

# Per user, not per IP: behind the k8s Ingress every request arrives from the ingress pod's IP.
limiter = Limiter(key_func=user_or_ip_key, storage_uri=os.getenv("REDIS_URL") or "memory://")
app = FastAPI(title="MockMate Rubric Service", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_whisper = None


def transcribe(audio: bytes) -> str:
    global _whisper
    try:
        from faster_whisper import WhisperModel  # optional: pip install -r requirements-asr.txt
    except ImportError:
        raise HTTPException(501, "Speech-to-text is not installed on this server; send a typed transcript.")
    if _whisper is None:
        _whisper = WhisperModel(os.getenv("WHISPER_MODEL", "base.en"), compute_type="int8")
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(audio)
    try:
        segments, _ = _whisper.transcribe(f.name)
        return " ".join(s.text.strip() for s in segments)
    finally:
        os.unlink(f.name)


@app.get("/health")
def health():
    return {"status": "ok", "service": "rubric", "questions": len(BANK)}


@app.get("/questions")
def questions(type: Optional[str] = None, role: Optional[str] = None):
    """Question list without rubrics, so the candidate does not see the answer key."""
    return [
        {k: q[k] for k in ("id", "type", "role", "text")}
        for q in BANK.values()
        if (not type or q["type"] == type) and (not role or q["role"] in (role, "any"))
    ]


@app.post("/answer")
@limiter.limit("30/hour")
def answer(
    request: Request,
    question_id: str = Form(...),
    transcript: str = Form(""),
    audio: Optional[UploadFile] = File(None),
    _user: str = Depends(get_current_user_id),
):
    q = BANK.get(question_id)
    if not q:
        raise HTTPException(404, "Unknown question_id")
    t0 = time.perf_counter()
    asr_ms = 0
    if audio is not None:
        transcript = transcribe(audio.file.read())
        asr_ms = round((time.perf_counter() - t0) * 1000)
    if len(transcript.split()) < 10:
        raise HTTPException(400, "No usable answer detected (fewer than 10 words).")
    from openai import APIError
    try:
        result = grade(question_id, transcript)
    except ValueError:
        raise HTTPException(502, "The grader returned invalid output twice; please retry.")
    except APIError as e:  # bad key, quota, judge server down
        print(f"[Rubric] judge error: {e}")
        raise HTTPException(502, "The grader is unavailable right now; please retry.")
    return {
        **result,
        "transcript": transcript,
        "asr_ms": asr_ms,
        # reading material for the report, never a grading reference
        "sample_answer": q["sample_answer"],
        "misconceptions": q["misconceptions"],
    }
