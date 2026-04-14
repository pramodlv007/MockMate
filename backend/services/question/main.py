from fastapi import FastAPI
from pydantic import BaseModel
from .engine import engine

app = FastAPI(title="Question Service")

class QuestionRequest(BaseModel):
    company: str
    target_role: str
    skills: str
    job_description: str
    count: int = 5
    persona: str = "neutral"
    strictness: str = "standard"

@app.post("/generate")
async def generate(req: QuestionRequest):
    questions = engine.generate(
        req.company,
        req.target_role,
        req.skills,
        req.job_description,
        req.count,
        req.persona,
        req.strictness
    )
    return {"questions": questions}
