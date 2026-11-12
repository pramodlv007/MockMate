"""
MockMate Auth Service — Port 8001
Handles: signup, login, refresh token, logout, /users/me
Refresh token stored in HttpOnly cookie; access token returned in JSON body.
"""
from fastapi import FastAPI, Depends, HTTPException, status, Response, Cookie, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import os, secrets, smtplib, traceback, httpx
from email.message import EmailMessage
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent.parent / ".env")

from . import models, schemas, utils
from common import database
from common.auth import get_optional_user_id, user_or_ip_key
from common.database import get_db, create_tables

create_tables()


def _find_user(db: Session, email: str):
    # Case/space-insensitive so "Me@Gmail.com " finds "me@gmail.com" (older rows may be mixed-case)
    return db.query(models.User).filter(func.lower(models.User.email) == email.strip().lower()).first()


app = FastAPI(title="MockMate Auth Service", version="2.0.0")
limiter = Limiter(key_func=user_or_ip_key, storage_uri=os.getenv("REDIS_URL") or "memory://")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # details go to the server log only: error text can contain SQL, file paths or the user's own data
    traceback.print_exception(type(exc), exc, exc.__traceback__)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Please try again."})


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
    if not user_in.accept_privacy:
        raise HTTPException(status_code=400, detail="Please confirm you are 18 or older and accept the privacy notice.")
    if _find_user(db, user_in.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=user_in.email.strip().lower(),
        hashed_password=utils.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        target_role=user_in.target_role,
        experience_years=user_in.experience_years,
        education=user_in.education,
        skills=user_in.skills,
        github_url=user_in.github_url,
        linkedin_url=user_in.linkedin_url,
        portfolio_url=user_in.portfolio_url,
        privacy_accepted_at=datetime.utcnow(),
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
    user = _find_user(db, form_data.username)
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


# ─── Google Sign-In ───────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

@app.post("/auth/google", response_model=schemas.AuthResponse)
def google_login(body: schemas.GoogleLogin, response: Response, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    # shortcut: tokeninfo is one HTTP call per login; switch to local google-auth verification if volume grows
    r = httpx.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": body.credential}, timeout=10)
    info = r.json() if r.status_code == 200 else {}
    if info.get("aud") != GOOGLE_CLIENT_ID or info.get("email_verified") not in (True, "true"):
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    email = info["email"].lower()
    user = _find_user(db, email)
    if not user:
        # hashed_password is NOT NULL; an unguessable random password keeps password login closed for this account
        user = models.User(
            email=email,
            hashed_password=utils.get_password_hash(secrets.token_urlsafe(32)),
            full_name=info.get("name"),
            is_verified=True,
        )
        db.add(user)
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    _set_refresh_cookie(response, _make_refresh_token(str(user.id)))
    return schemas.AuthResponse(access_token=_make_access_token(str(user.id), user.email), token_type="bearer", user=user)


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


@app.post("/users/me/privacy", response_model=schemas.UserOut)
def accept_privacy(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Records that the user accepted the current privacy notice (Google sign-ups and older accounts)."""
    current_user.privacy_accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return current_user


@app.delete("/users/me", status_code=204)
def delete_account(
    response: Response,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes the account. Interviews go first through DELETE /interviews/{id}, which also removes the
    recording from storage, so this refuses while any remain rather than orphaning a recording."""
    from services.interview.models import InterviewSession
    if db.query(InterviewSession.id).filter(InterviewSession.user_id == current_user.id).first():
        raise HTTPException(status_code=409, detail="Delete your interviews first.")
    db.query(models.Feedback).filter(models.Feedback.user_id == current_user.id).delete()
    db.delete(current_user)
    db.commit()
    _clear_refresh_cookie(response)


# ─── Support & reviews ────────────────────────────────────────────────────────
FEEDBACK_TOPICS = {"interview": "Interview or practice problem", "account": "Account or sign-in",
                   "privacy": "Privacy or my data", "idea": "Idea or feature request", "other": "Something else"}


def _email_feedback(feedback_id) -> None:
    """Runs after the response. Needs SMTP_HOST/SMTP_USER/SMTP_PASSWORD (Gmail + app password, or a relay such as Brevo);
    without them the message stays in the feedback table only."""
    host, user, password = os.getenv("SMTP_HOST"), os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD")
    if not (host and user and password):
        print("[Feedback] SMTP not configured; message kept in the feedback table only")
        return
    db = database.SessionLocal()
    try:
        f = db.get(models.Feedback, feedback_id)
        msg = EmailMessage()
        # subject is built from validated fields only; the user's text stays in the body
        msg["Subject"] = (f"[MockMate review] {f.rating}/5" if f.kind == "review"
                          else f"[MockMate support] {FEEDBACK_TOPICS.get(f.category or 'other')}")
        msg["From"] = os.getenv("SMTP_FROM") or user   # relays like Brevo log in with an ID that is not an address
        msg["To"] = os.getenv("FEEDBACK_TO", "mockmate.site@gmail.com")
        msg["Reply-To"] = f.email
        msg.set_content("\n".join([
            f.message, "", "---",
            f"From: {f.email}",
            f"Account: {f.user_id or 'not signed in'}",
            f"Page: {f.page or '-'}",
            f"Sent: {f.created_at:%Y-%m-%d %H:%M} UTC",
            f"ID: {f.id}",
        ]))
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as s:
            s.starttls()
            s.login(user, password)
            s.send_message(msg)
        f.emailed_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        print(f"[Feedback] email failed for {feedback_id}: {e!r}")
    finally:
        db.close()


@app.post("/users/feedback", status_code=201)
@limiter.limit(os.getenv("FEEDBACK_RATE_LIMIT", "5/hour"))
def send_feedback(
    request: Request,
    body: schemas.FeedbackIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """Help requests and reviews, signed in or not. Stored first, then emailed to the team inbox."""
    import uuid
    user = db.query(models.User).filter(models.User.id == uuid.UUID(user_id)).first() if user_id else None
    email = body.email or (user.email if user else None)
    if not email:
        raise HTTPException(status_code=400, detail="Please add your email so we can reply.")
    if body.kind == "review" and not body.rating:
        raise HTTPException(status_code=400, detail="Please choose a star rating.")
    f = models.Feedback(kind=body.kind, category=body.category if body.kind == "support" else None,
                        rating=body.rating if body.kind == "review" else None, message=body.message.strip(),
                        email=str(email), user_id=user.id if user else None, page=body.page)
    db.add(f)
    db.commit()
    background.add_task(_email_feedback, f.id)
    return {"id": str(f.id)}


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
