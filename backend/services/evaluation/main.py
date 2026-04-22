"""
MockMate Evaluation Service — Port 8005
Multi-stage pipeline: Gemini transcription → per-question eval with resume context →
deterministic composite scoring → synthesis LLM call for language output.
"""
import os, json, re, base64, httpx
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
from dotenv import dotenv_values

backend_dir = Path(__file__).parent.parent.parent
config = dotenv_values(backend_dir / ".env")

# --- API Keys -------------------------------------------------------------------
GOOGLE_API_KEY  = config.get("GOOGLE_API_KEY")  or os.getenv("GOOGLE_API_KEY")
DEEPSEEK_API_KEY = config.get("DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK_API_KEY")

INTERVIEW_SERVICE_URL = os.getenv("INTERVIEW_SERVICE_URL", "http://localhost:8004")

# --- Initialize Gemini 2.5 Flash ------------------------------------------------
gemini_model = None
if GOOGLE_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GOOGLE_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-2.5-flash")
        print("[EvalService] ✓ Gemini 2.5 Flash initialized")
    except Exception as e:
        print(f"[EvalService] Gemini init error: {e}")

# --- Initialize DeepSeek (fallback) ---------------------------------------------
deepseek_client = None
if DEEPSEEK_API_KEY:
    try:
        from openai import OpenAI
        deepseek_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
        print("[EvalService] ✓ DeepSeek client initialized (fallback)")
    except Exception as e:
        print(f"[EvalService] DeepSeek init error: {e}")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="MockMate Evaluation Service", version="5.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- Schemas --------------------------------------------------------------------
class EvaluateRequest(BaseModel):
    interview_id: str
    video_path: str
    company: str
    job_description: str
    persona: str = "neutral"
    strictness: str = "standard"
    questions: List[str] = []
    question_ids: List[str] = []
    # Candidate profile for resume-grounded evaluation
    resume_text: str = ""
    skills: str = ""
    experience_years: int = 0
    target_role: str = ""
    education: str = ""

class EvaluateResponse(BaseModel):
    interview_id: str
    status: str
    message: str


# --- LLM Helper -----------------------------------------------------------------
def _llm(prompt: str, system: str = "", json_mode: bool = False) -> Optional[str]:
    """Call Gemini first, fallback to DeepSeek."""
    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    if gemini_model:
        try:
            gen_config = {"temperature": 0.4, "max_output_tokens": 4000}
            if json_mode:
                gen_config["response_mime_type"] = "application/json"
            response = gemini_model.generate_content(full_prompt, generation_config=gen_config)
            if response.text:
                return response.text
        except Exception as e:
            print(f"[EvalService] Gemini LLM error: {e}")

    if deepseek_client:
        try:
            msgs = []
            if system:
                msgs.append({"role": "system", "content": system})
            msgs.append({"role": "user", "content": prompt})
            kwargs = {"model": "deepseek-chat", "messages": msgs, "temperature": 0.4, "max_tokens": 4000}
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            return deepseek_client.chat.completions.create(**kwargs).choices[0].message.content
        except Exception as e:
            print(f"[EvalService] DeepSeek LLM error: {e}")

    return None


def _parse_json(raw: Optional[str]) -> Optional[dict]:
    if not raw:
        return None
    raw = re.sub(r"```(?:json)?\n?|\n?```", "", raw).strip()
    try:
        return json.loads(raw)
    except Exception as e:
        print(f"[EvalService] JSON parse error: {e}")
        return None


# --- S3 Download Helper -------------------------------------------------------
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
s3_client = None
if S3_BUCKET:
    try:
        import boto3
        s3_client = boto3.client("s3")
        print("[EvalService] S3 client initialized")
    except Exception as e:
        print(f"[EvalService] S3 init error: {e}")


def _ensure_local(video_path: str) -> str:
    """If video_path is an S3 URI, download to a temp file and return local path."""
    if not video_path.startswith("s3://"):
        return video_path
    if not s3_client:
        print("[EvalService] S3 URI received but no S3 client — cannot download")
        return video_path
    try:
        # Parse s3://bucket/key
        without_prefix = video_path[5:]
        bucket, key = without_prefix.split("/", 1)
        suffix = "." + key.rsplit(".", 1)[-1] if "." in key else ".webm"
        import tempfile
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        s3_client.download_fileobj(bucket, key, tmp)
        tmp.close()
        print(f"[EvalService] Downloaded {video_path} → {tmp.name}")
        return tmp.name
    except Exception as e:
        print(f"[EvalService] S3 download error: {e}")
        return video_path


