"""Text-LLM routing for the evaluation pipeline: self-hosted Qwen3-8B on Modal first, Gemini as fallback.

Modal scales to zero, so a cold container needs minutes (GPU scheduling + vLLM boot). `begin()` pings it when an
evaluation starts so it boots while transcription runs; each call then waits for it until a per-evaluation
deadline before falling back. Every call is recorded (provider, latency, fallback reason) and `finish()` returns
that log for the stored evaluation. A daily GPU-seconds budget routes everything to Gemini once it is spent.

Unset MODAL_LLM_URL / INFERENCE_TOKEN = Modal disabled = previous behaviour (Gemini only).
"""
import os
import threading
import time
from contextvars import ContextVar
from datetime import date
from pathlib import Path
from typing import Optional

import httpx
from dotenv import dotenv_values

from common.metrics import GPU_SECONDS, LLM_FALLBACKS, MODAL_COLD_START, llm_call

_file = dotenv_values(Path(__file__).parent.parent.parent / ".env")


def _cfg(name: str, default: str = "") -> str:
    return os.getenv(name) or _file.get(name) or default


MODAL_LLM_URL = _cfg("MODAL_LLM_URL").rstrip("/")
INFERENCE_TOKEN = _cfg("INFERENCE_TOKEN")
MODAL_MODEL = _cfg("MODAL_LLM_MODEL", "qwen3-8b")
READY_WAIT_S = float(_cfg("MODAL_READY_WAIT_S", "480"))      # per evaluation; the arq job timeout is 900 s
# $30/month at the L4 rate ($0.000222/s) is ~4,500 GPU-s/day across both services; keep some margin
DAILY_GPU_SECONDS = float(_cfg("MODAL_DAILY_GPU_SECONDS", "4000"))
IDLE_S = 120          # modal_app.py scaledown_window: billed after the last request
EST_BOOT_S = 300      # measured vLLM boot (docs/benchmarks/phase3-day1.md), billed even if we never use it
MAX_TOKENS = 2048     # prompt + max_tokens must fit --max-model-len 8192


class _Run:
    def __init__(self, wait_s: float):
        self.t0 = time.monotonic()
        self.deadline = self.t0 + wait_s
        self.ready_at: Optional[float] = None
        self.was_cold: Optional[bool] = None
        self.first_modal: Optional[float] = None
        self.last_modal: Optional[float] = None
        self.calls: list = []


_run: ContextVar[Optional[_Run]] = ContextVar("llm_run", default=None)


def enabled() -> bool:
    return bool(MODAL_LLM_URL and INFERENCE_TOKEN)


# ── Budget guard ─────────────────────────────────────────────────────────────
_local_usage: dict = {}
_redis = None


def _redis_client():
    global _redis
    if _redis is None and os.getenv("REDIS_URL"):
        import redis
        _redis = redis.Redis.from_url(os.getenv("REDIS_URL"), socket_timeout=2, socket_connect_timeout=2)
    return _redis


def _usage_key() -> str:
    return f"mockmate:gpu_seconds:{date.today().isoformat()}"


def gpu_seconds_today() -> float:
    try:
        r = _redis_client()
        if r is not None:
            return float(r.get(_usage_key()) or 0)
    except Exception as e:
        print(f"[LLMRouter] budget read failed, using local count: {e}")
    return _local_usage.get(_usage_key(), 0.0)


def _add_gpu_seconds(secs: float):
    GPU_SECONDS.inc(secs)
    try:
        r = _redis_client()
        if r is not None:
            r.incrbyfloat(_usage_key(), secs)
            r.expire(_usage_key(), 3 * 86400)
            return
    except Exception as e:
        print(f"[LLMRouter] budget write failed, counting locally: {e}")
    _local_usage[_usage_key()] = _local_usage.get(_usage_key(), 0.0) + secs


# ── Readiness ────────────────────────────────────────────────────────────────
def _healthy(timeout: float) -> bool:
    try:
        return httpx.get(f"{MODAL_LLM_URL}/health", timeout=timeout).status_code == 200
    except httpx.HTTPError:
        return False


