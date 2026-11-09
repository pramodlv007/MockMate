"""Run from backend/:  python -m pytest tests
Swaps the Postgres engine for in-memory SQLite before any service module is imported."""
import os, uuid
from datetime import datetime, timedelta

os.environ.pop("S3_BUCKET_NAME", None)
os.environ["INTERNAL_API_TOKEN"] = "test-internal-token"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import common.database as database

database.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=database.engine)

from jose import jwt
from fastapi.testclient import TestClient
from common.auth import SECRET_KEY, ALGORITHM
from services.interview import main as interview_main, models


def token_for(user_id: uuid.UUID) -> str:
    return jwt.encode({"user_id": str(user_id), "exp": datetime.utcnow() + timedelta(minutes=5)}, SECRET_KEY, algorithm=ALGORITHM)


def auth(user_id: uuid.UUID) -> dict:
    return {"Authorization": f"Bearer {token_for(user_id)}"}


@pytest.fixture
def client():
    return TestClient(interview_main.app)


@pytest.fixture
def make_session():
    """Insert an interview session (with one question) owned by user_id; returns its id."""
    def _make(user_id: uuid.UUID, status: str = "generated") -> uuid.UUID:
        db = database.SessionLocal()
        s = models.InterviewSession(user_id=user_id, company_name="Acme", job_description="jd", status=status)
        s.questions.append(models.Question(content="Tell me about yourself.", order_index=0))
        db.add(s)
        db.commit()
        sid = s.id
        db.close()
        return sid
    return _make
