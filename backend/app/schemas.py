from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Any
from datetime import datetime
import re


# ---------------------------------------------------------------------------
# Question Schemas
# ---------------------------------------------------------------------------

class QuestionBase(BaseModel):
    content: str

class QuestionCreate(QuestionBase):
    pass

class Question(QuestionBase):
    id: int
    session_id: int
    category: Optional[str] = None
    difficulty: Optional[int] = None
    order_index: int = 0

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Interview Session Schemas
# ---------------------------------------------------------------------------

class InterviewSessionBase(BaseModel):
    company_name: str
    job_description: str
    questions_count: int = 5
    duration_minutes: int = 15
    interviewer_persona: str = "neutral"
    strictness_level: str = "standard"
    target_role: Optional[str] = "Software Engineer"


class InterviewSessionCreate(InterviewSessionBase):
    pass


class InterviewSessionUpdate(BaseModel):
    status: Optional[str] = None
    overall_score: Optional[float] = None
    feedback_summary: Optional[str] = None
    completed_at: Optional[datetime] = None


class InterviewSession(InterviewSessionBase):
    id: int
    user_id: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    overall_score: Optional[float] = None
    feedback_summary: Optional[str] = None         # JSON string
    questions: List[Question] = []
    video_storage_path: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# User Schemas
# ---------------------------------------------------------------------------

class UserBase(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    target_role: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    bio: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password must be 8–128 characters with at least one uppercase letter, one lowercase letter, one digit, and one special character.",
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        errors = []
        if not re.search(r"[A-Z]", v):
            errors.append("at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            errors.append("at least one lowercase letter")
        if not re.search(r"\d", v):
            errors.append("at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+\[\];'/\\`~]", v):
            errors.append("at least one special character (!@#$%^&* etc.)")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}.")
        return v


class UserProfileUpdate(BaseModel):
    target_role: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    skills: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    bio: Optional[str] = None


# Full user schema (includes sensitive fields — use only for /users/me)
class User(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    interviews: List[InterviewSession] = []

    class Config:
        from_attributes = True


# Public-facing user schema (returned after signup — no session list)
class UserPublic(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Auth / Token Schemas
# ---------------------------------------------------------------------------

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class RefreshToken(BaseModel):
    """Represents a refresh token payload — used internally for validation."""
    sub: str
    exp: int
    type: str = "refresh"
