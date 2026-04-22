"""
MockMate Interview Service — Port 8004
Manages interview sessions: create, fetch, upload video, patch evaluation results.
Calls Question Service to generate questions on session creation.
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request
from common.auth import get_current_user_id
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from common.database import get_db, engine
from . import models
from .schemas import InterviewSessionOut, EvaluationPatch
from pathlib import Path
import httpx, uuid, os, traceback
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

models.Base.metadata.create_all(bind=engine)

# ─── S3 Setup (optional — falls back to local storage if not configured) ─────
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
s3_client = None
if S3_BUCKET:
    try:
        import boto3
        s3_client = boto3.client("s3")
        print(f"[Interview] S3 storage enabled: s3://{S3_BUCKET}")
    except Exception as e:
        print(f"[Interview] S3 init error: {e}")

app = FastAPI(title="MockMate Interview Service", version="2.0.0")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__, "traceback": tb}
    )

@app.get("/health")
def health():
    return {"status": "ok", "service": "interview"}


QUESTION_SERVICE_URL   = os.getenv("QUESTION_SERVICE_URL",   "http://localhost:8003")
EVALUATION_SERVICE_URL = os.getenv("EVALUATION_SERVICE_URL", "http://localhost:8005")
AUTH_SERVICE_URL       = os.getenv("AUTH_SERVICE_URL",       "http://localhost:8001")
UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads" / "videos"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ─── Create Interview Session ─────────────────────────────────────────────────
@app.post("/", response_model=InterviewSessionOut)
async def create_interview(
    data: dict,
    db: Session = Depends(get_db),
    user_id_str: str = Depends(get_current_user_id),
):
    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(400, "Invalid user_id format")

    # Build session record
    session = models.InterviewSession(
        user_id=user_uuid,
        company_name=data.get("company_name", ""),
        target_role=data.get("target_role"),
        job_description=data.get("job_description", ""),
        questions_count=int(data.get("questions_count", 5)),
        duration_minutes=int(data.get("duration_minutes", 15)),
        interviewer_persona=data.get("interviewer_persona", "neutral"),
        strictness_level=data.get("strictness_level", "standard"),
        status="created",
    )
    db.add(session)
    db.commit()

    # Fetch full user profile directly from shared DB (same PostgreSQL)
    resume_text = ""
    user_skills = data.get("skills", "")
    user_full_name = ""
    user_experience_years = 0
    user_education = ""
    user_github_url = ""
    try:
        from sqlalchemy import text as sql_text
        row = db.execute(
            sql_text("SELECT full_name, skills, experience_years, education, github_url, resume_text "
                     "FROM users WHERE id = :uid"),
            {"uid": str(user_uuid)}
        ).fetchone()
        if row:
            user_full_name = row[0] or ""
            profile_skills = row[1] or ""
            user_experience_years = row[2] or 0
            user_education = row[3] or ""
            user_github_url = row[4] or ""
            resume_text = row[5] or ""
            user_skills = data.get("skills") or profile_skills
            print(f"[Interview] Profile loaded: name={user_full_name}, exp={user_experience_years}yr, "
                  f"resume={len(resume_text)} chars, skills={user_skills[:60]}")
    except Exception as e:
        print(f"[Interview] Could not fetch user profile: {e}")

    # Call Question Service with full profile + JD context
    questions_list: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            q_payload = {
                "company":          session.company_name,
                "target_role":      session.target_role or "",
                "skills":           user_skills,
                "job_description":  session.job_description,
                "count":            session.questions_count,
                "persona":          session.interviewer_persona,
                "strictness":       session.strictness_level,
                "resume_text":      resume_text,
                "full_name":        user_full_name,
                "experience_years": user_experience_years,
                "education":        user_education,
                "github_url":       user_github_url,
                "user_id":          str(user_uuid),  # for cross-session deduplication
            }
            resp = await client.post(f"{QUESTION_SERVICE_URL}/generate", json=q_payload)
            if resp.status_code == 200:
                questions_list = resp.json().get("questions", [])
            else:
                print(f"[Interview] Question service error: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        print(f"[Interview] Question service unavailable: {e}")

    # Fallback questions if none returned
    if not questions_list:
        role = session.target_role or "Engineer"
        questions_list = [
            f"Walk me through your most impactful project as a {role}.",
            f"How would you design a scalable system for {session.company_name}?",
            f"Describe a time you resolved a complex technical challenge.",
            "What is your approach to code review and quality?",
            "How do you handle disagreements with team members on technical decisions?",
        ][:session.questions_count]

    # Persist questions
    for idx, q_text in enumerate(questions_list):
        q = models.Question(
            session_id=session.id,
            content=q_text,
            order_index=idx,
        )
        db.add(q)

    session.status = "generated"
    db.commit()
    db.refresh(session)
    return session


# ─── List User's Interviews ───────────────────────────────────────────────────
@app.get("/user/{user_id}", response_model=list[InterviewSessionOut])
def get_user_interviews(user_id: str, db: Session = Depends(get_db)):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(400, "Invalid user_id")
    sessions = (
        db.query(models.InterviewSession)
        .filter(models.InterviewSession.user_id == uid)
        .order_by(models.InterviewSession.created_at.desc())
        .all()
    )
    return sessions


# ─── Get Single Interview ─────────────────────────────────────────────────────
@app.get("/{interview_id}", response_model=InterviewSessionOut)
def get_interview(interview_id: str, db: Session = Depends(get_db)):
    try:
        iid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(400, "Invalid interview_id")
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == iid
    ).first()
    if not session:
        raise HTTPException(404, "Interview not found")
    return session


# ─── Upload Video ─────────────────────────────────────────────────────────────
@app.post("/{interview_id}/upload")
async def upload_video(
    interview_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        iid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(400, "Invalid interview_id")

    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == iid
    ).first()
    if not session:
        raise HTTPException(404, "Interview not found")

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "webm"
    filename = f"{interview_id}.{ext}"
    contents = await file.read()

    if s3_client and S3_BUCKET:
        # Upload to S3 — works across any number of instances
        s3_key = f"videos/{filename}"
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=contents,
            ContentType="video/webm",
        )
        video_storage_path = f"s3://{S3_BUCKET}/{s3_key}"
        print(f"[Interview] Video uploaded to S3: {video_storage_path} ({len(contents):,} bytes)")
    else:
        # Local fallback (dev / no S3 configured)
        file_path = UPLOAD_DIR / filename
        with open(file_path, "wb") as f:
            f.write(contents)
        video_storage_path = str(file_path)
        print(f"[Interview] Video saved locally: {video_storage_path} ({len(contents):,} bytes)")

    session.video_storage_path = video_storage_path
    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)


    # Kick off evaluation asynchronously (fire and forget)
    questions_text = [q.content for q in session.questions]
    question_ids = [str(q.id) for q in session.questions]

    # Fetch profile data for resume-grounded evaluation
    eval_resume_text = ""
    eval_skills = ""
    eval_experience_years = 0
    eval_education = ""
    try:
        from sqlalchemy import text as sql_text
        row = db.execute(
            sql_text("SELECT skills, experience_years, education, resume_text FROM users WHERE id = :uid"),
            {"uid": str(session.user_id)}
        ).fetchone()
        if row:
            eval_skills = row[0] or ""
            eval_experience_years = row[1] or 0
            eval_education = row[2] or ""
            eval_resume_text = row[3] or ""
    except Exception as e:
        print(f"[Interview] Could not fetch profile for eval: {e}")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{EVALUATION_SERVICE_URL}/evaluation/start",
                json={
                    "interview_id":     str(session.id),
                    "video_path":       str(file_path),
                    "company":          session.company_name,
                    "job_description":  session.job_description,
                    "persona":          session.interviewer_persona,
                    "strictness":       session.strictness_level,
                    "questions":        questions_text,
                    "question_ids":     question_ids,
                    "resume_text":      eval_resume_text,
                    "skills":           eval_skills,
                    "experience_years": eval_experience_years,
                    "target_role":      session.target_role or "",
                    "education":        eval_education,
                },
            )
        session.status = "evaluating"
        db.commit()
        print(f"[Interview] Evaluation triggered for {interview_id}")
    except Exception as e:
        print(f"[Interview] Could not trigger evaluation: {e}")

    return {
        "message": "Video uploaded, evaluation started",
        "interview_id": interview_id,
        "size_bytes": len(contents),
        "status": session.status,
    }


# ─── Save Browser-Captured Per-Question Transcripts ──────────────────────────────
@app.post("/{interview_id}/transcripts")
async def save_transcripts(
    interview_id: str,
    data: dict,
    db: Session = Depends(get_db),
):
    """Save browser-captured per-question transcripts (from Web Speech API)."""
    try:
        iid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(400, "Invalid interview_id")

    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == iid
    ).first()
    if not session:
        raise HTTPException(404, "Interview not found")

    transcripts = data.get("transcripts", {})
    saved = 0
    for idx_str, text in transcripts.items():
        try:
            idx = int(idx_str)
        except ValueError:
            continue
        qs = session.questions
        if idx < len(qs):
            qs[idx].transcript = text
            saved += 1

    db.commit()
    print(f"[Interview] Saved {saved} browser transcripts for {interview_id}")
    return {"message": "Transcripts saved", "count": saved}


# ─── Evaluation Patch (called BY Evaluation Service) ─────────────────────────
@app.patch("/{interview_id}/evaluation")
def patch_evaluation(
    interview_id: str,
    patch: EvaluationPatch,
    db: Session = Depends(get_db),
):
    try:
        iid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(400, "Invalid interview_id")

    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == iid
    ).first()
    if not session:
        raise HTTPException(404, "Interview not found")

    if patch.overall_score is not None:
        session.overall_score = patch.overall_score
    if patch.feedback_summary is not None:
        session.feedback_summary = patch.feedback_summary
    if patch.status is not None:
        session.status = patch.status
    if patch.transcript is not None:
        session.transcript = patch.transcript

    # Save per-question transcripts and scores
    if patch.per_question_data:
        for pq in patch.per_question_data:
            q_id = pq.get("question_id")
            if not q_id:
                continue
            try:
                q_uuid = uuid.UUID(q_id)
            except ValueError:
                continue
            question = db.query(models.Question).filter(
                models.Question.id == q_uuid,
                models.Question.session_id == iid,
            ).first()
            if question:
                if pq.get("transcript"):
                    question.transcript = pq["transcript"]
                if pq.get("score") is not None:
                    question.score = pq["score"]
                if pq.get("evaluation"):
                    question.evaluation = pq["evaluation"]

    db.commit()
    return {"message": "Evaluation results saved", "interview_id": interview_id}

