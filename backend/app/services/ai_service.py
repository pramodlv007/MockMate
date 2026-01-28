import os
import json
import base64
import re
from datetime import datetime
from typing import Optional, Dict, List
from dotenv import load_dotenv

load_dotenv()

# Try to import different LLM providers
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


class KnowledgeBase:
    """Local cache of high-quality interview questions for popular companies and roles"""
    
    DATA = {
        "google": {
            "behavioral": [
                "How would you improve a Google product which you currently use?",
                "Tell me about a time you led a team or managed a project.",
                "Describe your ideal work environment and management style.",
                "Tell me about a time you had to work with a difficult colleague/team member.",
                "How do you approach learning new technologies or adapting to significant changes?"
            ],
            "technical": [
                "Design a scalable system like Google Docs or Google Search.",
                "How would you find the majority element in a large array?",
                "Determine if a binary tree is symmetric.",
                "Explain how you would handle dynamic programming problems like the knapsack problem.",
                "How would you design a distributed rate limiter?"
            ]
        },
        "amazon": {
            "behavioral": [
                "Tell me about a time you went out of your way to help a customer. (Customer Obsession)",
                "Describe a project you owned from start to finish. (Ownership)",
                "Tell me about a time you made a quick decision with incomplete data. (Bias for Action)",
                "Tell me about a time you disagreed with a teammate. (Earn Trust)",
                "Tell me about a time you learned a new technology and applied it. (Learn and Be Curious)"
            ],
            "technical": [
                "Design a URL shortener or a key-value store with TTL.",
                "Find the longest palindromic substring in a given string.",
                "Check if two binary trees are identical (Same Tree).",
                "How would you return the level order traversal of a binary tree?",
                "Design a scalable notification system."
            ]
        },
        "microsoft": {
            "behavioral": [
                "What's your favorite Microsoft product and how would you improve it?",
                "How have you demonstrated leadership when you weren't the manager?",
                "How do you like to give and receive feedback?",
                "Tell me about a recent project and some technical difficulties you faced.",
                "Describe a time you took leadership in a task you were not expected to."
            ],
            "technical": [
                "Design an IDE like Visual Studio or a scalable microservice.",
                "Find the missing element in a sorted array.",
                "Detect a cycle in a linked list.",
                "Search for an element in a rotated sorted array.",
                "Design a search engine capable of handling world-scale traffic."
            ]
        },
        "frontend": {
            "technical": [
                "What is the Virtual DOM, and how does React use it to render the UI?",
                "Explain React Hooks (useState, useEffect) and why they were introduced.",
                "How do you optimize React app performance (memoization, lazy loading)?",
                "Explain the JavaScript Event Loop and how it handles asynchronous operations.",
                "Design a responsive web application like an image gallery or social feed."
            ]
        },
        "backend": {
            "technical": [
                "What makes an API RESTful? How do you version an API?",
                "Explain the trade-offs between SQL and NoSQL databases.",
                "How would you secure a public API (OAuth 2.0, JWT)?",
                "Describe your approach to designing a scalable microservices architecture.",
                "How do you handle data consistency in a distributed system (Saga pattern)?"
            ]
        }
    }

    @classmethod
    def get_questions(cls, company: str, role: str, count: int) -> List[str]:
        company = company.lower()
        role = role.lower()
        
        tech_pool = []
        behavioral_pool = []
        
        # Match company
        if company in cls.DATA:
            tech_pool.extend(cls.DATA[company].get("technical", []))
            behavioral_pool.extend(cls.DATA[company].get("behavioral", []))
            
        # Match role
        if "front" in role:
            tech_pool.extend(cls.DATA["frontend"]["technical"])
        elif "back" in role:
            tech_pool.extend(cls.DATA["backend"]["technical"])
            
        # Fallback to general pools if empty
        if not tech_pool:
            tech_pool.extend(cls.DATA["backend"]["technical"])
        if not behavioral_pool:
            behavioral_pool.extend(cls.DATA["google"]["behavioral"])
            
        num_tech = int(count * 0.6)
        num_behavioral = count - num_tech
        
        import random
        selected = random.sample(tech_pool, min(len(tech_pool), num_tech)) + \
                   random.sample(behavioral_pool, min(len(behavioral_pool), num_behavioral))
                   
        # Pad if needed
        while len(selected) < count:
            selected.append("Tell me about your most challenging project.")
            
        return selected[:count]


