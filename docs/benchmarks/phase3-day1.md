# Phase 3 day-one checks (2026-11-13)

Setup: Modal, 1x NVIDIA L4 (23 GB) per service, scale to zero after 120 s idle.
LLM `Qwen/Qwen3-8B-FP8` on vLLM 0.21.0 (`--max-model-len 8192 --gpu-memory-utilization 0.80 --enable-prefix-caching
--enable-lora --max-loras 2 --max-lora-rank 16`, thinking off via `--default-chat-template-kwargs`).
Whisper: faster-whisper 1.2.1, `large-v3-turbo`, float16, VAD on. Client: `inference/checks.py` from a laptop in Indiana.

Raw output: [phase3-day1.json](phase3-day1.json) (compiled) and [phase3-day1-eager.json](phase3-day1-eager.json).
Boot timings come from the vLLM container log (`modal app logs mockmate-inference`).

## Required checks

| Check | Result |
|---|---|
| (a) thinking off | 0/50 replies had a `<think>` block or reasoning field |
| (a) structured JSON | 50/50 parsed and matched the schema (compiled run, `disable_any_whitespace`). The eager run without that flag got 46/50: all 4 failures were newline loops until `max_tokens` |
| (b) LoRA on FP8 | No-op rank-8 q/v adapter loaded on the FP8 weights; temperature-0 output identical to the base model, so FP8 stays |
| (c) idle window billed? | Pending: read from the Modal usage page |
| Auth | 401 without a token and with a wrong token (LLM and Whisper) |

## LLM: eager vs compiled (50 sequential grading calls, temperature 0.7, max 400 tokens)

| | `--enforce-eager` | compiled + CUDA graphs |
|---|---|---|
| decode tokens/s (mean, incl. network) | 10.5 | **24.2** |
| latency p50 / p95 / max | 12.1 / 37.0 / 40.4 s | **3.5 / 5.3 / 7.6 s** |
| JSON valid | 46/50 | 50/50 |
| engine start (log) | ~150 s | ~300 s first boot (incl. 94.6 s torch.compile, now cached in the `vllm-cache` volume) |
| KV cache memory | 8.03 GiB | 6.06 GiB (1.42 GiB goes to CUDA graphs) |

Weights: 8.79 GiB, downloaded once in 51 s, then loaded from the volume in ~7 s.

## Whisper (14.6 s synthetic answer, Windows TTS)

- Transcript matched the script word for word: 41 words, each with a timestamp.
- Processing 1.67 s; warm request 0.94 s end to end; first request 2.1 s.
- GPU memory after load: 2,147 MiB of 23,034 MiB.

## Not yet measured / caveats

- **GPU scheduling wait dominates cold start.** The client saw `/health` after 582 s and 726 s on two cold starts, while the container itself booted in ~2.5 and ~5 min. The rest was waiting for an L4. One earlier attempt waited more than 12 min.
- The second, cached compiled boot hasn't been timed yet.
- Latency includes the laptop-to-Modal round trip; the Modal endpoint runs in us-east.
