"""
MockMate — Consolidated Backend v3.0
=====================================
All microservices mounted as sub-applications in a single FastAPI process.

Route mapping (matches original gateway behaviour):
  /auth/*       → auth_app   (auth_app defines full paths: /auth/signup, /users/me)
  /users/*      → auth_app   (auth_app owns /users/me, /users/me/profile)
  /profile/*    → profile_app (strips /profile prefix → /github/x, /resume/upload)
  /interviews/* → interview_app (strips /interviews prefix → /, /{id}, /{id}/upload)
  /questions/*  → question_app (strips /questions prefix → /generate, /health)
  /evaluation/* → evaluation_app (strips /evaluation prefix → /evaluation/start)

Internal service URLs for .env:
  QUESTION_SERVICE_URL   = http://localhost:8000/questions
  INTERVIEW_SERVICE_URL  = http://localhost:8000/interviews
  EVALUATION_SERVICE_URL = http://localhost:8000/evaluation
  AUTH_SERVICE_URL       = http://localhost:8000
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "mockmate-consolidated",
        "version": "3.0.0",
        "services": ["auth", "profile", "question", "interview", "evaluation"],
    }

@app.get("/warmup")
def warmup():
    """Frontend calls this on boot to pre-warm the backend."""
    return {"status": "warm", "service": "mockmate-consolidated"}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__, "traceback": tb},
    )

from services.profile.main import app as profile_app
from services.question.main import app as question_app
from services.interview.main import app as interview_app
from services.evaluation.main import app as evaluation_app
from services.auth.main import app as auth_app

# Specific prefix mounts first (order matters — more specific before catch-all)
app.mount("/profile", profile_app)
app.mount("/questions", question_app)
app.mount("/interviews", interview_app)
app.mount("/evaluation", evaluation_app)

# Auth owns /auth/* and /users/* — mount at root as catch-all last
# auth_app defines full paths (/auth/signup, /users/me) so no prefix stripping needed
app.mount("/", auth_app)
