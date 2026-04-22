from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .engine import engine

# ── Rate limiter: cap LLM spend — 10 generations/min per IP ──────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Question Service", version="3.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class QuestionRequest(BaseModel):
    # Interview setup data
    company: str
    target_role: str
    job_description: str
    count: int = 5
    persona: str = "neutral"        # friendly | neutral | tough
    strictness: str = "standard"    # easy | standard | strict

    # Profile + resume data (forwarded by Interview Service)
    skills: str = ""
    resume_text: str = ""           # extracted text from uploaded resume
    full_name: str = ""
    experience_years: Optional[int] = 0
    education: str = ""
    github_url: str = ""
    user_id: str = ""               # for cross-session question deduplication


@app.get("/health")
def health():
    from .engine import gemini_model, deepseek_client, TAVILY_API_KEY
    return {
        "status": "ok",
        "service": "question",
        "version": "3.0.0",
        "gemini": gemini_model is not None,
        "deepseek": deepseek_client is not None,
        "tavily": bool(TAVILY_API_KEY),
    }


@app.post("/generate")
@limiter.limit("10/minute")
async def generate(request: Request, req: QuestionRequest):
    """
    Generate tailored interview questions from the combined prompt.
    All questions are 100% LLM-generated — no predefined banks or templates.
    Rate limited to 10 requests/minute per IP to prevent LLM cost abuse.
    """
    if req.count > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 questions per request.")

    questions = engine.generate(
        company=req.company,
        role=req.target_role,
        skills=req.skills,
        jd=req.job_description,
        count=req.count,
        persona=req.persona,
        strictness=req.strictness,
        resume_text=req.resume_text,
        full_name=req.full_name,
        experience_years=req.experience_years or 0,
        education=req.education,
        github_url=req.github_url,
        user_id=req.user_id,
    )
    return {"questions": questions, "count": len(questions)}
