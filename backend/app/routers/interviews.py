from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas
from ..database import get_db, SessionLocal
from ..services.ai_service import ai_service
from .auth import get_current_user
import shutil
import os
import json

router = APIRouter(
    prefix="/interviews",
    tags=["interviews"],
)

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)


@router.post("/", response_model=schemas.InterviewSession)
def create_interview(
    interview: schemas.InterviewSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new interview session and generate AI questions."""
    # 1. Create session record
    db_session = crud.create_interview_session(db, interview, current_user.id)

    # 2. Build user profile context for AI
    user_profile = {
        "skills": current_user.skills or "",
        "experience_years": current_user.experience_years or 0,
        "education": current_user.education or "",
        "bio": current_user.bio or "",
        "target_role": interview.target_role or current_user.target_role or "Software Engineer",
        "github_url": current_user.github_url or "",
        "linkedin_url": current_user.linkedin_url or "",
    }

    # 3. Generate questions with user context
    questions = ai_service.generate_questions(
        company=interview.company_name,
        jd=interview.job_description,
        count=interview.questions_count,
        user_profile=user_profile,
        persona=interview.interviewer_persona,
        strictness=interview.strictness_level,
    )

    # 4. Persist questions
    for idx, q_content in enumerate(questions):
        crud.add_question(db, db_session.id, q_content, order_index=idx)

    # 5. Mark as ready
    db_session.status = "started"
    db.commit()
    db.refresh(db_session)
    return db_session


@router.get("/", response_model=List[schemas.InterviewSession])
def list_interviews(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all interviews for the authenticated user."""
    return crud.get_user_interviews(db, current_user.id)


@router.get("/{interview_id}", response_model=schemas.InterviewSession)
def get_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    interview = crud.get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    if interview.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your interview")
    return interview


@router.post("/{interview_id}/upload")
def upload_video(
    interview_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None,
    current_user: models.User = Depends(get_current_user),
):
    """Upload recorded video. Triggers AI evaluation in background."""
    interview = crud.get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    if interview.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your interview")

    # Save video file
    video_dir = os.path.join(UPLOAD_DIR, "videos")
    os.makedirs(video_dir, exist_ok=True)
    file_location = os.path.join(video_dir, f"{interview_id}_{file.filename}")

    with open(file_location, "wb+") as fobj:
        shutil.copyfileobj(file.file, fobj)

    # Update DB with video path and set status → evaluating
    crud.update_interview_video(db, interview_id, file_location)

    # Run AI evaluation asynchronously
    if background_tasks:
        background_tasks.add_task(
            _evaluate_task,
            interview_id=interview_id,
            video_path=file_location,
            company_name=interview.company_name,
            job_description=interview.job_description,
            persona=interview.interviewer_persona,
            strictness=interview.strictness_level,
        )

    return {"status": "uploaded", "message": "Video uploaded. AI evaluation started.", "interview_id": interview_id}


# ---------------------------------------------------------------------------
# Background evaluation task
# ---------------------------------------------------------------------------

def _evaluate_task(
    interview_id: int,
    video_path: str,
    company_name: str,
    job_description: str,
    persona: str,
    strictness: str,
):
    """Full AI evaluation running in the background after video upload."""
    db = SessionLocal()
    try:
        result = ai_service.evaluate_interview(
            video_path=video_path,
            company=company_name,
            jd=job_description,
            persona=persona,
            strictness=strictness,
        )
        score = result.get("score", 0)
        feedback_json = json.dumps(result.get("feedback", {}))
        crud.update_interview_feedback(db, interview_id, score=score, feedback=feedback_json)
        print(f"[EvaluateTask] Interview {interview_id} evaluated. Score: {score}")
    except Exception as e:
        print(f"[EvaluateTask] Error evaluating interview {interview_id}: {e}")
        crud.update_interview_status(db, interview_id, "error")
    finally:
        db.close()