# --- Agent 1: Scribe (Audio Transcription) ------------------------------------
def _transcribe(video_path: str) -> str:
    video_path = _ensure_local(video_path)
    path = Path(video_path)
    if not path.exists():
        print(f"[Scribe] Video file not found: {video_path}")
        return ""

    if gemini_model:
        try:
            import google.generativeai as genai
            print("[Scribe] Uploading to Gemini for transcription...")
            audio_file = genai.upload_file(str(path))
            response = gemini_model.generate_content([
                "Transcribe this audio/video recording verbatim. "
                "Return ONLY the transcript text, nothing else. "
                "If multiple speakers, prefix with 'Interviewer:' or 'Candidate:'.",
                audio_file,
            ])
            if response.text:
                print(f"[Scribe] ✓ Gemini transcript: {len(response.text)} chars")
                return response.text
        except Exception as e:
            print(f"[Scribe] Gemini transcription error: {e}")

    print("[Scribe] ✗ No transcription available")
    return ""


# --- Agent 3: Observer (Vision Analysis) ----------------------------------------
def _analyze_frames(video_path: str) -> dict:
    defaults = {"eye_contact_percent": 65, "good_posture_percent": 70, "engagement_percent": 65, "concerns": []}
    video_path = _ensure_local(video_path)
    path = Path(video_path)
    if not path.exists():
        return defaults

    if gemini_model:
        try:
            import google.generativeai as genai
            import time
            print("[Observer] Uploading video to Gemini for body language analysis...")
            video_file = genai.upload_file(str(path))
            for _ in range(30):
                video_file = genai.get_file(video_file.name)
                if video_file.state.name != "PROCESSING":
                    break
                time.sleep(2)

            if video_file.state.name != "FAILED":
                resp = gemini_model.generate_content(
                    ["Analyze this mock interview video for body language. "
                     "Return ONLY valid JSON: "
                     '{"eye_contact_percent": 0-100, "good_posture_percent": 0-100, '
                     '"engagement_percent": 0-100, "concerns": ["behavioral observations"], '
                     '"timeline_notes": "how confidence changed during interview"}',
                     video_file],
                    generation_config={"response_mime_type": "application/json", "max_output_tokens": 500},
                )
                parsed = _parse_json(resp.text)
                if parsed:
                    print(f"[Observer] ✓ Gemini video analysis complete")
                    try:
                        genai.delete_file(video_file.name)
                    except Exception:
                        pass
                    return parsed
        except Exception as e:
            print(f"[Observer] Gemini video error: {e}")

    # Frame-extraction fallback
    try:
        from moviepy import VideoFileClip
        from PIL import Image
        import io

        clip = VideoFileClip(str(path))
        duration = clip.duration
        times = [duration * 0.20, duration * 0.50, duration * 0.80]
        parts = ["Analyze these 3 interview frames. Return ONLY valid JSON: "
                 '{"eye_contact_percent": 0-100, "good_posture_percent": 0-100, '
                 '"engagement_percent": 0-100, "concerns": []}']
        for t in times:
            frame = clip.get_frame(min(t, duration - 0.1))
            img = Image.fromarray(frame).resize((512, 512))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=80)
            parts.append(img)
        clip.close()

        if gemini_model:
            resp = gemini_model.generate_content(
                parts,
                generation_config={"response_mime_type": "application/json", "max_output_tokens": 500}
            )
            parsed = _parse_json(resp.text)
            if parsed:
                return parsed
    except Exception as e:
        print(f"[Observer] Frame extraction error: {e}")

    return defaults


# --- Speech Metrics (deterministic, no AI) ------------------------------------
FILLER_WORDS = ["um", "uh", "like", "you know", "basically", "literally", "actually", "so", "right"]

def _speech_metrics(transcript: str, duration_seconds: float = 300) -> dict:
    words = transcript.lower().split()
    word_count = len(words)
    minutes = max(duration_seconds / 60, 0.1)
    wpm = round(word_count / minutes, 1)
    filler_items = []
    total_fillers = 0
    for fw in FILLER_WORDS:
        cnt = transcript.lower().count(fw)
        if cnt:
            filler_items.append({"word": fw, "count": cnt})
            total_fillers += cnt
    pace = "optimal" if 100 <= wpm <= 180 else ("too_slow" if wpm < 100 else "too_fast")
    return {
        "word_count": word_count,
        "words_per_minute": wpm,
        "pace_assessment": pace,
        "filler_word_count": total_fillers,
        "filler_ratio_percent": round((total_fillers / max(word_count, 1)) * 100, 2),
        "filler_breakdown": sorted(filler_items, key=lambda x: x["count"], reverse=True),
    }


