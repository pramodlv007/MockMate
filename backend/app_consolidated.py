"""
MockMate — Consolidated Backend v3.0
=====================================
All microservices mounted as sub-applications in a single FastAPI process.
Eliminates inter-service HTTP cold starts. Deploy as ONE process on Railway.

Before: 6 Render services, 90+ second cold start chains.
After:  1 Railway process, instant response, $5/mo.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

app = FastAPI(
    title="MockMate API",
    description="Consolidated MockMate backend — all services in one process",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your Vercel domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__, "traceback": tb},
    )

# Mount each service as a sub-application
# Internal service URLs in .env must point to the same process:
#   QUESTION_SERVICE_URL=http://localhost:8000/questions
#   INTERVIEW_SERVICE_URL=http://localhost:8000/interviews
#   EVALUATION_SERVICE_URL=http://localhost:8000/evaluation
#   AUTH_SERVICE_URL=http://localhost:8000/auth-svc

from services.auth.main import app as auth_app
from services.profile.main import app as profile_app
from services.question.main import app as question_app
from services.interview.main import app as interview_app
from services.evaluation.main import app as evaluation_app

app.mount("/auth-svc", auth_app)
app.mount("/profile", profile_app)
app.mount("/questions", question_app)
app.mount("/interviews", interview_app)
app.mount("/evaluation", evaluation_app)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "mockmate-consolidated",
        "version": "3.0.0",
        "services": ["auth", "profile", "question", "interview", "evaluation"],
    }
