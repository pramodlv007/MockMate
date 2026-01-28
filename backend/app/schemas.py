from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class QuestionBase(BaseModel):
    content: str

class QuestionCreate(QuestionBase):
    pass

class Question(QuestionBase):
    id: int
    session_id: int

    class Config:
        from_attributes = True

class InterviewSessionBase(BaseModel):
    company_name: str
    job_description: str
    questions_count: int
    duration_minutes: int
    interviewer_persona: str = "neutral"
    strictness_level: str = "standard"


class InterviewSessionCreate(InterviewSessionBase):
    pass # valid for creation

class InterviewSession(InterviewSessionBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    ai_score: Optional[float] = None
    ai_feedback: Optional[str] = None
    questions: List[Question] = []
    video_storage_path: Optional[str] = None

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    username: str
    email: str
    target_role: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    bio: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserProfileUpdate(BaseModel):
    target_role: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    bio: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(UserBase):
    id: int
    created_at: datetime
    interviews: List[InterviewSession] = []

    class Config:
        from_attributes = True

