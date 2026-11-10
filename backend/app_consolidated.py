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
  /rubric/*     → rubric_app (v2 rubric grader: /questions, /answer)

Internal service URLs for .env:
  QUESTION_SERVICE_URL   = http://localhost:8000/questions
  INTERVIEW_SERVICE_URL  = http://localhost:8000/interviews
  EVALUATION_SERVICE_URL = http://localhost:8000/evaluation
  AUTH_SERVICE_URL       = http://localhost:8000
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import dotenv_values
from pathlib import Path
from time import perf_counter
from prometheus_client import make_asgi_app
from common.metrics import HTTP_LATENCY
import os, traceback

app = FastAPI(
    title="MockMate API",
    description="Consolidated MockMate backend — all services in one process",
    version="3.0.0",
)

# Browsers reject "*" on credentialed (cookie) requests, so origins must be listed explicitly.
_frontend_url = os.getenv("FRONTEND_URL") or dotenv_values(Path(__file__).parent / ".env").get("FRONTEND_URL")
ALLOWED_ORIGINS = [o for o in [
    _frontend_url,
    "http://localhost:5173", "http://localhost:5174", "http://localhost:3000",
    "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:3000",
] if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def record_latency(request: Request, call_next):
    """Label by route template (/interviews/{interview_id}), not raw path, so UUIDs don't explode cardinality."""
    start = perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        # Mounted sub-apps write their matched route + mount prefix into this same scope dict.
        route = getattr(request.scope.get("route"), "path", None)
        label = request.scope.get("root_path", "") + route if route else "unmatched"
        HTTP_LATENCY.labels(request.method, label, str(status)).observe(perf_counter() - start)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "mockmate-consolidated",
        "version": "3.0.0",
        "services": ["auth", "profile", "question", "interview", "evaluation", "rubric"],
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

# All services live in this process, so internal calls loop back to it unless .env overrides them.
# Must run before the service imports, which read these at import time.
_self = f"http://localhost:{os.getenv('PORT', '8000')}"
for _k, _v in {"AUTH_SERVICE_URL": _self, "QUESTION_SERVICE_URL": f"{_self}/questions",
               "INTERVIEW_SERVICE_URL": f"{_self}/interviews", "EVALUATION_SERVICE_URL": f"{_self}/evaluation"}.items():
    os.environ.setdefault(_k, _v)

from services.profile.main import app as profile_app
from services.question.main import app as question_app
from services.interview.main import app as interview_app
from services.evaluation.main import app as evaluation_app
from services.auth.main import app as auth_app
from services.rubric.main import app as rubric_app

# Scraped by Prometheus inside the cluster; the Ingress doesn't route /metrics, so it isn't public.
app.mount("/metrics", make_asgi_app())

# Specific prefix mounts first (order matters — more specific before catch-all)
app.mount("/profile", profile_app)
app.mount("/questions", question_app)
app.mount("/interviews", interview_app)
app.mount("/evaluation", evaluation_app)
app.mount("/rubric", rubric_app)

# Auth owns /auth/* and /users/* — mount at root as catch-all last
# auth_app defines full paths (/auth/signup, /users/me) so no prefix stripping needed
app.mount("/", auth_app)
