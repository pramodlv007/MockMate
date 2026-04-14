import os
import json
import base64
import re
from datetime import datetime
from typing import Optional, Dict, List
from dotenv import load_dotenv

load_dotenv()

# LLM provider imports
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    from tavily import TavilyClient
    TAVILY_AVAILABLE = True
except ImportError:
    TAVILY_AVAILABLE = False


# ---------------------------------------------------------------------------
# Web Searcher
# ---------------------------------------------------------------------------

class WebSearcher:
    """Searches the web for interview questions using Tavily (primary)."""

    def __init__(self):
        self.tavily_api_key = os.getenv("TAVILY_API_KEY")
        self.tavily = None
        if TAVILY_AVAILABLE and self.tavily_api_key:
            self.tavily = TavilyClient(api_key=self.tavily_api_key)
            print("[WebSearcher] Tavily initialized")
        else:
            print("[WebSearcher] Tavily not available — will skip web search")

    def search_interview_questions(self, company: str, role: str, skills: str = "", jd_summary: str = "") -> str:
        query = f"technical interview questions for {role} at {company} {skills} 2024 2025"
        if not self.tavily:
            return ""
        try:
            response = self.tavily.search(
                query=query,
                search_depth="advanced",
                max_results=5,
                include_answer=True,
            )
            research = response.get("answer", "")
            for r in response.get("results", [])[:3]:
                research += f"\n\nSource: {r.get('url','')}\nSnippet: {r.get('content','')[:500]}"
            return research
        except Exception as e:
            print(f"[WebSearcher] Tavily error: {e}")
            return ""


# ---------------------------------------------------------------------------
# Speech Analyzer
# ---------------------------------------------------------------------------

class SpeechAnalyzer:
    """Derives speech metrics from a plain transcript string."""

    FILLER_WORDS = [
        "um", "uh", "like", "you know", "basically", "literally",
        "actually", "so", "right", "okay so",
    ]

    def analyze_transcript(self, transcript: str, duration_seconds: float = 300) -> dict:
        words = transcript.lower().split()
        word_count = len(words)
        minutes = max(duration_seconds / 60, 0.1)
        wpm = round(word_count / minutes, 1)

        filler_instances: List[dict] = []
        filler_count = 0
        for fw in self.FILLER_WORDS:
            cnt = transcript.lower().count(fw)
            if cnt:
                filler_instances.append({"word": fw, "count": cnt})
                filler_count += cnt

        if wpm < 100:
            pace = "too_slow"
        elif wpm > 180:
            pace = "too_fast"
        else:
            pace = "optimal"

        filler_ratio = round((filler_count / max(word_count, 1)) * 100, 2)

        recs = []
        if wpm < 100:
            recs.append("Practice speaking faster — aim for 130–150 WPM.")
        if wpm > 180:
            recs.append("Slow down for better clarity.")
        if filler_ratio > 5:
            recs.append("Reduce filler words (um, like, you know).")

        return {
            "word_count": word_count,
            "words_per_minute": wpm,
            "pace_assessment": pace,
            "filler_word_count": filler_count,
            "filler_ratio_percent": filler_ratio,
            "filler_breakdown": sorted(filler_instances, key=lambda x: x["count"], reverse=True),
            "recommendations": recs,
        }


# ---------------------------------------------------------------------------
# Main AI Service
# ---------------------------------------------------------------------------

