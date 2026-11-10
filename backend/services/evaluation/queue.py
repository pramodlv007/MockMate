"""Redis-backed evaluation queue (arq).

Upload → interview service → POST /evaluation/start → enqueue() here.
The eval-worker Deployment runs `arq services.evaluation.queue.WorkerSettings` and consumes jobs.
Without REDIS_URL (local dev, tests) start_evaluation falls back to in-process BackgroundTasks.
"""
import asyncio
import os
from time import perf_counter

from arq import Retry, create_pool
from arq.connections import RedisSettings
from prometheus_client import start_http_server

from common.metrics import EVAL_JOB_DURATION, EVAL_JOBS

REDIS_URL = os.getenv("REDIS_URL")
MAX_TRIES = 3
JOB_TIMEOUT = 900  # arq's default 300s is shorter than a slow Gemini video pass
_pool = None


async def enqueue(payload: dict) -> bool:
    """Queue one evaluation. The job id is the interview id, so a second upload of the same
    interview while one is queued or running is a no-op. Returns False for that duplicate."""
    global _pool
    if _pool is None:
        _pool = await create_pool(RedisSettings.from_dsn(REDIS_URL))
    job = await _pool.enqueue_job("evaluate_interview", payload, _job_id=f"eval:{payload['interview_id']}")
    return job is not None


async def evaluate_interview(ctx, payload: dict):
    """One attempt. Failures retry with backoff (20s, 40s); the last failure marks the interview "error"."""
    from .main import EvaluateRequest, _evaluate, _patch_interview  # lazy: main imports this module

    req = EvaluateRequest(**payload)
    start = perf_counter()
    try:
        # Our own timeout, shorter than arq's: arq's cancels the job without retrying, which would
        # leave the interview on "evaluating" forever; ours lands in the retry/error path below.
        await asyncio.wait_for(_evaluate(req), timeout=JOB_TIMEOUT - 60)
        EVAL_JOBS.labels("success").inc()
    except Exception as e:
        if ctx["job_try"] < MAX_TRIES:
            EVAL_JOBS.labels("retry").inc()
            print(f"[EvalWorker] try {ctx['job_try']}/{MAX_TRIES} failed for {req.interview_id}: {e!r}; retrying")
            raise Retry(defer=10 * 2 ** ctx["job_try"])
        EVAL_JOBS.labels("failure").inc()
        print(f"[EvalWorker] giving up on {req.interview_id} after {MAX_TRIES} tries: {e!r}")
        await _patch_interview(req.interview_id, {"status": "error"})
    finally:
        EVAL_JOB_DURATION.observe(perf_counter() - start)


async def _startup(ctx):
    start_http_server(int(os.getenv("METRICS_PORT", "9100")))


# On a fresh deploy Redis may start after the worker; wait up to ~60s instead of crash-looping.
_redis_settings = RedisSettings.from_dsn(REDIS_URL or "redis://localhost:6379")
_redis_settings.conn_retries = 60


class WorkerSettings:
    functions = [evaluate_interview]
    redis_settings = _redis_settings
    on_startup = _startup
    max_tries = MAX_TRIES
    # shortcut: 1 job at a time because _evaluate's LLM calls block the event loop, so a 2nd job wouldn't
    # actually run in parallel; raise this once those calls move to threads/async (Phase 3).
    max_jobs = int(os.getenv("EVAL_MAX_JOBS", "1"))
    job_timeout = JOB_TIMEOUT
    keep_result = 0  # don't keep results, so a later re-upload of the same interview can be evaluated again