def begin():
    """Start of an evaluation: note whether Modal is warm, and if not, make it start booting now."""
    run = _Run(READY_WAIT_S)
    _run.set(run)
    if not enabled() or gpu_seconds_today() >= DAILY_GPU_SECONDS:
        return
    if _healthy(timeout=3):
        run.was_cold, run.ready_at = False, run.t0
    else:
        run.was_cold = True
        # Modal starts a container for a pending request; keep one open so it isn't dropped as abandoned
        threading.Thread(target=_healthy, kwargs={"timeout": READY_WAIT_S + 60}, daemon=True).start()


def _wait_ready(run: _Run) -> bool:
    while run.ready_at is None:
        if _healthy(timeout=5):
            run.ready_at = time.monotonic()
            if run.was_cold:
                MODAL_COLD_START.observe(run.ready_at - run.t0)
            break
        if time.monotonic() >= run.deadline:
            return False
        time.sleep(5)
    return True


# ── Calls ────────────────────────────────────────────────────────────────────
def modal_chat(prompt: str, system: str, json_mode: bool, op: str) -> tuple:
    """Returns (text, None) from Modal, or (None, reason) when the caller should fall back."""
    run = _run.get() or _Run(wait_s=0)  # outside an evaluation: use Modal only if it's already up
    if not enabled():
        return None, "disabled"
    if gpu_seconds_today() >= DAILY_GPU_SECONDS:
        return None, "budget"
    if not _wait_ready(run):
        return None, "not_ready"

    msgs = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    body = {"model": MODAL_MODEL, "messages": msgs, "temperature": 0.4, "max_tokens": MAX_TOKENS}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    t = time.monotonic()
    run.first_modal = run.first_modal or t
    text, reason = None, "modal_error"
    with llm_call("modal", op) as call:
        try:
            r = httpx.post(f"{MODAL_LLM_URL}/v1/chat/completions", json=body, timeout=180,
                           headers={"Authorization": f"Bearer {INFERENCE_TOKEN}"})
            if r.status_code == 200:
                text = r.json()["choices"][0]["message"]["content"] or None
            else:
                reason = f"modal_http_{r.status_code}"  # 400 = prompt too long for the 8K context
        except (httpx.HTTPError, ValueError, KeyError, IndexError) as e:
            reason = f"modal_{type(e).__name__}"
        call.ok = text is not None
    run.last_modal = time.monotonic()
    if text is not None:
        record("modal", op, run.last_modal - t)
    return text, (None if text is not None else reason)


def record(provider: str, op: str, latency_s: float, fallback_reason: Optional[str] = None):
    run = _run.get()
    if run is not None:
        run.calls.append({"provider": provider, "op": op, "latency_s": round(latency_s, 2),
                          **({"fallback_reason": fallback_reason} if fallback_reason else {})})
    if fallback_reason and fallback_reason != "disabled":
        LLM_FALLBACKS.labels(fallback_reason).inc()


def finish() -> dict:
    """End of an evaluation: charge the estimated GPU time to today's budget and return the call log."""
    run = _run.get()
    if run is None:
        return {}
    _run.set(None)
    gpu_s = 0.0
    if run.last_modal is not None:  # billed: boot (if we woke it) or our usage, plus the idle window
        gpu_s = run.last_modal - (run.t0 if run.was_cold else run.first_modal) + IDLE_S
    elif run.was_cold:  # we woke it but never used it; it still boots and idles
        gpu_s = EST_BOOT_S + IDLE_S
    if gpu_s:
        _add_gpu_seconds(gpu_s)
    providers: dict = {}
    for c in run.calls:
        providers[c["provider"]] = providers.get(c["provider"], 0) + 1
    return {
        "providers": providers,
        "modal_was_cold": run.was_cold,
        "modal_ready_after_s": None if run.ready_at is None else round(run.ready_at - run.t0, 1),
        "gpu_seconds_est": round(gpu_s, 1),
        "calls": run.calls,
    }
