import uuid
from fastapi.testclient import TestClient
from services.auth import main as auth_main
from tests.conftest import auth

SIGNUP = {"email": "Grace@Example.com", "password": "Passw0rd!x", "full_name": "Grace"}


def _signup(c, **extra):
    return c.post("/auth/signup", json={**SIGNUP, **extra})


def test_signup_requires_and_records_privacy_consent():
    c = TestClient(auth_main.app)
    refused = _signup(c)
    assert refused.status_code == 400 and "privacy" in refused.json()["detail"]
    ok = _signup(c, accept_privacy=True)
    assert ok.status_code == 200, ok.text
    assert ok.json()["user"]["privacy_accepted_at"]


def test_accept_privacy_later():
    c = TestClient(auth_main.app)
    tok = _signup(c, email="later@example.com", accept_privacy=True).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    first = c.get("/users/me", headers=h).json()["privacy_accepted_at"]
    again = c.post("/users/me/privacy", headers=h)
    assert again.status_code == 200 and again.json()["privacy_accepted_at"] >= first
    assert c.post("/users/me/privacy").status_code == 401


def test_delete_account_needs_interviews_gone_first(make_session):
    c = TestClient(auth_main.app)
    body = _signup(c, email="leaver@example.com", accept_privacy=True).json()
    uid = uuid.UUID(body["user"]["id"])
    h = {"Authorization": f"Bearer {body['access_token']}"}
    make_session(uid)

    assert c.delete("/users/me", headers=h).status_code == 409          # a recording would be orphaned
    from services.interview import main as interview_main
    sid = TestClient(interview_main.app).get("/user/me", headers=auth(uid)).json()[0]["id"]
    assert TestClient(interview_main.app).delete(f"/{sid}", headers=auth(uid)).status_code == 204

    assert c.delete("/users/me", headers=h).status_code == 204
    assert c.get("/users/me", headers=h).status_code == 401              # the account is gone
    assert c.post("/auth/login", data={"username": "leaver@example.com", "password": "Passw0rd!x"}).status_code == 401


def test_server_errors_do_not_leak_details(monkeypatch):
    def boom(*a, **k): raise RuntimeError("SELECT secret FROM users")
    monkeypatch.setattr(auth_main, "_find_user", boom)
    r = TestClient(auth_main.app, raise_server_exceptions=False).post("/auth/signup", json={**SIGNUP, "accept_privacy": True})
    assert r.status_code == 500
    assert r.json() == {"detail": "Something went wrong on our side. Please try again."}
