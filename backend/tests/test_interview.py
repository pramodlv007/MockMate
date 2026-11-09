import uuid
from unittest.mock import MagicMock
import httpx
from common import database
from services.interview import main as interview_main
from tests.conftest import auth


class _Resp:
    def __init__(self, code): self.status_code = code
    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("err", request=None, response=None)


def _capture_post(monkeypatch, code=200):
    calls = []
    async def fake_post(self, url, json=None, headers=None, **kw):
        calls.append({"url": url, "json": json, "headers": headers or {}})
        return _Resp(code)
    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    return calls


def test_upload_triggers_evaluation_with_s3_path(client, make_session, monkeypatch):
    user = uuid.uuid4()
    sid = make_session(user)
    monkeypatch.setattr(interview_main, "S3_BUCKET", "bucket")
    monkeypatch.setattr(interview_main, "s3_client", MagicMock())
    calls = _capture_post(monkeypatch)

    r = client.post(f"/{sid}/upload", files={"file": ("v.webm", b"data", "video/webm")}, headers=auth(user))

    assert r.status_code == 200, r.text
    assert r.json()["status"] == "evaluating"
    assert calls[0]["url"].endswith("/evaluation/start")
    assert calls[0]["json"]["video_path"] == f"s3://bucket/videos/{sid}.webm"


def test_failed_evaluation_trigger_marks_session_error(client, make_session, monkeypatch, tmp_path):
    user = uuid.uuid4()
    sid = make_session(user)
    monkeypatch.setattr(interview_main, "UPLOAD_DIR", tmp_path)
    _capture_post(monkeypatch, code=500)

    r = client.post(f"/{sid}/upload", files={"file": ("v.webm", b"data", "video/webm")}, headers=auth(user))

    assert r.json()["status"] == "error"


# ── Auth / ownership ─────────────────────────────────────────────────────────
def test_user_cannot_read_another_users_interview(client, make_session):
    alice, bob = uuid.uuid4(), uuid.uuid4()
    sid = make_session(alice)
    assert client.get(f"/{sid}", headers=auth(alice)).status_code == 200
    assert client.get(f"/{sid}", headers=auth(bob)).status_code == 404
    assert client.post(f"/{sid}/transcripts", json={"transcripts": {"0": "hi"}}, headers=auth(bob)).status_code == 404
    assert client.post(f"/{sid}/upload", files={"file": ("v.webm", b"x")}, headers=auth(bob)).status_code == 404


def test_x_user_id_header_is_ignored(client, make_session):
    alice = uuid.uuid4()
    sid = make_session(alice)
    assert client.get(f"/{sid}", headers={"x-user-id": str(alice)}).status_code == 401
    assert client.get("/user/me", headers={"x-user-id": str(alice)}).status_code == 401


def test_user_list_only_for_self(client, make_session):
    alice, bob = uuid.uuid4(), uuid.uuid4()
    make_session(alice)
    assert len(client.get("/user/me", headers=auth(alice)).json()) >= 1
    assert client.get(f"/user/{alice}", headers=auth(alice)).status_code == 200
    assert client.get(f"/user/{alice}", headers=auth(bob)).status_code == 403


def test_evaluation_patch_requires_internal_token(client, make_session):
    alice = uuid.uuid4()
    sid = make_session(alice)
    body = {"status": "evaluated", "overall_score": 99}
    assert client.patch(f"/{sid}/evaluation", json=body, headers=auth(alice)).status_code == 403
    assert client.patch(f"/{sid}/evaluation", json=body, headers={"X-Internal-Token": "wrong"}).status_code == 403
    assert client.patch(f"/{sid}/evaluation", json=body, headers={"X-Internal-Token": "test-internal-token"}).status_code == 200
    # internal callers (evaluation service) may read any session
    assert client.get(f"/{sid}", headers={"X-Internal-Token": "test-internal-token"}).status_code == 200


# ── Rate limits ──────────────────────────────────────────────────────────────
def test_upload_limit_is_per_user(client, make_session, monkeypatch, tmp_path):
    monkeypatch.setattr(interview_main, "UPLOAD_DIR", tmp_path)
    _capture_post(monkeypatch)
    alice, bob = uuid.uuid4(), uuid.uuid4()
    sid = make_session(alice)
    up = lambda u, s: client.post(f"/{s}/upload", files={"file": ("v.webm", b"x")}, headers=auth(u)).status_code
    assert [up(alice, sid) for _ in range(3)] == [200, 200, 200]
    assert up(alice, sid) == 429                     # default UPLOAD_RATE_LIMIT is 3/hour
    assert up(bob, make_session(bob)) == 200         # other users are unaffected


def test_daily_interview_cap(client, make_session, monkeypatch):
    monkeypatch.setattr(interview_main, "MAX_INTERVIEWS_PER_DAY", 2)
    _capture_post(monkeypatch, code=500)             # question service down → fallback questions
    carol = uuid.uuid4()
    body = {"company_name": "Acme", "job_description": "jd", "questions_count": 2}
    codes = [client.post("/", json=body, headers=auth(carol)).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# ── Deletion ─────────────────────────────────────────────────────────────────
def test_delete_removes_rows_and_s3_object(client, make_session, monkeypatch):
    alice, bob = uuid.uuid4(), uuid.uuid4()
    sid = make_session(alice)
    db = database.SessionLocal()
    db.get(interview_main.models.InterviewSession, sid).video_storage_path = f"s3://bucket/videos/{sid}.webm"
    db.commit(); db.close()
    s3 = MagicMock()
    monkeypatch.setattr(interview_main, "s3_client", s3)

    assert client.delete(f"/{sid}", headers=auth(bob)).status_code == 404       # not the owner
    s3.delete_object.assert_not_called()
    assert client.delete(f"/{sid}", headers=auth(alice)).status_code == 204
    s3.delete_object.assert_called_once_with(Bucket="bucket", Key=f"videos/{sid}.webm")
    assert client.get(f"/{sid}", headers=auth(alice)).status_code == 404
    db = database.SessionLocal()
    assert db.query(interview_main.models.Question).filter_by(session_id=sid).count() == 0
    db.close()


def test_delete_keeps_rows_if_storage_unavailable(client, make_session, monkeypatch):
    alice = uuid.uuid4()
    sid = make_session(alice)
    db = database.SessionLocal()
    db.get(interview_main.models.InterviewSession, sid).video_storage_path = "s3://bucket/videos/x.webm"
    db.commit(); db.close()
    monkeypatch.setattr(interview_main, "s3_client", None)
    assert client.delete(f"/{sid}", headers=auth(alice)).status_code == 503
    assert client.get(f"/{sid}", headers=auth(alice)).status_code == 200
