from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .engine import engine

# ── Rate limiter: cap LLM spend — 10 generations/min per IP ──────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Question Service", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class QuestionRequest(BaseModel):
    company: str
    target_role: str
    skills: str
    job_description: str
    count: int = 5
    persona: str = "neutral"     # friendly | neutral | tough
    strictness: str = "standard" # easy | standard | strict


@app.get("/health")
def health():
    return {"status": "ok", "service": "question"}


@app.post("/generate")
@limiter.limit("10/minute")
async def generate(request: Request, req: QuestionRequest):
    """
    Generate tailored interview questions.
    Rate limited to 10 requests/minute per IP to prevent LLM cost abuse.
    """
    if req.count > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 questions per request.")

    questions = engine.generate(
        req.company,
        req.target_role,
        req.skills,
        req.job_description,
        req.count,
        req.persona,
        req.strictness,
    )
    return {"questions": questions, "count": len(questions)}
