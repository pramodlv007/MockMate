import uuid
from unittest.mock import MagicMock
import httpx
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