# --- Transcript Segmentation --------------------------------------------------
def _segment_transcript(transcript: str, questions: list) -> list:
    if not questions or not transcript or len(transcript.strip()) < 30:
        return []

    prompt = f"""Split this interview transcript into segments, one per question.
The questions were asked in this exact order. Match each answer to its question.

QUESTIONS (in order):
{chr(10).join(f'{i+1}. {q}' for i, q in enumerate(questions))}

TRANSCRIPT:
{transcript[:8000]}

Return ONLY valid JSON:
{{
  "segments": [
    {{
      "question_index": 0,
      "answer_text": "the exact portion of transcript where they answered this question",
      "duration_estimate_seconds": 60
    }}
  ]
}}

RULES:
- Every question must have a segment even if answer was empty or brief
- Preserve the candidate's exact words in answer_text
- If boundaries are unclear, estimate based on topic changes"""

    raw = _llm(prompt, json_mode=True)
    parsed = _parse_json(raw)
    return parsed.get("segments", []) if parsed else []


# --- Per-Question Evaluation with Resume Context ------------------------------
def _evaluate_single_question(
    question: str, answer: str,
    jd: str, company: str, resume_text: str, skills: str,
    persona: str, strictness: str,
) -> dict:
    if not answer or len(answer.strip()) < 10:
        return {
            "scores": {"technical_accuracy": 0, "depth": 0, "relevance": 0, "structure": 0, "resume_alignment": 0},
            "overall": 5,
            "category": "WEAK",
            "what_was_good": "N/A — no substantive answer provided",
            "what_was_missing": "A complete answer addressing the question",
            "ideal_answer_outline": "The candidate should have directly addressed the question with specific examples from their experience.",
            "resume_gap_flag": None,
        }

    resume_context = resume_text[:2000] if resume_text else "No resume provided"
    skills_context = skills[:500] if skills else "No skills listed"

    persona_tone = {"friendly": "encouraging but honest", "neutral": "balanced and professional", "tough": "rigorous, FAANG-bar critical"}.get(persona, "balanced")
    strictness_bar = {"easy": "entry-level fundamentals", "standard": "mid-level industry standards", "strict": "senior/staff-level, top 1% bar"}.get(strictness, "industry standards")

    prompt = f"""Evaluate this interview answer. You are a {persona_tone} interviewer. Bar: {strictness_bar}.

QUESTION: {question}

CANDIDATE'S ANSWER: {answer}

CANDIDATE'S RESUME (for alignment check):
{resume_context}

CANDIDATE'S LISTED SKILLS: {skills_context}

COMPANY: {company}
JOB REQUIREMENTS: {jd[:600]}

Score on these dimensions (each 0-100):
- technical_accuracy: Are technical claims correct? Right terminology?
- depth: Beyond surface? Explained WHY not just WHAT?
- relevance: Actually answered the question, or went off-topic?
- structure: Used STAR (behavioral) or logical breakdown (technical)?
- resume_alignment: Does answer match resume claims? If they claim expertise, did they show it?

Return ONLY valid JSON:
{{
  "scores": {{
    "technical_accuracy": <0-100>,
    "depth": <0-100>,
    "relevance": <0-100>,
    "structure": <0-100>,
    "resume_alignment": <0-100>
  }},
  "overall": <0-100 weighted average>,
  "category": "STRONG|ADEQUATE|WEAK",
  "what_was_good": "<specific praise — cite exact things they said>",
  "what_was_missing": "<specific gaps — what a better answer would include>",
  "ideal_answer_outline": "<3-5 bullet points: what a perfect answer covers>",
  "resume_gap_flag": "<null if no gap, otherwise: 'Claims X on resume but answer shows no real depth in X'>"
}}"""

    raw = _llm(prompt, json_mode=True)
    parsed = _parse_json(raw)
    if parsed and "scores" in parsed:
        return parsed
    return {
        "scores": {"technical_accuracy": 50, "depth": 50, "relevance": 50, "structure": 50, "resume_alignment": 50},
        "overall": 50, "category": "ADEQUATE",
        "what_was_good": "Could not evaluate", "what_was_missing": "Could not evaluate",
        "ideal_answer_outline": "N/A", "resume_gap_flag": None,
    }


