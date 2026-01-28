from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from .. import crud, models, schemas
from ..database import get_db
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
    current_user: models.User = Depends(get_current_user)
):
    # 1. Create Session
    db_session = crud.create_interview_session(db, interview, current_user.id)
    
    # 2. Build user profile context for AI
    user_profile = {
        "skills": current_user.skills,
        "experience_years": current_user.experience_years,
        "education": current_user.education,
        "bio": current_user.bio,
        "target_role": current_user.target_role,
        "github_url": current_user.github_url,
        "linkedin_url": current_user.linkedin_url
    }
    
    # 3. Generate Questions with user context
    questions = ai_service.generate_questions(
        interview.company_name, 
        interview.job_description, 
        interview.questions_count,
        user_profile,
        persona=interview.interviewer_persona,
        strictness=interview.strictness_level
    )

    
    # 4. Store Questions
    for q_content in questions:
        crud.add_question(db, db_session.id, q_content)
    
    # Refresh to get questions
    db.refresh(db_session)
    return db_session

@router.get("/{interview_id}", response_model=schemas.InterviewSession)
def get_interview(interview_id: int, db: Session = Depends(get_db)):
    interview = crud.get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview

def process_video_evaluation(interview_id: int, video_path: str, db: Session):
    # This should run in background or separate worker
    try:
        # Re-fetch interview in new session if needed, but we passed db (careful with threading, usually new session preferred)
        # For simplicity here, we assume single threaded simple worker or we treat db carefully.
        # Actually safer to create new session here if it was async, but BackgroundTasks runs in same loop. 
        # Let's just use the logic but ideally we'd manage session better.
        
        # We need the interview data
        interview = crud.get_interview(db, interview_id)
        if not interview:
            return

        result = ai_service.evaluate_interview(video_path, interview.company_name, interview.job_description)
        
        crud.update_interview_feedback(
            db, 
            interview_id, 
            score=result.get("score"), 
            feedback=json.dumps(result.get("feedback"))
        )
    except Exception as e:
        print(f"Error processing video: {e}")

@router.post("/{interview_id}/upload")
def upload_video(
    interview_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    interview = crud.get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    file_location = os.path.join(UPLOAD_DIR, f"{interview_id}_{file.filename}")
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(file.file, file_object)
        
    crud.update_interview_video(db, interview_id, file_location)
    
    # Trigger AI Evaluation in Background
    # Note: verify db session thread safety for background tasks. 
    # Usually better to pass ID and create new session in the task function.
    # Refactoring slightly for robustness:
    background_tasks.add_task(evaluate_task, interview_id, file_location)
    
    return {"status": "uploaded", "file_path": file_location}

def evaluate_task(interview_id: int, video_path: str):
    # Create a new session for the background task
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        interview = crud.get_interview(db, interview_id)
        if interview:
             result = ai_service.evaluate_interview(
                 video_path, 
                 interview.company_name, 
                 interview.job_description,
                 persona=interview.interviewer_persona,
                 strictness=interview.strictness_level
             )

             crud.update_interview_feedback(
                db, 
                interview_id, 
                score=result.get("score"), 
                feedback=json.dumps(result.get("feedback"))
            )
    finally:
        db.close()
