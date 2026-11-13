"""Phase 3 day-one checks against the deployed Modal app. Standard library only.

  python inference/checks.py <llm_url> <whisper_url> [audio_file]

Reads the bearer token from ~/.mockmate_inference_token and writes every measurement, with the config that
produced it, to docs/benchmarks/phase3-day1.json.
  (a) thinking is off: no <think> block or reasoning field, and N/N structured-JSON replies parse
  (b) the no-op LoRA (`probe-noop`, B=0) loads on the FP8 weights and matches the base output at temperature 0
  plus: auth is enforced, LLM cold start, per-call latency, Whisper cold start / processing time / word timestamps
"""
import json
import statistics
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

N_JSON_CALLS = 50
TOKEN = (Path.home() / ".mockmate_inference_token").read_text().strip()

EVAL_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "strengths": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
        "gaps": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
        "summary": {"type": "string"},
    },
    "required": ["score", "strengths", "gaps", "summary"],
    "additionalProperties": False,
}
SAMPLES = [
    ("Tell me about a time you handled a production outage.",
     "Our API went down at 2am. I checked dashboards, saw the DB connection pool was exhausted, "
     "rolled back the last deploy, then added a pool limit alert. Afterwards I wrote the postmortem."),
    ("How would you design a URL shortener?",
     "I'd hash the URL with base62, store it in a key value store, and put a cache in front. Maybe use a CDN."),
    ("Why do you want to work here?", "I like the product and I think I can learn a lot."),
    ("Explain the difference between a process and a thread.",
     "A process has its own memory space; threads share the memory of their process, so they are cheaper "
     "to create but need synchronisation such as locks."),
    ("Describe a conflict with a teammate.", "We disagreed on a design, so we wrote both up and picked one with data."),
]


def call(url, body=None, headers=None, timeout=900, method=None):
    data = json.dumps(body).encode() if isinstance(body, dict) else body
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, headers=h, method=method or ("POST" if data else "GET"))
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode(), time.monotonic() - t0
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace"), time.monotonic() - t0
    except OSError as e:  # reset/timeout (e.g. while a container scales); counted as a failed call, not a crash
        return 0, f"{type(e).__name__}: {e}", time.monotonic() - t0


def chat(llm, prompt, model="qwen3-8b", temperature=0.4, schema=True, max_tokens=400):
    body = {"model": model, "temperature": temperature, "max_tokens": max_tokens,
            "messages": [{"role": "system", "content": "You are a strict interview grader. Reply in JSON only."},
                         {"role": "user", "content": prompt}]}
    if schema:
        body["response_format"] = {"type": "json_schema",
                                   "json_schema": {"name": "evaluation", "schema": EVAL_SCHEMA, "strict": True}}
    return call(f"{llm}/v1/chat/completions", body, {"Authorization": f"Bearer {TOKEN}"})


def multipart(path):
    boundary = uuid.uuid4().hex
    head = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{Path(path).name}\"\r\n"
            "Content-Type: application/octet-stream\r\n\r\n").encode()
    return head + Path(path).read_bytes() + f"\r\n--{boundary}--\r\n".encode(), boundary


def pct(xs, p):
    xs = sorted(xs)
    return round(xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))], 3)


DEST = Path(__file__).resolve().parent.parent / "docs" / "benchmarks" / "phase3-day1.json"


def save(out):
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(out, indent=2))


