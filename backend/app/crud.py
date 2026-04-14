from sqlalchemy.orm import Session
from . import models, schemas, auth
from datetime import datetime


def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return False
    if not auth.verify_password(password, user.hashed_password):
        return False
    # Update last login timestamp
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = auth.get_password_hash(user.password)
    user_data = user.model_dump(exclude={"password"})
    db_user = models.User(
        **user_data,
        hashed_password=hashed_password,
        is_active=True,
        is_verified=False,
    )
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


# ---------------------------------------------------------------------------
# Interview CRUD
# ---------------------------------------------------------------------------

def create_interview_session(db: Session, interview: schemas.InterviewSessionCreate, user_id: int):
    db_interview = models.InterviewSession(
        **interview.model_dump(),
        user_id=user_id,
        status="created",
    )
    db.add(db_interview)
    db.commit()
    db.refresh(db_interview)
    return db_interview


def get_interview(db: Session, interview_id: int):
    return (
        db.query(models.InterviewSession)
        .filter(models.InterviewSession.id == interview_id)
        .first()
    )


def get_user_interviews(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return (
        db.query(models.InterviewSession)
        .filter(models.InterviewSession.user_id == user_id)
        .order_by(models.InterviewSession.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_interview_video(db: Session, interview_id: int, video_path: str):
    interview = get_interview(db, interview_id)
    if interview:
        interview.video_storage_path = video_path
        interview.status = "evaluating"
        interview.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(interview)
    return interview


def update_interview_feedback(db: Session, interview_id: int, score: float, feedback: str):
    """Store the AI evaluation result. feedback is a JSON string."""
    interview = get_interview(db, interview_id)
    if interview:
        interview.overall_score = score
        interview.feedback_summary = feedback   # JSON text
        interview.status = "evaluated"
        db.commit()
        db.refresh(interview)
    return interview


def update_interview_status(db: Session, interview_id: int, status: str):
    interview = get_interview(db, interview_id)
    if interview:
        interview.status = status
        db.commit()
        db.refresh(interview)
    return interview


def add_question(db: Session, session_id: int, content: str, category: str = None, difficulty: int = None, order_index: int = 0):
    db_question = models.Question(
        session_id=session_id,
        content=content,
        category=category,
        difficulty=difficulty,
        order_index=order_index,
    )
    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    return db_question
