"""
MockMate Auth Service — Port 8001
Handles: signup, login, refresh token, logout, /users/me
Refresh token stored in HttpOnly cookie; access token returned in JSON body.
"""
from fastapi import FastAPI, Depends, HTTPException, status, Response, Cookie, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import os, traceback
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from . import models, schemas, utils
from common.database import get_db, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MockMate Auth Service", version="2.0.0")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "type": type(exc).__name__, "traceback": tb}
    )


# ─── JWT config ───────────────────────────────────────────────────────────────
SECRET_KEY            = os.getenv("SECRET_KEY", "changeme-secret")
REFRESH_SECRET_KEY    = os.getenv("REFRESH_SECRET_KEY", "changeme-refresh-secret")
ALGORITHM             = os.getenv("ALGORITHM", "HS256")
ACCESS_EXPIRE_MINS    = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_EXPIRE_DAYS   = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
IS_PROD               = os.getenv("ENVIRONMENT", "development") == "production"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _make_access_token(user_id: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_EXPIRE_MINS)
    return jwt.encode(
        {"sub": email, "user_id": user_id, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )

def _make_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=REFRESH_EXPIRE_DAYS)
    return jwt.encode(
        {"user_id": user_id, "exp": expire, "type": "refresh"},
        REFRESH_SECRET_KEY, algorithm=ALGORITHM
    )

def _set_refresh_cookie(response: Response, token: str):
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=IS_PROD,
        samesite="lax",
        max_age=REFRESH_EXPIRE_DAYS * 86400,
        path="/auth/refresh",
    )

def _clear_refresh_cookie(response: Response):
    response.delete_cookie("refresh_token", path="/auth/refresh")


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise exc
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc

    import uuid
    user = db.query(models.User).filter(models.User.id == uuid.UUID(user_id)).first()
    if not user:
        raise exc
    return user


@app.get("/health")
def health():
    return {"status": "ok", "service": "auth"}


# ─── Signup ───────────────────────────────────────────────────────────────────
@app.post("/auth/signup", response_model=schemas.AuthResponse)
def signup(user_in: schemas.UserCreate, response: Response, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=user_in.email,
        hashed_password=utils.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        target_role=user_in.target_role,
        experience_years=user_in.experience_years,
        education=user_in.education,
        skills=user_in.skills,
        github_url=user_in.github_url,
        linkedin_url=user_in.linkedin_url,
        portfolio_url=user_in.portfolio_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token  = _make_access_token(str(user.id), user.email)
    refresh_token = _make_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)

    return schemas.AuthResponse(access_token=access_token, token_type="bearer", user=user)


# ─── Login ────────────────────────────────────────────────────────────────────
@app.post("/auth/login", response_model=schemas.AuthResponse)
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not utils.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.last_login_at = datetime.utcnow()
    db.commit()

    access_token  = _make_access_token(str(user.id), user.email)
    refresh_token = _make_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh_token)

    return schemas.AuthResponse(access_token=access_token, token_type="bearer", user=user)


# ─── Refresh ──────────────────────────────────────────────────────────────────
@app.post("/auth/refresh", response_model=schemas.TokenOnly)
def refresh_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    exc = HTTPException(status_code=401, detail="Invalid or expired refresh token")
    if not refresh_token:
        raise exc
    try:
        payload = jwt.decode(refresh_token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if payload.get("type") != "refresh" or not user_id:
            raise exc
    except JWTError:
        raise exc

    import uuid
    user = db.query(models.User).filter(models.User.id == uuid.UUID(user_id)).first()
    if not user:
        raise exc

    new_access  = _make_access_token(str(user.id), user.email)
    new_refresh = _make_refresh_token(str(user.id))
    _set_refresh_cookie(response, new_refresh)

    return schemas.TokenOnly(access_token=new_access, token_type="bearer")


# ─── Logout ───────────────────────────────────────────────────────────────────
@app.post("/auth/logout")
def logout(response: Response):
    _clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}


# ─── Get Current User ─────────────────────────────────────────────────────────
@app.get("/users/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.get("/users/me/interviews")
def get_my_interviews(
    current_user: models.User = Depends(get_current_user),
):
    """Stub — the interview service manages sessions. Gateway calls interview service directly."""
    return []


# ─── Update Profile ───────────────────────────────────────────────────────────
@app.put("/users/me/profile", response_model=schemas.UserOut)
def update_profile(
    update: schemas.ProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return current_user
