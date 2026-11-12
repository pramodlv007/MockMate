from pydantic import BaseModel, EmailStr, Field
from typing import Literal, Optional
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
    accept_privacy: bool = False


class GoogleLogin(BaseModel):
    credential: str  # Google ID token (JWT)


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


class FeedbackIn(BaseModel):
    kind: Literal["support", "review"]
    message: str = Field(min_length=10, max_length=5000)
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    category: Optional[Literal["interview", "account", "privacy", "idea", "other"]] = None
    email: Optional[EmailStr] = None    # required when signed out; defaults to the account email
    page: Optional[str] = Field(default=None, max_length=200)


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
    privacy_accepted_at: Optional[datetime] = None

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