def main(llm, whisper, audio=None):
    out = {"run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "config": {"llm_model": "Qwen/Qwen3-8B-FP8", "engine": "vllm 0.21.0", "gpu": "1x NVIDIA L4 (Modal)",
                      "flags": "--max-model-len 8192 --gpu-memory-utilization 0.80 --enable-prefix-caching "
                               "--enable-lora --max-loras 2 --max-lora-rank 16 "
                               "--structured-outputs-config {backend: xgrammar, disable_any_whitespace: true} "
                               "--default-chat-template-kwargs {enable_thinking: false}",
                      "whisper": "faster-whisper 1.2.1, large-v3-turbo, float16, vad_filter",
                      "scaledown_window_s": 120, "json_calls": N_JSON_CALLS}}

    # ── LLM cold start (first request wakes the container; Modal holds it until vLLM listens) ──
    t0 = time.monotonic()
    status = None
    while time.monotonic() - t0 < 900:
        status, _, _ = call(f"{llm}/health", timeout=900)
        if status == 200:
            break
        time.sleep(3)
    out["llm_cold_start_s"] = round(time.monotonic() - t0, 1)
    print(f"llm /health {status} after {out['llm_cold_start_s']}s")

    s, _, _ = call(f"{llm}/v1/models")
    s_bad, _, _ = call(f"{llm}/v1/models", headers={"Authorization": "Bearer wrong"})
    out["auth"] = {"no_token": s, "wrong_token": s_bad}
    print("auth:", out["auth"])
    save(out)

    # ── (a) thinking off + structured JSON ──
    lat, toks, parsed, think = [], [], 0, 0
    first_text = None
    for i in range(N_JSON_CALLS):
        q, a = SAMPLES[i % len(SAMPLES)]
        s, body, dt = chat(llm, f"Question: {q}\nCandidate answer: {a}\nGrade the answer.", temperature=0.7)
        if s != 200:
            print(f"  call {i}: HTTP {s} {body[:200]}")
            continue
        r = json.loads(body)
        msg = r["choices"][0]["message"]
        text = msg.get("content") or ""
        first_text = first_text or text
        if "<think>" in text or msg.get("reasoning_content") or msg.get("reasoning"):
            think += 1
        try:
            obj = json.loads(text)
            parsed += set(obj) == set(EVAL_SCHEMA["required"]) and 0 <= obj["score"] <= 100
        except ValueError:
            print(f"  call {i}: invalid JSON, finish_reason={r['choices'][0].get('finish_reason')}, tail={text[-80:]!r}")
        lat.append(dt)
        toks.append(r["usage"]["completion_tokens"])
    out["check_a"] = {"calls": N_JSON_CALLS, "ok_http": len(lat), "json_valid": parsed, "thinking_seen": think,
                      "latency_s": {"p50": pct(lat, 50), "p95": pct(lat, 95), "max": round(max(lat), 3)},
                      "completion_tokens_mean": round(statistics.mean(toks), 1),
                      "decode_tok_per_s_mean": round(statistics.mean(t / d for t, d in zip(toks, lat)), 1),
                      "example": first_text}
    print("check (a):", {k: v for k, v in out["check_a"].items() if k != "example"})
    save(out)

    # ── (b) LoRA on FP8: no-op adapter must load and match the base model at temperature 0 ──
    prompt = f"Question: {SAMPLES[0][0]}\nCandidate answer: {SAMPLES[0][1]}\nGrade the answer."
    s1, b1, _ = chat(llm, prompt, temperature=0)
    s2, b2, _ = chat(llm, prompt, model="probe-noop", temperature=0)
    same = s1 == s2 == 200 and json.loads(b1)["choices"][0]["message"]["content"] == \
        json.loads(b2)["choices"][0]["message"]["content"]
    out["check_b"] = {"base_http": s1, "lora_http": s2, "identical_output": same,
                      "lora_error": None if s2 == 200 else b2[:300]}
    print("check (b):", out["check_b"])
    save(out)

    # ── Whisper ──
    if audio:
        body, boundary = multipart(audio)
        h = {"Authorization": f"Bearer {TOKEN}", "Content-Type": f"multipart/form-data; boundary={boundary}"}
        s_noauth, _, _ = call(whisper, body, {"Content-Type": h["Content-Type"]})
        s, resp, cold = call(whisper, body, h)
        s2, resp2, warm = call(whisper, body, h)
        w = json.loads(resp) if s == 200 else {}
        out["whisper"] = {"http": s, "no_token_http": s_noauth, "first_call_s": round(cold, 1),
                          "warm_call_s": round(warm, 2), "audio_s": w.get("duration"),
                          "processing_s": w.get("processing_seconds"),
                          "words_with_timestamps": sum(len(x["words"]) for x in w.get("segments", [])),
                          "text": w.get("text") or resp[:300]}
        print("whisper:", out["whisper"])

    save(out)
    print("saved", DEST)


if __name__ == "__main__":
    main(*sys.argv[1:4])
