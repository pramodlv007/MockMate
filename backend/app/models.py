from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    target_role = Column(String, nullable=True)
    
    # Enhanced profile fields
    github_url = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)
    skills = Column(Text, nullable=True)  # Comma-separated or JSON
    experience_years = Column(Integer, nullable=True)
    education = Column(String, nullable=True)
    bio = Column(Text, nullable=True)  # Brief summary
    
    created_at = Column(DateTime, default=datetime.utcnow)

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
    
    video_storage_path = Column(String, nullable=True)

    
    # Status: 'started', 'completed', 'evaluated'
    status = Column(String, default="started") 
    
    ai_score = Column(Float, nullable=True)
    ai_feedback = Column(Text, nullable=True) # JSON stored as text
    
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="interviews")
    questions = relationship("Question", back_populates="session", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("interview_sessions.id"))
    content = Column(Text, nullable=False)
    # Could store time_allocated if needed
    
    session = relationship("InterviewSession", back_populates="questions")
