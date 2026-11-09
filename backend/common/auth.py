"""Shared JWT auth dependency — used by services that previously relied on the
gateway injecting x-user-id. Validates the Bearer token directly."""
import hmac, os, secrets
from fastapi import HTTPException, Depends, Header
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from dotenv import dotenv_values
from pathlib import Path

# Priority: runtime env vars (Docker --env-file, Railway, etc.) > .env file baked into image
# This prevents stale .env files in Docker images from overriding deployment secrets.
_config = dotenv_values(Path(__file__).parent.parent / ".env")
SECRET_KEY = os.getenv("SECRET_KEY") or _config.get("SECRET_KEY") or "changeme-secret"
ALGORITHM  = os.getenv("ALGORITHM")  or _config.get("ALGORITHM")  or "HS256"

# Shared secret for service-to-service calls (evaluation <-> interview).
# shortcut: when unset, a random per-process token is used; fine for the single-process consolidated app,
# but set INTERNAL_API_TOKEN explicitly if services ever run as separate processes or multiple workers.
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN") or _config.get("INTERNAL_API_TOKEN") or secrets.token_urlsafe(32)
INTERNAL_HEADERS = {"X-Internal-Token": INTERNAL_API_TOKEN}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user_id(token: str = Depends(oauth2_scheme)) -> str:
    """Return user_id from the Bearer token. No x-user-id fallback: clients can set any header,
    and the gateway forwards Authorization anyway."""
    if token:
        try:
            user_id = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM]).get("user_id")
            if user_id:
                return user_id
        except JWTError:
            pass
    raise HTTPException(status_code=401, detail="Not authenticated")


def is_internal(x_internal_token: str = Header(default="")) -> bool:
    return bool(x_internal_token) and hmac.compare_digest(x_internal_token, INTERNAL_API_TOKEN)


def require_internal(internal: bool = Depends(is_internal)) -> None:
    if not internal:
        raise HTTPException(status_code=403, detail="Internal endpoint")


def get_optional_user_id(token: str = Depends(oauth2_scheme)):
    """Like get_current_user_id but returns None instead of raising (for endpoints also open to internal callers)."""
    try:
        return get_current_user_id(token)
    except HTTPException:
        return None


def user_or_ip_key(request) -> str:
    """slowapi key: the caller's user_id from the Bearer token, else client IP."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            uid = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGORITHM]).get("user_id")
            if uid:
                return f"user:{uid}"
        except JWTError:
            pass
    return f"ip:{request.client.host if request.client else 'unknown'}"