class AIService:
    """Orchestrates question generation and post-interview evaluation."""

    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.vlm_key = os.getenv("MOCKMATE_VLM_API_KEY")
        self.google_key = os.getenv("GOOGLE_API_KEY")

        self.openai_client: Optional[OpenAI] = None
        self.vlm_client: Optional[OpenAI] = None
        self.gemini_model = None

        if OPENAI_AVAILABLE and self.openai_key:
            self.openai_client = OpenAI(api_key=self.openai_key)
            print("[AIService] OpenAI primary client ready")

        if OPENAI_AVAILABLE and self.vlm_key:
            self.vlm_client = OpenAI(api_key=self.vlm_key)
            print("[AIService] VLM client ready")
        else:
            self.vlm_client = self.openai_client

        if GEMINI_AVAILABLE and self.google_key and self.google_key not in ("", "your-google-gemini-api-key-here"):
            genai.configure(api_key=self.google_key)
            self.gemini_model = genai.GenerativeModel("gemini-1.5-flash")
            print("[AIService] Gemini ready")

        self.searcher = WebSearcher()
        self.speech = SpeechAnalyzer()
        print(f"[AIService] Ready. OpenAI={bool(self.openai_client)}, Gemini={bool(self.gemini_model)}")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _call_llm(self, prompt: str, system: str = "", json_mode: bool = False) -> Optional[str]:
        """Call primary → VLM fallback → Gemini fallback."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        kwargs: dict = {"model": "gpt-4o", "messages": messages, "temperature": 0.7}
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        for client_label, client in [("primary", self.openai_client), ("vlm", self.vlm_client)]:
            if client is None:
                continue
            if client_label == "vlm" and client is self.openai_client:
                continue  # already tried
            try:
                return client.chat.completions.create(**kwargs).choices[0].message.content
            except Exception as e:
                print(f"[AIService] {client_label} OpenAI error: {e}")

        if self.gemini_model:
            try:
                full = (system + "\n\n" + prompt).strip()
                if json_mode:
                    full += "\n\nReturn valid JSON only."
                return self.gemini_model.generate_content(full).text
            except Exception as e:
                print(f"[AIService] Gemini error: {e}")

        return None

    def _parse_json(self, raw: str) -> Optional[dict]:
        """Strip markdown fences and parse JSON."""
        if not raw:
            return None
        raw = re.sub(r"```json\n?|\n?```", "", raw).strip()
        try:
            return json.loads(raw)
        except Exception as e:
            print(f"[AIService] JSON parse error: {e}")
            return None

    # ------------------------------------------------------------------
    # Question Generation
    # ------------------------------------------------------------------

    def generate_questions(
        self,
        company: str,
        jd: str,
        count: int,
        user_profile: Optional[dict] = None,
        persona: str = "neutral",
        strictness: str = "standard",
    ) -> List[str]:
        profile = user_profile or {}
        skills = profile.get("skills", "")
        role = profile.get("target_role", "Software Engineer")

        print(f"[AIService] Generating {count} questions for {role} @ {company}")

        research = self.searcher.search_interview_questions(company, role, skills, jd[:300])

        persona_desc = {
            "friendly": "warm, supportive, and encouraging",
            "neutral": "balanced and professional",
            "tough": "rigorous, demanding, and FAANG-level critical",
        }.get(persona, "balanced and professional")

        strictness_desc = {
            "easy": "focus on fundamental concepts, be forgiving of minor mistakes",
            "standard": "use real-world industry standards",
            "strict": "benchmark against top 1% candidates, penalize vague answers",
        }.get(strictness, "use real-world industry standards")

        system = (
            f"You are a Senior Engineering Manager at {company}. "
            f"Interview style: {persona_desc}. Strictness: {strictness_desc}."
        )

        prompt = f"""Generate exactly {count} highly technical interview questions.

ROLE: {role}
COMPANY: {company}
JOB DESCRIPTION:
{jd[:2000]}

CANDIDATE SKILLS: {skills or "Not specified"}
WEB RESEARCH (use for inspiration, not verbatim copying):
{research[:1500] if research else "No web research available."}

STRICT RULES:
1. Every question must be strictly technical — no generic behaviorals like "tell me about a challenge".
2. Reference specific technologies, tools, or patterns from the job description.
3. Mix question types: algorithmic, system design, debugging, architectural trade-offs.
4. Tailor difficulty to "{strictness}" strictness level.
5. Make questions specific to {company}'s domain where relevant.

