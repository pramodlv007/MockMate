"""
MockMate — AWS Lambda: Question Generation Showcase Route
=========================================================
Wraps the existing QuestionEngine in a Lambda-compatible FastAPI app
using Mangum. API keys are fetched from AWS Secrets Manager at cold-start.

Deploy via:
  cd aws && sam build && sam deploy

Endpoint exposed via API Gateway:
  POST https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/questions/generate

Rate limit: 10 requests / minute per IP (slowapi)
CloudWatch: all print() output auto-sent to /aws/lambda/mockmate-question-generate
"""
import os
import sys
import json
import boto3
from pathlib import Path

# ── Fetch API keys from Secrets Manager (runs once at cold-start) ────────────
def _get_secret(secret_name: str, key: str) -> str:
    """Fetch a single value from AWS Secrets Manager."""
    try:
        client = boto3.client("secretsmanager", region_name=os.getenv("AWS_SECRETS_REGION", "us-east-1"))
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response["SecretString"]).get(key, "")
    except Exception as e:
        print(f"[Lambda] WARNING: Could not fetch secret '{secret_name}': {e}")
        return os.getenv(key, "")  # graceful fallback to env var

# Inject into environment before importing the engine
os.environ["GOOGLE_API_KEY"]  = _get_secret("mockmate/api-keys", "GOOGLE_API_KEY")
os.environ["OPENAI_API_KEY"]  = _get_secret("mockmate/api-keys", "OPENAI_API_KEY")

print(f"[Lambda] GOOGLE_API_KEY present: {bool(os.environ.get('GOOGLE_API_KEY'))}")
print(f"[Lambda] OPENAI_API_KEY present: {bool(os.environ.get('OPENAI_API_KEY'))}")

# ── Add question service to path ─────────────────────────────────────────────
# The Lambda package bundles the backend source under /var/task/backend/
lambda_dir   = Path(__file__).parent
backend_path = lambda_dir / "backend"
sys.path.insert(0, str(backend_path))

from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from mangum import Mangum
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# ── App Setup ─────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="MockMate Question Generator (Lambda)",
    description="AWS Lambda showcase route — generates tailored interview questions via Gemini/OpenAI",
    version="1.0.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Schemas ───────────────────────────────────────────────────────────────────
class QuestionRequest(BaseModel):
    company: str
    target_role: str
    skills: str = ""
    job_description: str
    count: int = 5
    persona: str = "neutral"   # friendly | neutral | tough
    strictness: str = "standard"  # easy | standard | strict


# ── Lazy-load engine (avoids import errors if keys not ready) ─────────────────
_engine = None

def _get_engine():
    global _engine
    if _engine is None:
        from services.question.engine import QuestionEngine
        _engine = QuestionEngine()
        print("[Lambda] QuestionEngine initialised")
    return _engine


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "lambda-question-generate",
        "gemini_key": bool(os.environ.get("GOOGLE_API_KEY")),
        "openai_key": bool(os.environ.get("OPENAI_API_KEY")),
    }


@app.post("/questions/generate")
@limiter.limit("10/minute")
async def generate_questions(request: Request, req: QuestionRequest):
    """
    Generate tailored interview questions.
    Rate limited to 10 requests/minute per IP to cap LLM costs.
    All invocations logged to AWS CloudWatch automatically.
    """
    print(f"[Lambda] Generating {req.count} questions for {req.company} / {req.target_role}")

    if req.count > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 questions per request.")

    try:
        engine  = _get_engine()
        questions = engine.generate(
            req.company,
            req.target_role,
            req.skills,
            req.job_description,
            req.count,
            req.persona,
            req.strictness,
        )
        print(f"[Lambda] ✔ Returned {len(questions)} questions")
        return {"questions": questions, "count": len(questions), "source": "lambda"}
    except Exception as e:
        print(f"[Lambda] ✗ Error: {e}")
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")


# ── Lambda entry point ────────────────────────────────────────────────────────
handler = Mangum(app, lifespan="off")
