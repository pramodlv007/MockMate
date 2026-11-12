"""Signing keys must never come from the (public) source code."""
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from jose import jwt

from services.auth import main as auth_main

LEAKED_DEFAULTS = ("changeme-refresh-secret", "changeme-secret")


def _refresh_cookie(key: str, user_id: str) -> dict:
    tok = jwt.encode({"user_id": user_id, "exp": datetime.utcnow() + timedelta(days=1), "type": "refresh"},
                     key, algorithm=auth_main.ALGORITHM)
    return {"Cookie": f"refresh_token={tok}"}


def test_refresh_only_accepts_the_configured_key():
    c = TestClient(auth_main.app)
    r = c.post("/auth/signup", json={"email": "keys@example.com", "password": "Passw0rd!x", "full_name": "K"})
    assert r.status_code == 200, r.text
    uid = r.json()["user"]["id"]

    for leaked in LEAKED_DEFAULTS:
        assert c.post("/auth/refresh", headers=_refresh_cookie(leaked, uid)).status_code == 401

    ok = c.post("/auth/refresh", headers=_refresh_cookie(auth_main.REFRESH_SECRET_KEY, uid))
    assert ok.status_code == 200 and ok.json()["access_token"]


def test_no_signing_key_is_a_published_default():
    assert auth_main.SECRET_KEY not in LEAKED_DEFAULTS
    assert auth_main.REFRESH_SECRET_KEY not in LEAKED_DEFAULTS
    assert auth_main.SECRET_KEY != auth_main.REFRESH_SECRET_KEY