Return ONLY valid JSON: {{"questions": ["Q1", "Q2", ...]}}"""

        result = self._parse_json(self._call_llm(prompt, system=system, json_mode=True))
        if result:
            qs = result.get("questions", [])[:count]
            if qs:
                print(f"[AIService] Generated {len(qs)} AI questions")
                return qs

        # Emergency fallback
        print("[AIService] LLM failed — using fallback questions")
        tech = skills.split(",")[0].strip() if skills else "the required tech stack"
        return [
            f"Explain your experience with {tech} in production systems.",
            f"How would you design the core service for {company}'s platform at scale?",
            f"Walk me through how you'd debug a memory leak in a {tech} service.",
            f"What are the trade-offs between microservices and a monolith for {role} work?",
            f"How do you ensure code quality and reliability in a {role} position?",
        ][:count]

    # ------------------------------------------------------------------
    # Post-Interview Evaluation
    # ------------------------------------------------------------------

    def evaluate_interview(
        self,
        video_path: str,
        company: str,
        jd: str,
        persona: str = "neutral",
        strictness: str = "standard",
    ) -> dict:
        print(f"[AIService] Evaluating interview for {company} (persona={persona}, strictness={strictness})")

        # Step 1: Transcribe audio with Whisper
        transcript = self._transcribe(video_path)

        # Step 2: Vision analysis (behavioral/posture)
        vision_stats = self._analyze_video_frames(video_path)

        # Step 3: Speech analysis from transcript
        speech_stats = self.speech.analyze_transcript(transcript, duration_seconds=300)

        if len(transcript.strip()) < 30:
            return self._empty_result("No meaningful speech detected in the recording.")

        # Step 4: LLM evaluation
        system = f"""You are a {persona} technical interviewer at {company}.
Strictness: {strictness}.
- strict: benchmark against top 1% engineers, penalize every vague answer.
- standard: industry bar, constructive feedback.
- easy: encourage growth, focus on effort and direction."""

        prompt = f"""Evaluate this mock interview transcript for a position at {company}.

JOB DESCRIPTION:
{jd[:1000]}

TRANSCRIPT:
{transcript[:3000]}

SPEECH METRICS (already computed):
- Words per minute: {speech_stats['words_per_minute']}
- Pace: {speech_stats['pace_assessment']}
- Filler words: {speech_stats['filler_word_count']}

VISION METRICS (already computed):
- Eye contact: {vision_stats.get('eye_contact_percent', 70)}%
- Good posture: {vision_stats.get('good_posture_percent', 75)}%
- Engagement: {vision_stats.get('engagement_percent', 70)}%