# --- Deterministic Composite Scoring (Python math, NOT LLM) -------------------
def _compute_composite_score(per_question_evals: list, speech: dict, vision: dict) -> dict:
    # Content (60% weight)
    q_scores = [q.get("overall", 50) for q in per_question_evals if q]
    content_score = sum(q_scores) / len(q_scores) if q_scores else 0

    # Communication (25% weight)
    wpm = speech.get("words_per_minute", 0)
    filler_pct = speech.get("filler_ratio_percent", 0)
    comm_score = 100.0
    comm_penalties = []
    if wpm > 0 and (wpm < 100 or wpm > 180):
        comm_score -= 20
        comm_penalties.append(f"WPM: {wpm} ({'too slow' if wpm < 100 else 'too fast'}, -20pts)")
    if filler_pct > 5:
        deduction = min(filler_pct * 3, 30)
        comm_score -= deduction
        comm_penalties.append(f"Filler ratio: {filler_pct}% (-{deduction:.0f}pts)")
    comm_score = max(comm_score, 0)

    # Presence (15% weight)
    eye = vision.get("eye_contact_percent", 65)
    posture = vision.get("good_posture_percent", 70)
    engagement = vision.get("engagement_percent", 65)
    presence_score = eye * 0.4 + posture * 0.3 + engagement * 0.3

    final = content_score * 0.60 + comm_score * 0.25 + presence_score * 0.15

    return {
        "overall_score": round(final),
        "score_breakdown": {
            "content": {
                "score": round(content_score),
                "weight": "60%",
                "explanation": f"Average of {len(q_scores)} question scores",
            },
            "communication": {
                "score": round(comm_score),
                "weight": "25%",
                "penalties": comm_penalties if comm_penalties else ["No penalties — good pace and minimal fillers"],
            },
            "presence": {
                "score": round(presence_score),
                "weight": "15%",
                "components": {"eye_contact": eye, "posture": posture, "engagement": engagement},
            },
        },
    }


# --- Synthesis LLM Call (language only, scores are inputs) --------------------
def _synthesize_final(
    composite: dict, per_question_evals: list, speech: dict, vision: dict,
    resume_text: str, skills: str, jd: str, company: str, questions: list,
) -> dict:
    overall = composite["overall_score"]

    verified = []
    unverified = []
    for pq in per_question_evals:
        if pq.get("category") == "STRONG" and pq.get("scores", {}).get("resume_alignment", 0) >= 70:
            good = pq.get("what_was_good", "")
            if good and good != "N/A — no substantive answer provided":
                verified.append(good[:100])
        gap = pq.get("resume_gap_flag")
        if gap:
            unverified.append(gap)

    prompt = f"""Based on these ALREADY-COMPUTED interview results, generate a synthesis report.
You are NOT scoring — scores are final. You are writing the human-readable summary.

COMPUTED SCORES:
- Overall: {overall}/100
- Content: {composite['score_breakdown']['content']['score']}/100
- Communication: {composite['score_breakdown']['communication']['score']}/100
- Presence: {composite['score_breakdown']['presence']['score']}/100

PER-QUESTION RESULTS:
{json.dumps([{{"q": pq.get("question","")[:80], "score": pq.get("overall",50), "category": pq.get("category",""), "gap": pq.get("what_was_missing","")[:100]}} for pq in per_question_evals], indent=2)}

SPEECH: {speech.get('words_per_minute',0)} WPM, {speech.get('filler_word_count',0)} fillers
COMPANY: {company}
RESUME SKILLS: {skills[:300]}
JD EXCERPT: {jd[:400]}

Return ONLY valid JSON:
{{
  "executive_summary": "<2-3 sentences summarizing performance>",
  "hire_recommendation": "Strong Yes|Yes|Maybe|No|Strong No",
  "strengths": ["<top 3 specific strengths>"],
  "critical_improvements": ["<top 3 specific improvements needed>"],
  "resume_alignment_summary": {{
    "verified_claims": {json.dumps(verified[:5])},
    "unverified_claims": {json.dumps(unverified[:5])},
    "gaps_vs_jd": ["<skills required by JD but not demonstrated>"]
  }},
  "comparison_to_role": {{
    "meets_requirements": ["<skills from JD that were demonstrated>"],
    "below_requirements": ["<skills from JD that were weak or missing>"],
    "exceeds_requirements": ["<skills shown beyond JD requirements>"]
  }},
  "top_mistakes": [
    {{
      "type": "CONTENT|COMMUNICATION|STRUCTURE|BODY_LANGUAGE",
      "question_index": <which question 0-based, or -1 for general>,
      "quote": "<what they said, or empty string>",
      "problem": "<what was wrong>",
      "better_approach": "<specifically what a better response would be>"
    }}
  ],
  "training_plan_7_day": {{
    "day_1": {{"focus": "<topic>", "duration_minutes": 30, "drills": ["<drill>", "<drill>"]}},
    "day_2": {{"focus": "<topic>", "duration_minutes": 30, "drills": ["<drill>", "<drill>"]}},
    "day_3": {{"focus": "<topic>", "duration_minutes": 45, "drills": ["<drill>", "<drill>"]}},
    "day_4": {{"focus": "<topic>", "duration_minutes": 30, "drills": ["<drill>", "<drill>"]}},
    "day_5": {{"focus": "<topic>", "duration_minutes": 45, "drills": ["<drill>", "<drill>"]}},
    "day_6": {{"focus": "<topic>", "duration_minutes": 30, "drills": ["<drill>", "<drill>"]}},
    "day_7": {{"focus": "Full Mock Interview", "duration_minutes": 60, "drills": ["Complete mock session", "Self-review recording"]}}
  }}
}}"""

    raw = _llm(prompt, json_mode=True)
    return _parse_json(raw) or {
        "executive_summary": f"Overall score: {overall}/100",
        "hire_recommendation": "Maybe",
        "strengths": [], "critical_improvements": [],
        "resume_alignment_summary": {"verified_claims": [], "unverified_claims": [], "gaps_vs_jd": []},
        "comparison_to_role": {"meets_requirements": [], "below_requirements": [], "exceeds_requirements": []},
        "top_mistakes": [],
        "training_plan_7_day": {},
    }


