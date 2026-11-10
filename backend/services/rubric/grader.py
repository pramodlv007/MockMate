"""Rubric grader. One code path for every judge: the API baseline and the fine-tuned
vLLM judge differ only by JUDGE_BASE_URL / JUDGE_MODEL / JUDGE_API_KEY, so prompt,
rubric and temperature stay identical across the comparison."""
import json, os, re, time
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv(Path(__file__).parent.parent.parent / ".env")

BEHAVIORAL_POINTS = [
    {"id": "situation", "text": "Describes the situation or context concretely"},
    {"id": "task", "text": "States the goal or responsibility the candidate had"},
    {"id": "action", "text": "Describes the specific actions the candidate took"},
    {"id": "result", "text": "States what happened as a result"},
    {"id": "measurable_outcome", "text": "Gives a measurable outcome (a number, percentage or time saved)"},
    {"id": "own_role", "text": "Makes clear what the candidate personally did, as opposed to the team"},
]

BANK = {}
for _q in json.loads((Path(__file__).parent / "bank.json").read_text(encoding="utf-8")):
    _q.setdefault("points", BEHAVIORAL_POINTS)
    _q.setdefault("misconceptions", [])
    BANK[_q["id"]] = _q


class PointGrade(BaseModel):
    point_id: str
    covered: bool
    evidence_span: Optional[str] = None
    feedback: str


class Grade(BaseModel):
    points: List[PointGrade]


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().casefold()


def evidence_valid(span: Optional[str], transcript: str) -> bool:
    """Verbatim check, tolerant only of case and whitespace (ASR output is unpunctuated)."""
    return bool(span) and _norm(span) in _norm(transcript)


def build_prompt(q: dict, transcript: str) -> str:
    rubric = "\n".join(f"- {p['id']}: {p['text']}" for p in q["points"])
    return f"""You grade a spoken interview answer against a rubric. The transcript is speech-to-text output and may contain recognition errors.

QUESTION: {q['text']}

RUBRIC (grade every point):
{rubric}

TRANSCRIPT:
{transcript}

For each rubric point return:
- point_id: the id above
- covered: true only if the transcript clearly states the point
- evidence_span: when covered, an exact contiguous quote copied from the transcript; otherwise null
- feedback: one sentence (what was done well, or what is missing)

Return ONLY JSON: {{"points": [{{"point_id": "...", "covered": true, "evidence_span": "...", "feedback": "..."}}]}}"""


def call_judge(prompt: str):
    """Returns (text, prompt_tokens, completion_tokens). Temperature fixed at 0 for every judge."""
    from openai import OpenAI
    # Default judge: Gemini via its OpenAI-compatible endpoint (GOOGLE_API_KEY is the app's main key)
    client = OpenAI(
        base_url=os.getenv("JUDGE_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/"),
        api_key=os.getenv("JUDGE_API_KEY") or os.getenv("GOOGLE_API_KEY") or "none",
    )
    r = client.chat.completions.create(
        model=os.getenv("JUDGE_MODEL", "gemini-2.5-flash"),
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=1500,
        response_format={"type": "json_object"},
    )
    u = r.usage
    return r.choices[0].message.content, getattr(u, "prompt_tokens", 0), getattr(u, "completion_tokens", 0)


def _parse(text: str, q: dict) -> Grade:
    g = Grade.model_validate(json.loads(re.sub(r"```(?:json)?\n?|\n?```", "", text).strip()))
    if sorted(p.point_id for p in g.points) != sorted(p["id"] for p in q["points"]):
        raise ValueError("point_ids do not match the rubric")
    return g


def grade(question_id: str, transcript: str, call=call_judge) -> dict:
    """Grade one answer. Retries once on invalid output (counted in `retries`);
    raises ValueError if the retry is invalid too."""
    q = BANK[question_id]
    prompt = build_prompt(q, transcript)
    tok_in = tok_out = retries = 0
    t0 = time.perf_counter()
    for attempt in range(2):
        text, a, b = call(prompt)
        tok_in += a
        tok_out += b
        try:
            g = _parse(text, q)
            break
        except ValueError:  # JSONDecodeError and pydantic ValidationError both subclass ValueError
            if attempt:
                raise
            retries = 1
    labels = {p["id"]: p["text"] for p in q["points"]}
    return {
        "question_id": question_id,
        "points": [
            {**p.model_dump(), "label": labels[p.point_id],
             "evidence_valid": evidence_valid(p.evidence_span, transcript)}
            for p in g.points
        ],
        "retries": retries,
        "grade_ms": round((time.perf_counter() - t0) * 1000),
        "tokens_in": tok_in,
        "tokens_out": tok_out,
    }
