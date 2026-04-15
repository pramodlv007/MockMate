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
    """Direct Gemini test using the new google.genai SDK."""
    from .engine import gemini_client, gemini_model_name, GOOGLE_API_KEY, TAVILY_API_KEY
    result = {
        "google_api_key_present": bool(GOOGLE_API_KEY),
        "tavily_key_present": bool(TAVILY_API_KEY),
        "gemini_client_loaded": gemini_client is not None,
        "model_name": gemini_model_name,
        "test_result": None,
        "error": None,
    }
    if gemini_client:
        try:
            from google import genai as google_genai
            response = gemini_client.models.generate_content(
                model=gemini_model_name,
                contents='Reply with exactly this JSON: {"questions": ["What is backpropagation?"]}',
                config=google_genai.types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=100,
                )
            )
            result["test_result"] = response.text[:300]
        except Exception as e:
            result["error"] = f"{type(e).__name__}: {str(e)[:500]}"
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
