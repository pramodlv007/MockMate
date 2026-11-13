# Phase 3 step 2: router against live Modal (2026-11-13)

Same deployment as [phase3-day1.md](phase3-day1.md): Qwen3-8B-FP8, vLLM 0.21.0, 1x L4, compiled, `scaledown_window` 120 s.
The client is `backend/services/evaluation/llm_router.py`, called from the real pipeline functions
(`_evaluate_single_question`, `_segment_transcript`, `_synthesize_final`) on a laptop, `MODAL_READY_WAIT_S=1500`.
Prompts: 3 interview answers (strong / medium / weak) for a backend role, unchanged from production.

## Run 1: router with `response_format: json_object` (code as of d5d55af), warm container

All 4 calls went to Modal and were fast (0.6–3.6 s), but the output was unusable:
- every question scored exactly 50 (the pipeline's parse-failure default)
- the summary parsed to a single junk key, `/**/`

The cause was a schema-less JSON grammar combined with the server's `disable_any_whitespace`. It was fixed in
33ae6d6: no grammar, and each step declares its required keys; replies without them fall back to Gemini (`modal_bad_json`).

## Run 2: after the fix, from cold

| | |
|---|---|
| Calls answered by Modal | **14/14** (9 grading, 2 segmentation, 3 summary); 0 fallbacks, 0 `modal_bad_json` |
| Cold start (evaluation start → `/health` 200) | **465.7 s**, including Modal's wait for an L4 |
| Grading latency (9 calls) | 12.2–14.1 s each |
| Segmentation latency (2 calls) | 7.5 s each |
| Summary latency (3 calls) | 40.3–43.4 s each (long JSON reply) |
| Router's GPU-seconds estimate for this run | 846 s (counts the whole cold wait, so it overstates the bill) |

Scores were stable across 3 repeats: 76, 75, then 60 / 70 / 60 for the weak answer.

## Observations to act on

- **Qwen is a lenient, less discriminating grader than Gemini on these answers.** The weak "I like the product"
  answer got 60–70 from Qwen and 30 from Gemini; the URL-shortener answer got 75 vs 52. Measure this against the
  human-labelled set in `backend/rubric_eval/` before making Modal the default grader. It's also what Phase 5
  (LoRA fine-tune) is for.
- One interview's text work runs ~80 s sequentially (3 grading calls + summary). Running the grading calls in
  parallel (step 6) should bring that close to the slowest single call.
- Cold start is 7–15 min across five observations, mostly waiting for an L4. Any user-facing path needs Gemini as
  the fallback (in place), or a warmer strategy.