class WebSearcher:
    """Searches the web for interview questions using multiple providers"""
    
    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_API_KEY")
        self.tavily_api_key = os.getenv("TAVILY_API_KEY")
        
        # Initialize Gemini if available
        if GEMINI_AVAILABLE and self.google_api_key and self.google_api_key != "your-google-gemini-api-key-here":
            genai.configure(api_key=self.google_api_key)
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
            print("[WebSearcher] Gemini initialized successfully")
        else:
            self.gemini_model = None
            print("[WebSearcher] Gemini not available")
        
        # Initialize Tavily if available
        if TAVILY_AVAILABLE and self.tavily_api_key:
            self.tavily = TavilyClient(api_key=self.tavily_api_key)
            print("[WebSearcher] Tavily initialized successfully")
        else:
            self.tavily = None
            print("[WebSearcher] Tavily not available")
    
    def search_interview_questions(self, company: str, role: str, skills: str = "") -> dict:
        """
        Search for real interview questions from the web.
        Returns a dict with search results and source.
        """
        query = f"most frequently asked interview questions at {company} for {role}"
        if skills:
            query += f" skills: {skills[:100]}"
        
        results = {"source": "none", "questions": [], "research": ""}
        
        # Try Tavily first
        if self.tavily:
            try:
                print(f"[WebSearcher] Searching Tavily for: {query}")
                response = self.tavily.search(
                    query=query,
                    search_depth="advanced",
                    max_results=5,
                    include_answer=True
                )
                
                research = response.get("answer", "")
                for r in response.get("results", [])[:3]:
                    research += f"\n\nFrom {r.get('url', 'unknown')}:\n{r.get('content', '')[:500]}"
                
                if research:
                    return {"source": "tavily", "research": research}
            except Exception as e:
                print(f"[WebSearcher] Tavily error: {e}")
        
        # Try Gemini with web grounding (if enabled by user key)
        if self.gemini_model:
            try:
                print(f"[WebSearcher] Using Gemini for: {query}")
                prompt = f"""Search for the most commonly asked interview questions at {company} for a {role} position.
Include technical and behavioral questions from Glassdoor, LeetCode, and Blind.
Skills: {skills}"""
                response = self.gemini_model.generate_content(prompt)
                return {"source": "gemini", "research": response.text}
            except Exception as e:
                print(f"[WebSearcher] Gemini error: {e}")
        
        return results


class SpeechAnalyzer:
    """Analyzes speech patterns from transcript"""
    
    FILLER_WORDS = ["um", "uh", "like", "you know", "basically", "literally", "actually", "so", "right", "okay so"]
    
    def analyze_transcript(self, transcript: str, duration_seconds: float) -> dict:
        words = transcript.lower().split()
        word_count = len(words)
        
        filler_instances = []
        filler_count = 0
        for filler in self.FILLER_WORDS:
            count = transcript.lower().count(filler)
            if count > 0:
                filler_instances.append({"word": filler, "count": count})
                filler_count += count
        
        minutes = duration_seconds / 60 if duration_seconds > 0 else 1
        words_per_minute = round(word_count / minutes, 1)
        
        if words_per_minute < 100:
            pace_assessment = "too_slow"
        elif words_per_minute > 180:
            pace_assessment = "too_fast"
        else:
            pace_assessment = "optimal"
        
        filler_ratio = round((filler_count / max(word_count, 1)) * 100, 2)
        
        recs = []
        if words_per_minute < 100: recs.append("Practice speaking faster (optimal: 130-150 WPM).")
        if words_per_minute > 180: recs.append("Slow down for better clarity.")
        if filler_ratio > 5: recs.append("Reduce filler words like 'um' or 'like'.")
        
        return {
            "word_count": word_count,
            "words_per_minute": words_per_minute,
            "pace_assessment": pace_assessment,
            "filler_word_count": filler_count,
            "filler_ratio_percent": filler_ratio,
            "filler_breakdown": sorted(filler_instances, key=lambda x: x["count"], reverse=True),
            "recommendations": recs
        }


