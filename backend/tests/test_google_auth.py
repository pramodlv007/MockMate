import httpx
from fastapi.testclient import TestClient
from services.auth import main as auth_main

CLIENT_ID = "test-client.apps.googleusercontent.com"


def _tokeninfo(monkeypatch, status=200, **claims):
    info = {"aud": CLIENT_ID, "email": "Ada@Example.com", "email_verified": "true", "name": "Ada", **claims}
    monkeypatch.setattr(httpx, "get", lambda *a, **k: httpx.Response(status, json=info))
    monkeypatch.setattr(auth_main, "GOOGLE_CLIENT_ID", CLIENT_ID)


def test_google_login_creates_then_reuses_user(monkeypatch):
    _tokeninfo(monkeypatch)
    c = TestClient(auth_main.app)
    first = c.post("/auth/google", json={"credential": "tok"})
    assert first.status_code == 200, first.text
    assert first.json()["user"]["email"] == "ada@example.com" and first.json()["access_token"]
    assert "refresh_token" in first.headers.get("set-cookie", "")
    second = c.post("/auth/google", json={"credential": "tok"})
    assert second.json()["user"]["id"] == first.json()["user"]["id"]
    # password login stays closed for a Google-created account
    assert c.post("/auth/login", data={"username": "ada@example.com", "password": ""}).status_code in (401, 422)


def test_google_login_rejects_other_audience_or_unverified(monkeypatch):
    c = TestClient(auth_main.app)
    _tokeninfo(monkeypatch, aud="someone-elses-app")
    assert c.post("/auth/google", json={"credential": "tok"}).status_code == 401
    _tokeninfo(monkeypatch, email_verified="false")
    assert c.post("/auth/google", json={"credential": "tok"}).status_code == 401
    _tokeninfo(monkeypatch, status=400)
    assert c.post("/auth/google", json={"credential": "bad"}).status_code == 401


def test_google_login_disabled_without_client_id(monkeypatch):
    monkeypatch.setattr(auth_main, "GOOGLE_CLIENT_ID", "")
    assert TestClient(auth_main.app).post("/auth/google", json={"credential": "tok"}).status_code == 503
