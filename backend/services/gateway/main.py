import os
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import httpx
from jose import jwt, JWTError

load_dotenv(Path(__file__).parent.parent.parent / ".env")

app = FastAPI(
    title="MockMate API Gateway",
    version="2.0.0",
    description="Central entry point routing to all MockMate microservices",
)

# ─── Service URLs ──────────────────────────────────────────────────────────────
AUTH_SERVICE_URL       = os.getenv("AUTH_SERVICE_URL",       "http://localhost:8001")
PROFILE_SERVICE_URL    = os.getenv("PROFILE_SERVICE_URL",    "http://localhost:8002")
QUESTION_SERVICE_URL   = os.getenv("QUESTION_SERVICE_URL",   "http://localhost:8003")
INTERVIEW_SERVICE_URL  = os.getenv("INTERVIEW_SERVICE_URL",  "http://localhost:8004")
EVALUATION_SERVICE_URL = os.getenv("EVALUATION_SERVICE_URL", "http://localhost:8005")

SECRET_KEY = os.getenv("SECRET_KEY", "changeme-secret")
ALGORITHM  = os.getenv("ALGORITHM",  "HS256")

# ─── CORS ─────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    # ── Local development ──────────────────────────────────────────────────────
    os.getenv("FRONTEND_URL", "http://localhost:5173"),
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
    # ── Production — Vercel (auto HTTPS) ───────────────────────────────────────
    # Replace with your actual Vercel URL after first deploy:
    "https://mockmate-frontend-ten.vercel.app",
    "https://mockmate.vercel.app",
    # ── Production — Custom domain (update after DNS setup) ────────────────────
    # "https://yourdomain.com",
    # "https://www.yourdomain.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ─── JWT helper ───────────────────────────────────────────────────────────────
def _extract_user_id(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("user_id")
    except JWTError:
        return None

import asyncio as _asyncio

async def _proxy(request: Request, target_base: str, path_suffix: str) -> Response:
    """Forward a request verbatim to a downstream microservice.
    Retries up to 3 times on 502/503 to handle Render free-tier cold starts.
    """
    url = f"{target_base}{path_suffix}"
    body = await request.body()

    # Copy headers, strip hop-by-hop headers that shouldn't be forwarded
    forward_headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "transfer-encoding", "connection")
    }

    # Inject authenticated user_id for downstream services
    user_id = _extract_user_id(request)
    if user_id:
        forward_headers["x-user-id"] = user_id

    # Propagate real IP
    if request.client:
        forward_headers["x-forwarded-for"] = request.client.host

    MAX_RETRIES = 3
    COLD_START_WAIT = 15  # seconds — Render free tier cold start ~15-30s

    last_resp = None
    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.request(
                    method=request.method,
                    url=url,
                    headers=forward_headers,
                    content=body,
                    params=dict(request.query_params),
                    cookies=dict(request.cookies),
                )
            last_resp = resp

            # Detect Render cold-start: 502/503 with HTML body (not our JSON errors)
            is_cold_start = (
                resp.status_code in (502, 503)
                and "text/html" in resp.headers.get("content-type", "")
            )
            if is_cold_start and attempt < MAX_RETRIES - 1:
                print(f"[Gateway] Cold-start detected for {target_base}, retrying in {COLD_START_WAIT}s (attempt {attempt+1}/{MAX_RETRIES})")
                await _asyncio.sleep(COLD_START_WAIT)
                continue
            break  # success or non-retryable error

        except httpx.ConnectError:
            if attempt < MAX_RETRIES - 1:
                print(f"[Gateway] ConnectError for {target_base}, retrying in {COLD_START_WAIT}s (attempt {attempt+1}/{MAX_RETRIES})")
                await _asyncio.sleep(COLD_START_WAIT)
                continue
            raise HTTPException(502, detail=f"Service unavailable: {target_base}")
        except httpx.TimeoutException:
            raise HTTPException(504, detail=f"Upstream timed out: {target_base}")

    if last_resp is None:
        raise HTTPException(502, detail=f"Service unavailable: {target_base}")

    # Forward all response headers EXCEPT CORS ones (to avoid duplicates)
    resp_headers = {
        k: v for k, v in last_resp.headers.items()
        if k.lower() not in (
            "transfer-encoding",
            "access-control-allow-origin",
            "access-control-allow-credentials",
            "access-control-allow-methods",
            "access-control-allow-headers",
        )
    }

    return Response(
        content=last_resp.content,
        status_code=last_resp.status_code,
        headers=resp_headers,
        media_type=last_resp.headers.get("content-type"),
    )



# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "gateway"}

@app.get("/", tags=["meta"])
async def root():
    return {"message": "MockMate API Gateway v2.0"}


# ─── Auth Routes  /auth/** ────────────────────────────────────────────────────
@app.api_route("/auth/{path:path}", methods=["GET","POST","PUT","DELETE","OPTIONS","PATCH"])
async def auth_proxy(path: str, request: Request):
    return await _proxy(request, AUTH_SERVICE_URL, f"/auth/{path}")


# ─── User / Me Routes  /users/** ─────────────────────────────────────────────
@app.api_route("/users/{path:path}", methods=["GET","POST","PUT","DELETE","OPTIONS","PATCH"])
async def users_proxy(path: str, request: Request):
    return await _proxy(request, AUTH_SERVICE_URL, f"/users/{path}")


# ─── Profile Routes  /profile/** ─────────────────────────────────────────────
@app.api_route("/profile/{path:path}", methods=["GET","POST","PUT","DELETE","OPTIONS","PATCH"])
async def profile_proxy(path: str, request: Request):
    return await _proxy(request, PROFILE_SERVICE_URL, f"/{path}")


# ─── Interview Routes  /interviews/** ────────────────────────────────────────

# Must be declared BEFORE the catch-all so FastAPI matches it first
@app.get("/interviews/user/me")
async def interviews_user_me(request: Request):
    """Decode JWT → forward to interview service as /user/{user_id}."""
    user_id = _extract_user_id(request)
    if not user_id:
        raise HTTPException(401, detail="Not authenticated")
    return await _proxy(request, INTERVIEW_SERVICE_URL, f"/user/{user_id}")

@app.api_route("/interviews", methods=["GET","POST","OPTIONS"])
async def interviews_root(request: Request):
    # GET /interviews → list for authenticated user
    if request.method == "GET":
        user_id = _extract_user_id(request)
        if user_id:
            return await _proxy(request, INTERVIEW_SERVICE_URL, f"/user/{user_id}")
    return await _proxy(request, INTERVIEW_SERVICE_URL, "/")

@app.api_route("/interviews/{path:path}", methods=["GET","POST","PUT","DELETE","OPTIONS","PATCH"])
async def interviews_proxy(path: str, request: Request):
    return await _proxy(request, INTERVIEW_SERVICE_URL, f"/{path}")


# ─── Evaluation Routes  /evaluation/** ───────────────────────────────────────
@app.api_route("/evaluation/{path:path}", methods=["GET","POST","OPTIONS"])
async def evaluation_proxy(path: str, request: Request):
    return await _proxy(request, EVALUATION_SERVICE_URL, f"/{path}")


# ─── Question Routes  /questions/** ──────────────────────────────────────────
@app.api_route("/questions/{path:path}", methods=["GET","POST","OPTIONS"])
async def questions_proxy(path: str, request: Request):
    return await _proxy(request, QUESTION_SERVICE_URL, f"/{path}")
