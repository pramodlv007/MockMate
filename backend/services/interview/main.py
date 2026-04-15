"""
MockMate Interview Service — Port 8004
Manages interview sessions: create, fetch, upload video, patch evaluation results.
Calls Question Service to generate questions on session creation.
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Request
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
    x_user_id: str = Header(None),
):
    # Resolve user_id from header or body
    user_id_str = x_user_id or data.get("user_id")
    if not user_id_str:
        raise HTTPException(401, "Not authenticated")

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
    file_path = UPLOAD_DIR / filename

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    session.video_storage_path = str(file_path)
    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)

    print(f"[Interview] Video saved: {file_path} ({len(contents):,} bytes)")

    # Kick off evaluation asynchronously (fire and forget)
    questions_text = [q.content for q in session.questions]
    question_ids = [str(q.id) for q in session.questions]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{EVALUATION_SERVICE_URL}/evaluation/start",
                json={
                    "interview_id":   str(session.id),
                    "video_path":     str(file_path),
                    "company":        session.company_name,
                    "job_description": session.job_description,
                    "persona":        session.interviewer_persona,
                    "strictness":     session.strictness_level,
                    "questions":      questions_text,
                    "question_ids":   question_ids,
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

