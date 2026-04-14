"""
MockMate — AWS Lambda: Evaluation Trigger Showcase Route
=========================================================
Accepts an evaluation request, immediately returns 202 Accepted,
and runs the full 4-agent evaluation pipeline asynchronously.

This route demonstrates:
  - AWS Lambda for long-running async AI workloads (up to 15 min)
  - Secrets Manager for API key injection
  - CloudWatch for structured pipeline logs
  - Rate limiting (3 evaluations/hour per IP)

Deploy via:
  cd aws && sam build && sam deploy

Endpoint:
  POST https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/evaluate/trigger
"""
import os
import sys
import json
import boto3
import asyncio
from pathlib import Path
from datetime import datetime

# ── Fetch API keys from Secrets Manager ──────────────────────────────────────
def _get_secret(secret_name: str, key: str) -> str:
    try:
        client = boto3.client("secretsmanager", region_name=os.getenv("AWS_SECRETS_REGION", "us-east-1"))
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response["SecretString"]).get(key, "")
    except Exception as e:
        print(f"[Lambda/Eval] WARNING: Could not fetch secret '{secret_name}': {e}")
        return os.getenv(key, "")

os.environ["GOOGLE_API_KEY"]  = _get_secret("mockmate/api-keys", "GOOGLE_API_KEY")
os.environ["OPENAI_API_KEY"]  = _get_secret("mockmate/api-keys", "OPENAI_API_KEY")

print(f"[Lambda/Eval] Cold-start at {datetime.utcnow().isoformat()}Z")
print(f"[Lambda/Eval] GOOGLE_API_KEY: {bool(os.environ.get('GOOGLE_API_KEY'))}")
print(f"[Lambda/Eval] OPENAI_API_KEY: {bool(os.environ.get('OPENAI_API_KEY'))}")

# ── Path setup ────────────────────────────────────────────────────────────────
lambda_dir   = Path(__file__).parent
backend_path = lambda_dir / "backend"
sys.path.insert(0, str(backend_path))

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from mangum import Mangum
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import httpx

# ── App Setup ─────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="MockMate Evaluation Trigger (Lambda)",
    description=(
        "AWS Lambda showcase: triggers the 4-agent AI evaluation pipeline asynchronously. "
        "Logs all pipeline steps to AWS CloudWatch."
    ),
    version="1.0.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

INTERVIEW_SERVICE_URL = os.getenv("INTERVIEW_SERVICE_URL", "https://mockmate-interview.onrender.com")


# ── Schemas ───────────────────────────────────────────────────────────────────
class EvaluateRequest(BaseModel):
    interview_id: str
    video_path: str          # S3 or Cloudflare R2 pre-signed URL, or local path
    company: str
    job_description: str
    persona: str = "neutral"
    strictness: str = "standard"
    questions: List[str] = []
    question_ids: List[str] = []


class EvaluateResponse(BaseModel):
    interview_id: str
    status: str
    message: str
    lambda_request_id: Optional[str] = None


# ── CloudWatch structured log helper ─────────────────────────────────────────
def _log(level: str, interview_id: str, msg: str, **extra):
    """Emit a structured JSON log line — CloudWatch picks this up automatically."""
    record = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "level": level,
        "service": "lambda-evaluation-trigger",
        "interview_id": interview_id,
        "message": msg,
        **extra,
    }
    print(json.dumps(record))


# ── Evaluation Pipeline (runs as background task) ────────────────────────────
async def _run_evaluation_pipeline(req: EvaluateRequest):
    """
    Full 4-agent evaluation pipeline.
    All steps are logged to CloudWatch via structured JSON.
    """
    _log("INFO", req.interview_id, "Pipeline started", company=req.company)

    # Mark interview as 'evaluating' in the Interview Service
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.patch(
                f"{INTERVIEW_SERVICE_URL}/{req.interview_id}/status",
                json={"status": "evaluating"},
            )
        _log("INFO", req.interview_id, "Status set to evaluating")
    except Exception as e:
        _log("WARNING", req.interview_id, "Could not update status", error=str(e))

    # Import the evaluation pipeline from the packaged backend
    try:
        from services.evaluation.main import (
            _transcribe, _analyze_frames, _speech_metrics, _evaluate
        )

        # Agent 1 — Scribe: Transcription
        _log("INFO", req.interview_id, "Agent 1 (Scribe) starting transcription")
        transcript = _transcribe(req.video_path)
        _log("INFO", req.interview_id, "Agent 1 complete",
             transcript_chars=len(transcript))

        # Agent 3 — Observer: Vision / body language
        _log("INFO", req.interview_id, "Agent 3 (Observer) starting frame analysis")
        vision = _analyze_frames(req.video_path)
        _log("INFO", req.interview_id, "Agent 3 complete", vision=vision)

        # Speech metrics (no AI)
        speech = _speech_metrics(transcript)
        _log("INFO", req.interview_id, "Speech metrics computed", wpm=speech.get("words_per_minute"))

        # Agent 2+4 — Evaluator + Synthesizer
        _log("INFO", req.interview_id, "Agents 2+4 (Evaluator/Synthesizer) starting")
        feedback = _evaluate(
            transcript=transcript,
            speech=speech,
            vision=vision,
            company=req.company,
            jd=req.job_description,
            questions=req.questions,
            persona=req.persona,
            strictness=req.strictness,
        )

        overall_score = feedback.get("overall_score", 0)
        _log("INFO", req.interview_id, "Evaluation complete", overall_score=overall_score)

        # Patch results back to Interview Service
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.patch(
                f"{INTERVIEW_SERVICE_URL}/{req.interview_id}/evaluation",
                json={
                    "overall_score": overall_score,
                    "feedback_summary": json.dumps(feedback),
                    "status": "evaluated",
                    "transcript": transcript,
                },
            )
        _log("INFO", req.interview_id, "Results saved to Interview Service")

    except Exception as e:
        _log("ERROR", req.interview_id, "Pipeline failed", error=str(e))
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.patch(
                    f"{INTERVIEW_SERVICE_URL}/{req.interview_id}/status",
                    json={"status": "error"},
                )
        except Exception:
            pass


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "lambda-evaluation-trigger",
        "interview_service": INTERVIEW_SERVICE_URL,
        "gemini_key": bool(os.environ.get("GOOGLE_API_KEY")),
        "openai_key": bool(os.environ.get("OPENAI_API_KEY")),
    }


@app.post("/evaluate/trigger", response_model=EvaluateResponse)
@limiter.limit("3/hour")
async def trigger_evaluation(
    request: Request,
    req: EvaluateRequest,
    background_tasks: BackgroundTasks,
):
    """
    Trigger the 4-agent evaluation pipeline asynchronously.
    Returns 202 immediately — poll GET /interviews/{id} for completion.
    Rate limited to 3 evaluations per user per hour to cap LLM spend.
    """
    _log("INFO", req.interview_id, "Evaluation trigger received",
         company=req.company, questions_count=len(req.questions))

    if not req.video_path:
        raise HTTPException(status_code=400, detail="video_path is required")

    background_tasks.add_task(_run_evaluation_pipeline, req)

    return EvaluateResponse(
        interview_id=req.interview_id,
        status="processing",
        message=(
            "Evaluation pipeline started. "
            f"Poll GET /interviews/{req.interview_id} for status updates. "
            "Pipeline logs available in AWS CloudWatch."
        ),
    )


# ── Lambda entry point ────────────────────────────────────────────────────────
handler = Mangum(app, lifespan="off")
