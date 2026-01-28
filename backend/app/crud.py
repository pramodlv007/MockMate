from sqlalchemy.orm import Session
from . import models, schemas, auth

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    # Convert schema to dict, exclude password, add hashed_password
    user_data = user.model_dump(exclude={"password"})
    db_user = models.User(**user_data, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_profile(db: Session, user_id: int, profile_data: schemas.UserProfileUpdate):
    user = get_user(db, user_id)
    if user:
        update_data = profile_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        db.commit()
        db.refresh(user)
    return user

def create_interview_session(db: Session, interview: schemas.InterviewSessionCreate, user_id: int):
    db_interview = models.InterviewSession(
        **interview.model_dump(),
        user_id=user_id,
        status="started"
    )

    db.add(db_interview)
    db.commit()
    db.refresh(db_interview)
    return db_interview

def get_interview(db: Session, interview_id: int):
    return db.query(models.InterviewSession).filter(models.InterviewSession.id == interview_id).first()

def get_user_interviews(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.InterviewSession).filter(models.InterviewSession.user_id == user_id).order_by(models.InterviewSession.created_at.desc()).offset(skip).limit(limit).all()

def update_interview_video(db: Session, interview_id: int, video_path: str):
    interview = get_interview(db, interview_id)
    if interview:
        interview.video_storage_path = video_path
        interview.status = "completed"
        db.commit()
        db.refresh(interview)
    return interview

def update_interview_feedback(db: Session, interview_id: int, score: float, feedback: str):
    interview = get_interview(db, interview_id)
    if interview:
        interview.ai_score = score
        interview.ai_feedback = feedback
        interview.status = "evaluated"
        db.commit()
        db.refresh(interview)
    return interview

def add_question(db: Session, session_id: int, content: str):
    db_question = models.Question(session_id=session_id, content=content)
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return db_question