def _empty_result(reason: str) -> dict:
    day_t = lambda i: {"focus": f"Day {i} Practice", "duration_minutes": 30, "drills": ["Practice answering aloud", "Record yourself"]}
    return {
        "overall_score": 10,
        "hire_recommendation": "No",
        "executive_summary": reason,
        "score_breakdown": {
            "content": {"score": 10, "weight": "60%", "explanation": "No speech detected"},
            "communication": {"score": 10, "weight": "25%", "penalties": [reason]},
            "presence": {"score": 50, "weight": "15%", "components": {"eye_contact": 50, "posture": 50, "engagement": 50}},
        },
        "per_question_results": [],
        "strengths": ["Showed up and attempted the interview"],
        "critical_improvements": [reason, "Ensure your microphone is on", "Speak clearly at length"],
        "resume_alignment_summary": {"verified_claims": [], "unverified_claims": [], "gaps_vs_jd": []},
        "comparison_to_role": {"meets_requirements": [], "below_requirements": [], "exceeds_requirements": []},
        "top_mistakes": [{"type": "PARTICIPATION", "question_index": -1, "quote": "", "problem": reason, "better_approach": "Complete a full interview session"}],
        "training_plan_7_day": {f"day_{i}": day_t(i) for i in range(1, 8)},
        "speech_metrics": {"word_count": 0, "words_per_minute": 0, "pace_assessment": "too_slow", "filler_word_count": 0, "filler_ratio_percent": 0, "filler_breakdown": []},
        "non_verbal_dashboard": {"eye_contact_percent": 50, "good_posture_percent": 50, "engagement_percent": 50, "concerns": [], "timeline_notes": ""},
    }


