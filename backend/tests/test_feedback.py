import smtplib
import pytest
from fastapi.testclient import TestClient
from common import database
from services.auth import main as auth_main, models

MSG = "The camera preview froze on question two."


@pytest.fixture
def c():
    auth_main.limiter.reset()
    return TestClient(auth_main.app)


@pytest.fixture
def sent(monkeypatch):
    """Captures what would be emailed instead of talking to Gmail."""
    out = []
    class FakeSMTP:
        def __init__(self, host, port, timeout): out.append({"host": host, "port": port})
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def starttls(self): pass
        def login(self, u, p): out[-1]["login"] = u
        def send_message(self, m): out[-1]["msg"] = m
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    for k, v in {"SMTP_HOST": "smtp.gmail.com", "SMTP_USER": "mockmate.site@gmail.com", "SMTP_PASSWORD": "app-pw"}.items():
        monkeypatch.setenv(k, v)
    monkeypatch.delenv("FEEDBACK_TO", raising=False)
    return out


def _row(fid):
    db = database.SessionLocal()
    try:
        import uuid
        return db.get(models.Feedback, uuid.UUID(fid))
    finally:
        db.close()


def test_support_request_signed_out_is_stored_and_emailed(c, sent):
    r = c.post("/users/feedback", json={"kind": "support", "category": "interview", "message": MSG,
                                        "email": "visitor@example.com", "page": "/interview/123"})
    assert r.status_code == 201, r.text
    msg = sent[0]["msg"]
    assert msg["To"] == "mockmate.site@gmail.com" and msg["Reply-To"] == "visitor@example.com"
    assert msg["Subject"] == "[MockMate support] Interview or practice problem"
    assert MSG in msg.get_content() and "/interview/123" in msg.get_content()
    assert _row(r.json()["id"]).emailed_at is not None


def test_review_uses_account_email_and_needs_stars(c, sent):
    body = c.post("/auth/signup", json={"email": "rev@example.com", "password": "Passw0rd!x", "full_name": "R",
                                        "accept_privacy": True}).json()
    h = {"Authorization": f"Bearer {body['access_token']}"}
    assert c.post("/users/feedback", json={"kind": "review", "message": MSG}, headers=h).status_code == 400
    r = c.post("/users/feedback", json={"kind": "review", "rating": 4, "message": MSG}, headers=h)
    assert r.status_code == 201
    assert sent[-1]["msg"]["Subject"] == "[MockMate review] 4/5" and sent[-1]["msg"]["Reply-To"] == "rev@example.com"
    assert str(_row(r.json()["id"]).user_id) == body["user"]["id"]

    # deleting the account deletes its messages
    assert c.delete("/users/me", headers=h).status_code == 204
    assert _row(r.json()["id"]) is None


def test_rejects_bad_input(c, sent):
    assert c.post("/users/feedback", json={"kind": "support", "message": MSG}).status_code == 400   # signed out, no email
    assert c.post("/users/feedback", json={"kind": "support", "message": "short", "email": "a@b.co"}).status_code == 422
    assert c.post("/users/feedback", json={"kind": "review", "rating": 6, "message": MSG, "email": "a@b.co"}).status_code == 422
    assert c.post("/users/feedback", json={"kind": "spam", "message": MSG, "email": "a@b.co"}).status_code == 422
    assert sent == []


def test_kept_when_email_not_configured_or_failing(c, sent, monkeypatch):
    monkeypatch.delenv("SMTP_HOST")
    r = c.post("/users/feedback", json={"kind": "support", "message": MSG, "email": "v@example.com"})
    assert r.status_code == 201 and _row(r.json()["id"]).emailed_at is None

    monkeypatch.setenv("SMTP_HOST", "smtp.gmail.com")
    def down(*a, **k): raise OSError("network down")
    monkeypatch.setattr(smtplib, "SMTP", down)
    r = c.post("/users/feedback", json={"kind": "support", "message": MSG, "email": "v@example.com"})
    assert r.status_code == 201 and _row(r.json()["id"]).emailed_at is None   # saved, user still told it was sent


def test_rate_limited(c, sent):
    for _ in range(5):
        assert c.post("/users/feedback", json={"kind": "support", "message": MSG, "email": "v@example.com"}).status_code == 201
    assert c.post("/users/feedback", json={"kind": "support", "message": MSG, "email": "v@example.com"}).status_code == 429
