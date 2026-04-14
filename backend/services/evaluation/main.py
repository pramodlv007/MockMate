"""
MockMate Evaluation Service â€” Port 8005
Orchestrates the full post-interview evaluation pipeline using Gemini (primary) + OpenAI (fallback):
  Agent 1 (Scribe)     - Whisper / Gemini audio transcription
  Agent 2 (Evaluator)  - Gemini / GPT content scoring with per-question breakdown
  Agent 3 (Observer)   - Gemini / GPT Vision body language analysis
  Agent 4 (Synthesizer)- Final composite report + 7-day improvement plan
Updates the interview session in the Interview Service DB on completion.
"""
import os, json, re, base64, httpx
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from dotenv import dotenv_values

backend_dir = Path(__file__).parent.parent.parent
config = dotenv_values(backend_dir / ".env")

# â”€â”€â”€ API Keys â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GOOGLE_API_KEY = config.get("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
OPENAI_API_KEY = config.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
VLM_API_KEY = config.get("MOCKMATE_VLM_API_KEY") or OPENAI_API_KEY

INTERVIEW_SERVICE_URL = os.getenv("INTERVIEW_SERVICE_URL", "http://localhost:8004")

# â”€â”€â”€ Initialize Gemini â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
gemini_model = None
if GOOGLE_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GOOGLE_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        print("[EvalService] âœ“ Gemini model initialized")
    except Exception as e:
        print(f"[EvalService] Gemini init error: {e}")

# â”€â”€â”€ Initialize OpenAI (fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
openai_client = None
if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        print("[EvalService] âœ“ OpenAI client initialized (fallback)")
    except Exception as e:
        print(f"[EvalService] OpenAI init error: {e}")

app = FastAPI(title="MockMate Evaluation Service", version="3.0.0")


# â”€â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class EvaluateRequest(BaseModel):
    interview_id: str
    video_path: str
    company: str
    job_description: str
    persona: str = "neutral"
    strictness: str = "standard"
    questions: List[str] = []
    question_ids: List[str] = []  # UUIDs for per-question storage

class EvaluateResponse(BaseModel):
    interview_id: str
    status: str
    message: str


# â”€â”€â”€ LLM Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _llm(prompt: str, system: str = "", json_mode: bool = False) -> Optional[str]:
    """Call Gemini first, fallback to OpenAI."""
    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    # Try Gemini first
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

    # Fallback to OpenAI
    if openai_client:
        try:
            msgs = []
            if system:
                msgs.append({"role": "system", "content": system})
            msgs.append({"role": "user", "content": prompt})
            kwargs = {"model": "gpt-4o-mini", "messages": msgs, "temperature": 0.4, "max_tokens": 4000}
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            return openai_client.chat.completions.create(**kwargs).choices[0].message.content
        except Exception as e:
            print(f"[EvalService] OpenAI LLM error: {e}")

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


# â”€â”€â”€ Agent 1: Scribe (Audio Transcription) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _transcribe(video_path: str) -> str:
    """Transcribe audio from video using OpenAI Whisper or Gemini."""
    path = Path(video_path)
    if not path.exists():
        print(f"[Scribe] Video file not found: {video_path}")
        return ""

    # Try OpenAI Whisper first (best transcription quality)
    if openai_client:
        try:
            with open(path, "rb") as f:
                result = openai_client.audio.transcriptions.create(
                    model="whisper-1", file=f, response_format="text"
                )
            print(f"[Scribe] âœ“ Whisper transcript: {len(result)} chars")
            return result
        except Exception as e:
            print(f"[Scribe] Whisper error: {e}")

    # Fallback: Use Gemini with uploaded audio
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
                print(f"[Scribe] âœ“ Gemini transcript: {len(response.text)} chars")
                return response.text
        except Exception as e:
            print(f"[Scribe] Gemini transcription error: {e}")

    print("[Scribe] âœ— No transcription available")
    return ""