# --- Background Evaluation Task -----------------------------------------------
async def _run_evaluation(req: EvaluateRequest):
    print(f"\n[EvalService] === Starting evaluation for {req.interview_id} ===")

    # Step 1: Transcribe
    transcript = _transcribe(req.video_path)

    # Step 2: Vision analysis
    vision = _analyze_frames(req.video_path)

    # Step 3: Speech metrics (no AI)
    speech = _speech_metrics(transcript)

    if len(transcript.strip()) < 30:
        feedback = _empty_result("No meaningful speech detected. Ensure microphone was active.")
        overall_score = 10
    else:
        # Step 4: Check for pre-existing per-question transcripts (from browser Speech API)
        segments = []
        pre_segmented = False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{INTERVIEW_SERVICE_URL}/{req.interview_id}")
                if resp.status_code == 200:
                    session_data = resp.json()
                    qs = session_data.get("questions", [])
                    if any(q.get("transcript") for q in qs):
                        segments = [
                            {"question_index": i, "answer_text": q.get("transcript", "")}
                            for i, q in enumerate(qs)
                        ]
                        pre_segmented = True
                        print(f"[EvalService] Using {len(segments)} browser-captured transcripts")
        except Exception as e:
            print(f"[EvalService] Could not fetch pre-segmented transcripts: {e}")

        if not pre_segmented:
            segments = _segment_transcript(transcript, req.questions)
            print(f"[EvalService] LLM segmented transcript into {len(segments)} segments")

        # Step 5: Per-question evaluation with resume context
        per_question_evals = []
        for i, q in enumerate(req.questions):
            answer_text = ""
            for seg in segments:
                if seg.get("question_index") == i:
                    answer_text = seg.get("answer_text", "")
                    break

            print(f"[EvalService] Evaluating Q{i+1}/{len(req.questions)}: {q[:50]}...")
            evaluation = _evaluate_single_question(
                question=q, answer=answer_text,
                jd=req.job_description, company=req.company,
                resume_text=req.resume_text, skills=req.skills,
                persona=req.persona, strictness=req.strictness,
            )
            evaluation["question"] = q
            evaluation["answer_summary"] = answer_text[:300] if answer_text else ""
            per_question_evals.append(evaluation)

        # Step 6: Deterministic composite score
        composite = _compute_composite_score(per_question_evals, speech, vision)
        overall_score = composite["overall_score"]

        # Step 7: Language synthesis (NOT scoring)
        synthesis = _synthesize_final(
            composite=composite, per_question_evals=per_question_evals,
            speech=speech, vision=vision,
            resume_text=req.resume_text, skills=req.skills,
            jd=req.job_description, company=req.company, questions=req.questions,
        )

        feedback = {
            **composite,
            "per_question_results": per_question_evals,
            "speech_metrics": speech,
            "non_verbal_dashboard": {
                "eye_contact_percent": vision.get("eye_contact_percent", 65),
                "good_posture_percent": vision.get("good_posture_percent", 70),
                "engagement_percent": vision.get("engagement_percent", 65),
                "concerns": vision.get("concerns", []),
                "timeline_notes": vision.get("timeline_notes", ""),
            },
            **synthesis,
        }

    print(f"[EvalService] Evaluation complete. Score: {overall_score}")

    # Build per-question data for DB
    per_question_data = []
    pq_results = feedback.get("per_question_results", [])
    for i, pq in enumerate(pq_results):
        q_id = req.question_ids[i] if i < len(req.question_ids) else None
        if q_id:
            per_question_data.append({
                "question_id": q_id,
                "transcript": pq.get("answer_summary", ""),
                "score": pq.get("overall"),
                "evaluation": json.dumps({
                    "scores": pq.get("scores", {}),
                    "category": pq.get("category", ""),
                    "what_was_good": pq.get("what_was_good", ""),
                    "what_was_missing": pq.get("what_was_missing", ""),
                    "ideal_answer_outline": pq.get("ideal_answer_outline", ""),
                    "resume_gap_flag": pq.get("resume_gap_flag"),
                }),
            })

    # Patch interview session
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.patch(
                f"{INTERVIEW_SERVICE_URL}/{req.interview_id}/evaluation",
                json={
                    "overall_score": overall_score,
                    "feedback_summary": json.dumps(feedback),
                    "status": "evaluated",
                    "transcript": transcript,
                    "per_question_data": per_question_data,
                },
            )
        print(f"[EvalService] ✓ Updated interview {req.interview_id}")
    except Exception as e:
        print(f"[EvalService] ✗ Failed to update: {e}")


# --- Endpoints -----------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok", "service": "evaluation", "version": "5.0.0",
        "gemini": bool(gemini_model), "deepseek": bool(deepseek_client),
    }


@app.post("/evaluation/start", response_model=EvaluateResponse)
@limiter.limit("3/hour")
async def start_evaluation(request: Request, req: EvaluateRequest, background_tasks: BackgroundTasks):
    if not req.video_path:
        raise HTTPException(status_code=400, detail="video_path is required.")
    print(f"[EvalService] Evaluation queued for interview_id={req.interview_id}")
    background_tasks.add_task(_run_evaluation, req)
    return EvaluateResponse(
        interview_id=req.interview_id,
        status="processing",
        message="Evaluation started. Poll /interviews/{id} for status.",
    )
