from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    target_role = Column(String, nullable=True)

    # Enhanced profile fields
    github_url = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)
    skills = Column(Text, nullable=True)        # Comma-separated or JSON
    experience_years = Column(Integer, nullable=True)
    education = Column(String, nullable=True)
    bio = Column(Text, nullable=True)

    # Security and status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_login_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    interviews = relationship("InterviewSession", back_populates="owner")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    company_name = Column(String, nullable=False)
    job_description = Column(Text, nullable=False)
    questions_count = Column(Integer, default=5)
    duration_minutes = Column(Integer, default=15)

    interviewer_persona = Column(String, default="neutral")
    strictness_level = Column(String, default="standard")
    target_role = Column(String, nullable=True)

    video_storage_path = Column(String, nullable=True)

    # Status lifecycle:
    # created → started → completed → evaluating → evaluated | error
    status = Column(String, default="created")

    # Evaluation results
    overall_score = Column(Float, nullable=True)
    feedback_summary = Column(Text, nullable=True)   # JSON stored as text

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="interviews")
    questions = relationship("Question", back_populates="session", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"))
    content = Column(Text, nullable=False)
    category = Column(String, nullable=True)        # technical, behavioral, system_design, culture_fit
    difficulty = Column(Integer, nullable=True)     # 1-5
    order_index = Column(Integer, default=0)

    session = relationship("InterviewSession", back_populates="questions")