class AIService:
    """Main AI Service orchestrating research and evaluation"""
    
    def __init__(self):
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.google_key = os.getenv("GOOGLE_API_KEY")
        
        self.openai_client = OpenAI(api_key=self.openai_key) if OPENAI_AVAILABLE and self.openai_key else None
        
        if GEMINI_AVAILABLE and self.google_key and self.google_key != "your-google-gemini-api-key-here":
            genai.configure(api_key=self.google_key)
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.gemini_model = None
            
        self.searcher = WebSearcher()
        self.speech = SpeechAnalyzer()
        
        print(f"[AIService] Ready. OpenAI: {bool(self.openai_client)}, Gemini: {bool(self.gemini_model)}")

    def _call_llm(self, prompt: str, json_mode: bool = False) -> Optional[str]:
        # Try OpenAI
        if self.openai_client:
            try:
                kwargs = {"model": "gpt-4o", "messages": [{"role": "user", "content": prompt}], "temperature": 0.7}
                if json_mode: kwargs["response_format"] = {"type": "json_object"}
                return self.openai_client.chat.completions.create(**kwargs).choices[0].message.content
            except Exception as e:
                print(f"[AIService] OpenAI error: {e}")
        
        # Try Gemini
        if self.gemini_model:
            try:
                if json_mode: prompt += "\n\nReturn valid JSON."
                return self.gemini_model.generate_content(prompt).text
            except Exception as e:
                print(f"[AIService] Gemini error: {e}")
        
        return None

    def generate_questions(self, company: str, jd: str, count: int, user_profile: dict = None, persona: str = "neutral", strictness: str = "standard"):
        print(f"[AIService] Generating {count} questions for {company} (Persona: {persona}, Strictness: {strictness})")
        
        skills = user_profile.get("skills", "") if user_profile else ""
        
        # 1. Search Web or use Knowledge Base
        search_results = self.searcher.search_interview_questions(company, jd[:100], skills)
        research = search_results.get("research", "")
        
        if not research:
            print("[AIService] No web results, using local Knowledge Base")
            return KnowledgeBase.get_questions(company, jd, count)
        
        # 2. Generate with LLM using Research
        prompt = f"""You are a {persona} interviewer. Strictness Level: {strictness}.
Generate {count} interview questions for {company}.

WEB RESEARCH ON COMPANY QUESTIONS: {research[:2000]}
JOB DESCRIPTION: {jd[:500]}
CANDIDATE PROFILE: {user_profile}

The questions should be {strictness} and delivered in a {persona} tone.
Return JSON: {{"questions": ["Q1", "Q2", ...]}}"""


        resp = self._call_llm(prompt, json_mode=True)
        if resp:
            try:
                # Clean markdown
                resp = re.sub(r'```json\n?|\n?```', '', resp).strip()
                return json.loads(resp).get("questions", [])[:count]
            except:
                pass
                
        return KnowledgeBase.get_questions(company, jd, count)

    def evaluate_interview(self, video_path: str, company: str, jd: str, persona: str = "neutral", strictness: str = "standard") -> dict:
        print(f"[AIService] Evaluating: {video_path} (Strictness: {strictness}, Persona: {persona})")
        
        # Audio Transcription
        transcript = ""
        if self.openai_client:
            try:
                with open(video_path, "rb") as f:
                    transcript = self.openai_client.audio.transcriptions.create(model="whisper-1", file=f, response_format="text")
            except Exception as e:
                print(f"[AIService] Whisper error: {e}")

        # Vision Analysis
        vision_stats = self._analyze_video(video_path)
        
        # Speech Analysis
        speech_stats = self.speech.analyze_transcript(transcript, 300)
        
        if not transcript or len(transcript) < 50:
            return self._low_score_feedback("No speech detected.")
            
        # Evaluation Prompt with Strictness and Persona
        system_instruction = f"""You are a {persona} interviewer. 
Strictness Level: {strictness}. 
- If strictness is 'strict', be extremely critical and penalize small errors. Benchmark against Top 1% candidates.
- If 'easy', focus on encouragement and basic principles.
- If 'standard', use real-world industry standards."""

        prompt = f"""{system_instruction}

Evaluate this interview for {company}:
TRANSCRIPT: {transcript[:2000]}
STATS: {vision_stats}, {speech_stats}

Return JSON with: overall_score, section_scores (verbal_content, communication, non_verbal, structure, confidence), strengths, top_10_mistakes, recommendations, training_plan_7_day."""


        resp = self._call_llm(prompt, json_mode=True)
        if resp:
            try:
                resp = re.sub(r'```json\n?|\n?```', '', resp).strip()
                feedback = json.loads(resp)
                feedback["speech_metrics"] = speech_stats
                feedback["non_verbal_dashboard"] = vision_stats
                return {"score": feedback.get("overall_score", 50), "feedback": feedback}
            except:
                pass
                
        return self._low_score_feedback("Evaluation failed.")

    def _analyze_video(self, video_path: str) -> dict:
        # Default placeholder stats
        stats = {"eye_contact_percentage": 70, "good_posture_percentage": 80, "engagement_percentage": 75, "concerns": []}
        
        if not self.openai_client: return stats
        
        try:
            from moviepy import VideoFileClip
            from PIL import Image
            import io
            
            clip = VideoFileClip(video_path)
            duration = clip.duration
            frames = []
            for t in [duration*0.2, duration*0.5, duration*0.8]:
                frame = clip.get_frame(t)
                img = Image.fromarray(frame).resize((512, 512))
                buf = io.BytesIO()
                img.save(buf, format="JPEG")
                frames.append(base64.b64encode(buf.getvalue()).decode())
            clip.close()
            
            prompt = "Analyze these interview frames for eye contact and posture. Return JSON."
            messages = [{"role": "user", "content": [{"type": "text", "text": prompt}] + [{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{f}"}} for f in frames]}]
            
            resp = self.openai_client.chat.completions.create(model="gpt-4o", messages=messages, response_format={"type": "json_object"}).choices[0].message.content
            return json.loads(resp)
        except:
            return stats

    def _low_score_feedback(self, msg: str) -> dict:
        return {"score": 10, "feedback": {"summary": msg, "overall_score": 10, "top_10_mistakes": [{"type": "Participation", "problem": msg, "suggestion": "Actually answer the questions"}]}}

ai_service = AIService()
