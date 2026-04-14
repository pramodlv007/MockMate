from sqlalchemy import Column, String, Integer, Text, DateTime, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from common.database import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id                  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id             = Column(UUID(as_uuid=True), index=True, nullable=False)

    company_name        = Column(String, nullable=False)
    target_role         = Column(String, nullable=True)
    job_description     = Column(Text, nullable=False)
    questions_count     = Column(Integer, default=5)
    duration_minutes    = Column(Integer, default=15)

    interviewer_persona = Column(String, default="neutral")
    strictness_level    = Column(String, default="standard")

    video_storage_path  = Column(String, nullable=True)
    transcript          = Column(Text, nullable=True)      # Full interview transcript

    # Status lifecycle: created → generated → completed → evaluating → evaluated | error
    status              = Column(String, default="created")

    overall_score       = Column(Float, nullable=True)
    feedback_summary    = Column(Text, nullable=True)   # JSON string

    created_at          = Column(DateTime, default=datetime.utcnow)
    completed_at        = Column(DateTime, nullable=True)

    questions = relationship("Question", back_populates="session", cascade="all, delete-orphan",
                             order_by="Question.order_index")


class Question(Base):
    __tablename__ = "questions"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id  = Column(UUID(as_uuid=True), ForeignKey("interview_sessions.id"), nullable=False)
    content     = Column(Text, nullable=False)
    category    = Column(String, nullable=True)     # TECHNICAL | BEHAVIORAL | SYSTEM_DESIGN | CULTURE_FIT
    difficulty  = Column(Integer, nullable=True)    # 1-5
    order_index = Column(Integer, default=0)
    transcript  = Column(Text, nullable=True)       # Per-question answer transcript
    score       = Column(Float, nullable=True)      # Per-question score 0-100
    evaluation  = Column(Text, nullable=True)       # JSON per-question eval

    session = relationship("InterviewSession", back_populates="questions")
