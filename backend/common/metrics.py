"""Prometheus metrics shared by the API process and the eval worker.
Each process exposes its own registry (API: GET /metrics, worker: :9100/metrics); Prometheus sums across pods."""
import os
from contextlib import contextmanager
from time import perf_counter
from types import SimpleNamespace

from prometheus_client import Counter, Gauge, Histogram

HTTP_LATENCY = Histogram(
    "mockmate_http_request_duration_seconds", "API request latency by route template",
    ["method", "route", "status"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60),
)
INTERVIEWS_CREATED = Counter("mockmate_interviews_created_total", "Interview sessions created")

EVAL_JOB_DURATION = Histogram(
    "mockmate_eval_job_duration_seconds", "Wall time of one evaluation attempt",
    buckets=(5, 15, 30, 60, 120, 300, 600, 900),
)
EVAL_JOBS = Counter("mockmate_eval_jobs_total", "Evaluation attempts by outcome", ["outcome"])  # success | retry | failure

LLM_LATENCY = Histogram(
    "mockmate_llm_call_duration_seconds", "LLM call latency", ["provider", "op"],
    buckets=(0.25, 0.5, 1, 2, 5, 10, 20, 40, 80, 160),
)
LLM_ERRORS = Counter("mockmate_llm_call_errors_total", "LLM calls that raised or returned unusable output", ["provider", "op"])
LLM_FALLBACKS = Counter("mockmate_llm_fallbacks_total", "Text-LLM calls that skipped the self-hosted model", ["reason"])
MODAL_COLD_START = Histogram(
    "mockmate_modal_cold_start_seconds", "Evaluation start until the scaled-to-zero LLM answered /health "
    "(includes Modal's GPU scheduling wait)", buckets=(15, 30, 60, 120, 180, 300, 450, 600, 900),
)
GPU_SECONDS = Counter("mockmate_gpu_seconds_estimated_total", "Estimated billed GPU-seconds (budget guard input)")


@contextmanager
def llm_call(provider: str, op: str):
    """Time one LLM call. An exception, or setting `call.ok = False`, counts it as an error."""
    call = SimpleNamespace(ok=True)
    start = perf_counter()
    try:
        yield call
    except Exception:
        call.ok = False
        raise
    finally:
        LLM_LATENCY.labels(provider, op).observe(perf_counter() - start)
        if not call.ok:
            LLM_ERRORS.labels(provider, op).inc()


QUEUE_DEPTH = Gauge("mockmate_eval_queue_depth", "Evaluation jobs waiting in Redis (incl. deferred retries)")
_redis = None


def _queue_depth() -> float:
    """Read on every scrape. NaN (shown as a gap) when Redis is unset or unreachable, never a fake 0."""
    global _redis
    url = os.getenv("REDIS_URL")
    if not url:
        return float("nan")
    try:
        if _redis is None:
            import redis
            _redis = redis.Redis.from_url(url, socket_timeout=1, socket_connect_timeout=1)
        return float(_redis.zcard("arq:queue"))  # arq's default queue key (arq.constants.default_queue_name)
    except Exception:
        return float("nan")


QUEUE_DEPTH.set_function(_queue_depth)