Return ONLY valid JSON matching EXACTLY this schema:
{{
  "overall_score": <integer 0-100>,
  "section_scores": {{
    "verbal_content": <integer 0-100>,
    "communication": <integer 0-100>,
    "non_verbal": <integer 0-100>,
    "structure": <integer 0-100>,
    "confidence": <integer 0-100>
  }},
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "recommendations": ["improvement 1", "improvement 2", "improvement 3"],
  "top_10_mistakes": [
    {{
      "type": "CONTENT|COMMUNICATION|STRUCTURE|BODY_LANGUAGE",
      "quote": "exact phrase from transcript if applicable",
      "problem": "what was wrong",
      "suggestion": "what to say instead"
    }}
  ],
  "hire_recommendation": "Strong Yes|Yes|Maybe|No|Strong No",
  "executive_summary": "2-3 sentence overall assessment",
  "training_plan_7_day": {{
    "day_1": {{
      "focus": "topic name",
      "duration_minutes": 30,
      "drills": ["drill 1", "drill 2"]
    }},
    "day_2": {{ ... }},
    "day_3": {{ ... }},
    "day_4": {{ ... }},
    "day_5": {{ ... }},
    "day_6": {{ ... }},
    "day_7": {{ ... }}
  }}
}}"""

        raw = self._call_llm(prompt, system=system, json_mode=True)
        feedback = self._parse_json(raw)

        if feedback:
            # Inject our computed metrics so frontend always has them
            feedback["speech_metrics"] = speech_stats
            feedback["non_verbal_dashboard"] = vision_stats
            score = feedback.get("overall_score", 50)
            print(f"[AIService] Evaluation complete. Score: {score}")
            return {"score": score, "feedback": feedback}

        return self._empty_result("AI evaluation failed to produce a valid result.")

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _transcribe(self, video_path: str) -> str:
        """Transcribe video audio using Whisper-1."""
        if not self.openai_client:
            print("[AIService] No OpenAI client for transcription")
            return ""
        try:
            with open(video_path, "rb") as f:
                result = self.openai_client.audio.transcriptions.create(
                    model="whisper-1", file=f, response_format="text"
                )
            print(f"[AIService] Transcript length: {len(result)} chars")
            return result
        except Exception as e:
            print(f"[AIService] Whisper transcription error: {e}")
            return ""

    def _analyze_video_frames(self, video_path: str) -> dict:
        """Extract frames and run GPT-4o Vision behavioral analysis."""
        defaults = {
            "eye_contact_percent": 70,
            "good_posture_percent": 75,
            "engagement_percent": 70,
            "concerns": [],
        }

        client = self.vlm_client or self.openai_client
        if not client:
            return defaults

        try:
            from moviepy import VideoFileClip
            from PIL import Image
            import io

            clip = VideoFileClip(video_path)
            duration = clip.duration
            # Sample 3 frames at 20%, 50%, 80% through the video
            sample_times = [duration * 0.20, duration * 0.50, duration * 0.80]
            frames_b64 = []
            for t in sample_times:
                frame = clip.get_frame(min(t, duration - 0.1))
                img = Image.fromarray(frame).resize((512, 512))
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=85)
                frames_b64.append(base64.b64encode(buf.getvalue()).decode())
            clip.close()

            content = [
                {
                    "type": "text",
                    "text": (
                        "Analyze these 3 frames from a mock interview for eye contact, posture, and engagement. "
                        "Return JSON with keys: eye_contact_percent (0-100), good_posture_percent (0-100), "
                        "engagement_percent (0-100), concerns (array of strings)."
                    ),
                }
            ]
            for b64 in frames_b64:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"},
                })

            resp = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": content}],
                response_format={"type": "json_object"},
                max_tokens=500,
            )
            parsed = self._parse_json(resp.choices[0].message.content)
            if parsed:
                print(f"[AIService] Vision analysis: {parsed}")
                return parsed
        except Exception as e:
            print(f"[AIService] Vision analysis error: {e}")

        return defaults

    def _empty_result(self, reason: str) -> dict:
        """Return a placeholder result when evaluation cannot proceed."""
        return {
            "score": 10,
            "feedback": {
                "overall_score": 10,
                "section_scores": {"verbal_content": 10, "communication": 10, "non_verbal": 50, "structure": 10, "confidence": 10},
                "strengths": ["Showed up and attempted the interview"],
                "recommendations": [reason, "Ensure your microphone is working", "Speak clearly and at length"],
                "top_10_mistakes": [{"type": "PARTICIPATION", "problem": reason, "suggestion": "Record a complete answer for each question", "quote": ""}],
                "hire_recommendation": "No",
                "executive_summary": reason,
                "speech_metrics": {"words_per_minute": 0, "pace_assessment": "too_slow", "filler_word_count": 0, "filler_ratio_percent": 0, "filler_breakdown": [], "recommendations": []},
                "non_verbal_dashboard": {"eye_contact_percent": 50, "good_posture_percent": 50, "engagement_percent": 50, "concerns": []},
                "training_plan_7_day": {
                    f"day_{i}": {"focus": f"Day {i} Practice", "duration_minutes": 30, "drills": ["Practice answering aloud", "Record yourself"]}
                    for i in range(1, 8)
                },
            },
        }


# Singleton instance
ai_service = AIService()