# â”€â”€â”€ Agent 3: Observer (Vision Analysis) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _analyze_frames(video_path: str) -> dict:
    defaults = {
        "eye_contact_percent": 65,
        "good_posture_percent": 70,
        "engagement_percent": 65,
        "concerns": [],
    }
    path = Path(video_path)
    if not path.exists():
        return defaults

    try:
        from moviepy import VideoFileClip
        from PIL import Image
        import io

        clip = VideoFileClip(str(path))
        duration = clip.duration
        times = [duration * 0.20, duration * 0.50, duration * 0.80]
        frames_b64 = []
        for t in times:
            frame = clip.get_frame(min(t, duration - 0.1))
            img = Image.fromarray(frame).resize((512, 512))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=80)
            frames_b64.append(base64.b64encode(buf.getvalue()).decode())
        clip.close()

        vision_prompt = (
            "Analyze these 3 frames from a mock interview video.\n"
            "Return ONLY valid JSON:\n"
            '{"eye_contact_percent": 0-100, "good_posture_percent": 0-100, '
            '"engagement_percent": 0-100, "concerns": ["list of behavioral flags"]}\n'
            "Do NOT identify or describe the person's identity."
        )

        # Try Gemini Vision
        if gemini_model:
            try:
                import google.generativeai as genai
                from PIL import Image as PILImage

                parts = [vision_prompt]
                for b64 in frames_b64:
                    img_bytes = base64.b64decode(b64)
                    img = PILImage.open(io.BytesIO(img_bytes))
                    parts.append(img)

                resp = gemini_model.generate_content(
                    parts,
                    generation_config={"response_mime_type": "application/json", "max_output_tokens": 500}
                )
                parsed = _parse_json(resp.text)
                if parsed:
                    print(f"[Observer] âœ“ Gemini vision: {parsed}")
                    return parsed
            except Exception as e:
                print(f"[Observer] Gemini vision error: {e}")

        # Fallback: OpenAI Vision
        if openai_client:
            try:
                content = [{"type": "text", "text": vision_prompt}]
                for b64 in frames_b64:
                    content.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"},
                    })
                resp = openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[{"role": "user", "content": content}],
                    response_format={"type": "json_object"},
                    max_tokens=400,
                )
                parsed = _parse_json(resp.choices[0].message.content)
                if parsed:
                    print(f"[Observer] âœ“ OpenAI vision: {parsed}")
                    return parsed
            except Exception as e:
                print(f"[Observer] OpenAI vision error: {e}")

    except Exception as e:
        print(f"[Observer] Frame extraction error: {e}")

    return defaults


# â”€â”€â”€ Speech Metrics (no model needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


# â”€â”€â”€ Agent 2+4: Evaluator + Synthesizer (per-question scoring) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _evaluate(
    transcript: str, speech: dict, vision: dict,
    company: str, jd: str, questions: List[str],
    persona: str, strictness: str,
) -> dict:
    if not transcript or len(transcript.strip()) < 30:
        return _empty_result("No meaningful transcript detected. Ensure microphone was active.")

    persona_map = {
        "friendly": "warm, supportive, encouraging",
        "neutral":  "balanced, professional, objective",
        "tough":    "rigorous, demanding, FAANG-level critical",
    }
    strictness_map = {
        "easy":     "focus on fundamentals, encourage effort",
        "standard": "real-world industry standards",
        "strict":   "top-1% benchmark, penalize every vague answer",
    }

    questions_str = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions)) if questions else "N/A"

    system = (
        f"You are a {persona_map.get(persona, 'balanced')} senior engineering interviewer at {company}. "
        f"Strictness: {strictness_map.get(strictness, 'standard')}."
    )

    prompt = f"""Evaluate this mock interview for a role at {company}.

INTERVIEW QUESTIONS ASKED:
{questions_str}

TRANSCRIPT (candidate's responses):
{transcript[:6000]}

JOB DESCRIPTION (partial):
{jd[:800]}

PRE-COMPUTED SPEECH METRICS (inject verbatim into speech_metrics):
- WPM: {speech['words_per_minute']}
- Pace: {speech['pace_assessment']}
- Fillers: {speech['filler_word_count']}

PRE-COMPUTED VISION METRICS (inject verbatim into non_verbal_dashboard):
- Eye contact: {vision.get('eye_contact_percent', 65)}%
- Posture: {vision.get('good_posture_percent', 70)}%
- Engagement: {vision.get('engagement_percent', 65)}%

Return ONLY valid JSON matching this EXACT schema:
{{
  "overall_score": <integer 0-100>,
  "hire_recommendation": "Strong Yes|Yes|Maybe|No|Strong No",
  "executive_summary": "<2-3 sentences>",
  "section_scores": {{
    "technical_depth": <0-100>,
    "communication_clarity": <0-100>,
    "structured_thinking": <0-100>,
    "problem_solving": <0-100>,
    "confidence_presence": <0-100>
  }},
  "per_question_scores": [
    {{
      "question_index": <0-based index>,
      "question": "<the question text>",
      "answer_summary": "<what the candidate said in 1-2 sentences>",
      "score": <0-100>,
      "feedback": "<specific feedback on this answer>",
      "category": "STRONG|ADEQUATE|WEAK"
    }}
  ],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "critical_improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "top_10_mistakes": [
    {{
      "type": "CONTENT|COMMUNICATION|STRUCTURE|BODY_LANGUAGE",
      "quote": "<exact phrase if applicable or empty string>",
      "problem": "<what was wrong>",
      "suggestion": "<better approach>"
    }}
  ],
  "training_plan_7_day": {{
    "day_1": {{"focus": "<topic>", "duration_minutes": 30, "drills": ["<drill 1>", "<drill 2>"]}},
    "day_2": {{"focus": "<topic>", "duration_minutes": 30, "drills": ["<drill 1>", "<drill 2>"]}},
    "day_3": {{"focus": "<topic>", "duration_minutes": 45, "drills": ["<drill 1>", "<drill 2>"]}},
    "day_4": {{"focus": "<topic>", "duration_minutes": 30, "drills": ["<drill 1>", "<drill 2>"]}},
    "day_5": {{"focus": "<topic>", "duration_minutes": 45, "drills": ["<drill 1>", "<drill 2>"]}},
    "day_6": {{"focus": "<topic>", "duration_minutes": 30, "drills": ["<drill 1>", "<drill 2>"]}},
    "day_7": {{"focus": "Mock Interview Practice", "duration_minutes": 60, "drills": ["Full mock interview", "Record and review"]}}
  }}
}}"""

    raw = _llm(prompt, system=system, json_mode=True)
    result = _parse_json(raw)
    if not result:
        return _empty_result("AI evaluation produced an invalid response.")

    # Inject pre-computed metrics
    result["speech_metrics"] = speech
    result["non_verbal_dashboard"] = {
        "eye_contact_percent": vision.get("eye_contact_percent", 65),
        "good_posture_percent": vision.get("good_posture_percent", 70),
        "engagement_percent": vision.get("engagement_percent", 65),
        "concerns": vision.get("concerns", []),
    }
    return result


