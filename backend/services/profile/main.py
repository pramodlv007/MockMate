"""
MockMate Profile Service — Port 8002
Resume handling, GitHub analysis, skills extraction.
Depends on: MinIO (storage), MongoDB (metadata). Falls back gracefully if unavailable.
"""
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os, io, uuid, httpx
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent.parent / ".env")

app = FastAPI(title="MockMate Profile Service", version="2.0.0")
# CORS — Handled centrally by Gateway.


GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
MONGO_URL    = os.getenv("MONGO_URL", "mongodb://mockmate:password@localhost:27017")

# Optional MongoDB client — won't crash if Mongo isn't running
mongo_db = None
try:
    from motor.motor_asyncio import AsyncIOMotorClient
    _mongo = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=2000)
    mongo_db = _mongo.mockmate_profiles
    print("[Profile] MongoDB connected")
except Exception as e:
    print(f"[Profile] MongoDB unavailable (non-fatal): {e}")

# Optional MinIO client
minio_client = None
try:
    from minio import Minio
    minio_client = Minio(
        os.getenv("MINIO_ENDPOINT", "localhost:9000"),
        access_key=os.getenv("MINIO_ACCESS_KEY", "mockmate"),
        secret_key=os.getenv("MINIO_SECRET_KEY", "password"),
        secure=False,
    )
    print("[Profile] MinIO connected")
except Exception as e:
    print(f"[Profile] MinIO unavailable (non-fatal): {e}")

# Local fallback upload dir
LOCAL_UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "resumes"
LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "profile"}


# ─── Resume Upload ────────────────────────────────────────────────────────────
@app.post("/upload-resume")
async def upload_resume(user_id: str = Form(...), file: UploadFile = File(...)):
    content  = await file.read()
    file_id  = str(uuid.uuid4())
    ext      = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "pdf"
    obj_name = f"{user_id}/{file_id}.{ext}"

    # Try MinIO first, fall back to local disk
    storage_path = ""
    if minio_client:
        try:
            bucket = "resumes"
            if not minio_client.bucket_exists(bucket):
                minio_client.make_bucket(bucket)
            minio_client.put_object(bucket, obj_name, io.BytesIO(content), len(content), content_type=file.content_type)
            storage_path = f"minio://resumes/{obj_name}"
        except Exception as e:
            print(f"[Profile] MinIO upload failed, using local: {e}")

    if not storage_path:
        local_path = LOCAL_UPLOAD_DIR / f"{file_id}.{ext}"
        local_path.write_bytes(content)
        storage_path = str(local_path)

    # Persist to Mongo if available
    if mongo_db is not None:
        try:
            await mongo_db.resumes.insert_one({
                "user_id": user_id, "file_id": file_id,
                "filename": file.filename, "storage_path": storage_path,
                "uploaded_at": datetime.utcnow(), "parsed": False,
            })
        except Exception as e:
            print(f"[Profile] Mongo insert failed: {e}")

    return {"status": "uploaded", "file_id": file_id, "storage_path": storage_path}


# ─── GitHub Analysis ──────────────────────────────────────────────────────────
@app.get("/github/{username}")
async def analyze_github(username: str):
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                f"https://api.github.com/users/{username}/repos",
                headers=headers, params={"sort": "updated", "per_page": 30},
            )
            if resp.status_code != 200:
                raise HTTPException(404, f"GitHub user '{username}' not found")
            repos = resp.json()
        except httpx.RequestError:
            raise HTTPException(503, "Cannot reach GitHub API")

    lang_counts: dict = {}
    notable: list = []
    for repo in repos:
        lang = repo.get("language")
        if lang:
            lang_counts[lang] = lang_counts.get(lang, 0) + repo.get("stargazers_count", 0) + 1
        if repo.get("stargazers_count", 0) > 2:
            notable.append(repo["name"])

    top_langs = sorted(lang_counts, key=lang_counts.get, reverse=True)[:6]

    return {
        "username": username,
        "top_languages": top_langs,
        "public_repos": len(repos),
        "notable_repos": notable[:5],
        "contribution_score": min(len(repos) * 3, 100),
    }


# ─── Skills Extraction ────────────────────────────────────────────────────────
TECH_VOCAB = [
    "python","java","javascript","typescript","go","rust","c++","c#","kotlin","swift",
    "react","vue","angular","next.js","node.js","fastapi","django","flask","spring",
    "aws","gcp","azure","docker","kubernetes","terraform","linux",
    "postgresql","mysql","mongodb","redis","elasticsearch","kafka","rabbitmq",
    "graphql","rest","grpc","machine learning","pytorch","tensorflow","llm",
    "git","ci/cd","microservices","system design","data structures","algorithms",
]

@app.post("/skills/extract")
def extract_skills(payload: dict):
    text  = payload.get("text", "").lower()
    found = [t for t in TECH_VOCAB if t in text]
    return {"skills": found, "count": len(found)}
