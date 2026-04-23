"""Shared JWT auth dependency — used by services that previously relied on the
gateway injecting x-user-id. Validates the Bearer token directly."""
import os
from fastapi import Header, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from dotenv import dotenv_values
from pathlib import Path

# Priority: runtime env vars (Docker --env-file, Railway, etc.) > .env file baked into image
# This prevents stale .env files in Docker images from overriding deployment secrets.
_config = dotenv_values(Path(__file__).parent.parent / ".env")
SECRET_KEY = os.getenv("SECRET_KEY") or _config.get("SECRET_KEY") or "changeme-secret"
ALGORITHM  = os.getenv("ALGORITHM")  or _config.get("ALGORITHM")  or "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user_id(
    token: str = Depends(oauth2_scheme),
    x_user_id: str = Header(None),          # keep gateway header as fallback
) -> str:
    """Return user_id from Bearer token or x-user-id header (gateway compat)."""
    # Try JWT first
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("user_id")
            if user_id:
                return user_id
        except JWTError:
            pass
    # Fallback: gateway-injected header
    if x_user_id:
        return x_user_id
    raise HTTPException(status_code=401, detail="Not authenticated")