def _empty_result(reason: str) -> dict:
    day_template = lambda i: {"focus": f"Day {i} Practice", "duration_minutes": 30, "drills": ["Practice answering aloud", "Record yourself"]}
    return {
        "overall_score": 10,
        "hire_recommendation": "No",
        "executive_summary": reason,
        "section_scores": {"technical_depth": 10, "communication_clarity": 10, "structured_thinking": 10, "problem_solving": 10, "confidence_presence": 10},
        "per_question_scores": [],
        "strengths": ["Showed up and attempted the interview"],
        "critical_improvements": [reason, "Ensure your microphone is on", "Speak clearly at length"],
        "top_10_mistakes": [{"type": "PARTICIPATION", "quote": "", "problem": reason, "suggestion": "Complete a full interview session"}],
        "training_plan_7_day": {f"day_{i}": day_template(i) for i in range(1, 8)},
        "speech_metrics": {"word_count": 0, "words_per_minute": 0, "pace_assessment": "too_slow", "filler_word_count": 0, "filler_ratio_percent": 0, "filler_breakdown": []},
        "non_verbal_dashboard": {"eye_contact_percent": 50, "good_posture_percent": 50, "engagement_percent": 50, "concerns": []},
    }


# â”€â”€â”€ Background evaluation task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async def _run_evaluation(req: EvaluateRequest):
    print(f"\n[EvalService] â•â•â• Starting evaluation for {req.interview_id} â•â•â•")

    # Agent 1: Transcribe
    transcript = _transcribe(req.video_path)

    # Agent 3: Vision Analysis
    vision = _analyze_frames(req.video_path)

    # Speech Metrics (no AI needed)
    speech = _speech_metrics(transcript)

    # Agent 2+4: Evaluate + Synthesize
    feedback = _evaluate(
        transcript=transcript, speech=speech, vision=vision,
        company=req.company, jd=req.job_description,
        questions=req.questions, persona=req.persona, strictness=req.strictness,
    )

    overall_score = feedback.get("overall_score", 10)
    print(f"[EvalService] âœ“ Evaluation complete. Score: {overall_score}")

    # Build per-question data for DB storage
    per_question_data = []
    pq_scores = feedback.get("per_question_scores", [])
    for i, pq in enumerate(pq_scores):
        q_id = req.question_ids[i] if i < len(req.question_ids) else None
        if q_id:
            per_question_data.append({
                "question_id": q_id,
                "transcript": pq.get("answer_summary", ""),
                "score": pq.get("score"),
                "evaluation": json.dumps({"feedback": pq.get("feedback", ""), "category": pq.get("category", "")}),
            })

    # Patch the interview session via Interview Service
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
        print(f"[EvalService] âœ“ Updated interview {req.interview_id} with results")
    except Exception as e:
        print(f"[EvalService] âœ— Failed to update interview service: {e}")


# â”€â”€â”€ Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@app.get("/health")
def health():
    return {"status": "ok", "service": "evaluation", "gemini": bool(gemini_model), "openai": bool(openai_client)}


@app.post("/evaluation/start", response_model=EvaluateResponse)
async def start_evaluation(req: EvaluateRequest, background_tasks: BackgroundTasks):
    """Kick off the evaluation pipeline asynchronously."""
    background_tasks.add_task(_run_evaluation, req)
    return EvaluateResponse(
        interview_id=req.interview_id,
        status="processing",
        message="Evaluation started. Poll /interviews/{id} for status updates.",
    )
