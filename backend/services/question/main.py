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
    persona: str = "neutral"      # friendly | neutral | tough
    strictness: str = "standard"  # easy | standard | strict
    resume_text: str = ""         # extracted text from uploaded resume


@app.get("/health")
def health():
    from .engine import gemini_model, openai_client, TAVILY_API_KEY
    return {
        "status": "ok",
        "service": "question",
        "gemini": gemini_model is not None,
        "openai": openai_client is not None,
        "tavily": bool(TAVILY_API_KEY),
    }


@app.get("/debug/gemini")
async def debug_gemini():
    """Direct Gemini test — shows exactly what's failing."""
    from .engine import gemini_model, GOOGLE_API_KEY, TAVILY_API_KEY
    result = {
        "google_api_key_present": bool(GOOGLE_API_KEY),
        "tavily_key_present": bool(TAVILY_API_KEY),
        "gemini_model_loaded": gemini_model is not None,
        "test_result": None,
        "error": None,
    }
    if gemini_model:
        try:
            resp = gemini_model.generate_content(
                'Return this exact JSON: {"questions": ["What is PyTorch?"]}',
                generation_config={"temperature": 0.1, "max_output_tokens": 100,
                                   "response_mime_type": "application/json"}
            )
            result["test_result"] = resp.text[:200]
        except Exception as e:
            result["error"] = str(e)
    return result


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
        req.resume_text,
    )
    return {"questions": questions, "count": len(questions)}
