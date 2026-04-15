from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


# ─── Input Schemas ─────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    target_role: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    skills: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    target_role: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    skills: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    bio: Optional[str] = None
    resume_text: Optional[str] = None


# ─── Output Schemas ────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: Optional[str] = None
    target_role: Optional[str] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    skills: Optional[str] = None
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    bio: Optional[str] = None
    resume_text: Optional[str] = None
    is_verified: bool = False
    created_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Auth Response Schemas ─────────────────────────────────────────────────────
class TokenOnly(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
