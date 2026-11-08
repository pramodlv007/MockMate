"""Shared JWT auth dependency — used by services that previously relied on the
gateway injecting x-user-id. Validates the Bearer token directly."""
import os
from fastapi import HTTPException, Depends
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
