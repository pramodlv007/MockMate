"""
MockMate Question Engine â€” Gemini-First with OpenAI Fallback
Generates deeply technical interview questions tailored to JD, role, and tech stack.
"""
import os
import json
import re
import random
from pathlib import Path
from dotenv import dotenv_values

# Load .env fresh every startup
backend_dir = Path(__file__).parent.parent.parent
config = dotenv_values(backend_dir / ".env")

GOOGLE_API_KEY = config.get("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
OPENAI_API_KEY = config.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")

print(f"[QuestionEngine] Gemini Key Present: {bool(GOOGLE_API_KEY)}")
print(f"[QuestionEngine] OpenAI Key Present: {bool(OPENAI_API_KEY)}")

# â”€â”€ Initialize Gemini â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
gemini_model = None
if GOOGLE_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GOOGLE_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        print("[QuestionEngine] âœ“ Gemini model initialized")
    except Exception as e:
        print(f"[QuestionEngine] Gemini init error: {e}")

# â”€â”€ Initialize OpenAI (fallback) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
openai_client = None
if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        print("[QuestionEngine] âœ“ OpenAI client initialized (fallback)")
    except Exception as e:
        print(f"[QuestionEngine] OpenAI init error: {e}")


# â”€â”€ Technology Extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
TECH_PATTERNS = [
    # Languages
    ("python", r"\bpython\b"),
    ("Java", r"\bjava\b(?!script)"),
    ("JavaScript", r"\bjavascript\b"),
    ("TypeScript", r"\btypescript\b"),
    ("Go", r"\b(?:golang|go)\b"),
    ("Rust", r"\brust\b"),
    ("C++", r"\bc\+\+\b"),
    ("C#", r"\bc#\b"),
    ("Swift", r"\bswift\b"),
    ("Kotlin", r"\bkotlin\b"),
    ("Ruby", r"\bruby\b"),
    ("PHP", r"\bphp\b"),
    ("Scala", r"\bscala\b"),
    # Frontend
    ("React", r"\breact\b"),
    ("Next.js", r"\bnext\.?js\b"),
    ("Vue", r"\bvue\b"),
    ("Angular", r"\bangular\b"),
    ("Svelte", r"\bsvelte\b"),
    ("Redux", r"\bredux\b"),
    ("Tailwind CSS", r"\btailwind\b"),
    # Backend
    ("Node.js", r"\bnode\.?js\b"),
    ("Django", r"\bdjango\b"),
    ("Flask", r"\bflask\b"),
    ("FastAPI", r"\bfastapi\b"),
    ("Spring Boot", r"\bspring\s*boot\b"),
    ("Express", r"\bexpress\b"),
    ("NestJS", r"\bnestjs\b"),
    ("Rails", r"\brails\b"),
    ("Laravel", r"\blaravel\b"),
    # Cloud & Infra
    ("AWS", r"\baws\b"),
    ("GCP", r"\bgcp\b"),
    ("Azure", r"\bazure\b"),
    ("Docker", r"\bdocker\b"),
    ("Kubernetes", r"\bkubernetes\b|\bk8s\b"),
    ("Terraform", r"\bterraform\b"),
    ("CI/CD", r"\bci/?cd\b"),
    ("Linux", r"\blinux\b"),
    # Databases
    ("PostgreSQL", r"\bpostgres(?:ql)?\b"),
    ("MySQL", r"\bmysql\b"),
    ("MongoDB", r"\bmongo(?:db)?\b"),
    ("Redis", r"\bredis\b"),
    ("Elasticsearch", r"\belasticsearch\b"),
    ("DynamoDB", r"\bdynamodb\b"),
    ("Cassandra", r"\bcassandra\b"),
    # Messaging / APIs
    ("Kafka", r"\bkafka\b"),
    ("RabbitMQ", r"\brabbitmq\b"),
    ("GraphQL", r"\bgraphql\b"),
    ("REST", r"\brest(?:ful)?\b"),
    ("gRPC", r"\bgrpc\b"),
    ("WebSocket", r"\bwebsocket\b"),
    # ML/Data
    ("Machine Learning", r"\bmachine\s*learning\b|\bml\b"),
    ("Deep Learning", r"\bdeep\s*learning\b"),
    ("TensorFlow", r"\btensorflow\b"),
    ("PyTorch", r"\bpytorch\b"),
    ("Pandas", r"\bpandas\b"),
    ("Spark", r"\bspark\b"),
    # Devops / Monitoring
    ("Prometheus", r"\bprometheus\b"),
    ("Grafana", r"\bgrafana\b"),
    ("Jenkins", r"\bjenkins\b"),
    ("GitHub Actions", r"\bgithub\s*actions\b"),
    ("Nginx", r"\bnginx\b"),
    ("Microservices", r"\bmicroservices?\b"),
]


def extract_technologies(jd: str, skills: str) -> list:
    """Extract tech stack from JD and skills with proper regex boundaries."""
    text = f"{jd} {skills}".lower()
    found = []
    for name, pattern in TECH_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            if name not in found:
                found.append(name)
    print(f"[QuestionEngine] Extracted tech: {found[:10]}")
    return found[:10]


# â”€â”€ Core Prompt Builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _build_prompt(company: str, role: str, skills: str, jd: str,
                  technologies: list, count: int, persona: str, strictness: str) -> str:
    """Build the prompt that works with both Gemini and OpenAI."""
    tech_display = ", ".join(technologies) if technologies else (skills or role)

    persona_desc = {
        "friendly": "warm and growth-focused but still deeply technical",
        "neutral": "professional, balanced, industry-standard depth",
        "tough": "demanding, no hand-holding, FAANG-level rigour",
    }.get(persona, "balanced")

    strictness_desc = {
        "easy": "conceptual understanding focus, encourage effort",
        "standard": "solid engineering fundamentals required",
        "strict": "top 1% bar â€” only extreme depth and precision accepted",
    }.get(strictness, "standard")

    # Detect seniority
    is_senior = any(w in role.lower() for w in ["senior", "lead", "staff", "principal", "architect", "manager"])

    system_design_instruction = ""
    if is_senior:
        system_design_instruction = (
            "- At least 2 questions MUST be system design / architecture questions "
            f"(e.g. 'Design a real-time notification system for {company}').\n"
        )

    return f"""You are an elite senior technical interviewer at {company} conducting a rigorous interview for a **{role}** position.

INTERVIEWER PERSONA: {persona_desc}
EVALUATION STRICTNESS: {strictness_desc}

â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
JOB DESCRIPTION (analyze this deeply):
{jd[:2000]}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
CANDIDATE'S DECLARED SKILLS: {skills or "Not specified"}
CORE TECHNOLOGIES DETECTED FROM JD: {tech_display}
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

YOUR TASK: Generate exactly {count} interview questions.

ABSOLUTE RULES:
1. NEVER generate generic questions like "Tell me about yourself", "Why this company?", "Describe a challenge", "What are your strengths?"
2. EVERY question MUST directly reference at least one specific technology from this list: {tech_display}
3. Questions must be scenario-based â€” give the candidate a realistic problem to solve
4. Include a healthy mix:
   - Live coding / algorithm questions with specific constraints
   - Deep-dive technical concept questions (internals, edge cases, trade-offs)
{system_design_instruction}5. Frame each question exactly as a real interviewer would ask it face-to-face
6. Questions should be specific to {company}'s domain and scale where possible
7. A strong {role} should be able to answer well; a junior engineer should struggle

Return ONLY a valid JSON object:
{{"questions": ["Question 1", "Question 2", ...]}}

Generate exactly {count} questions. No explanations, no markdown, just the JSON."""


# â”€â”€ LLM Callers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _call_gemini(prompt: str, count: int) -> list:
    """Generate questions using Gemini 1.5 Flash."""
    if not gemini_model:
        return []
    try:
        print("[QuestionEngine] Calling Gemini 1.5 Flash...")
        response = gemini_model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.75,
                "max_output_tokens": 2000,
                "response_mime_type": "application/json",
            }
        )
        text = response.text.strip()
        # Parse JSON
        data = json.loads(text)
        questions = data.get("questions", [])
        if questions and len(questions) >= count:
            print(f"[QuestionEngine] âœ“ Gemini returned {len(questions)} questions")
            return questions[:count]
        print(f"[QuestionEngine] Gemini returned only {len(questions)} questions, need {count}")
        return questions
    except Exception as e:
        print(f"[QuestionEngine] âœ— Gemini error: {e}")
        return []


def _call_openai(prompt: str, count: int) -> list:
    """Fallback: Generate questions using OpenAI gpt-4o-mini."""
    if not openai_client:
        return []
    try:
        print("[QuestionEngine] Calling OpenAI gpt-4o-mini (fallback)...")
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.75,
            max_tokens=2000,
        )
        data = json.loads(resp.choices[0].message.content)
        questions = data.get("questions", [])
        if questions and len(questions) >= count:
            print(f"[QuestionEngine] âœ“ OpenAI returned {len(questions)} questions")
            return questions[:count]
        return questions
    except Exception as e:
        print(f"[QuestionEngine] âœ— OpenAI error: {e}")
        return []


# â”€â”€ Smart Fallback (no API needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _smart_fallback(company: str, role: str, technologies: list, count: int, strictness: str) -> list:
    """Last resort: generate JD-aware questions from templates."""
    print("[QuestionEngine] Using smart template fallback (no API)")
    tech = technologies if technologies else [role]
    t1 = tech[0]
    t2 = tech[1] if len(tech) > 1 else t1

    pool = [
        f"You're building a high-traffic API endpoint using {t1} at {company}. A performance profiler shows the P99 latency spiked from 50ms to 2 seconds after a recent deploy. Walk me through exactly how you'd diagnose and fix this.",
        f"Implement an LRU cache in {t1} from scratch. What's the time complexity of get and put? How would you make it thread-safe?",
        f"Design the database schema and API contracts for {company}'s core product feature. How would you handle data migrations at scale?",
        f"You discover a memory leak in a {t1} microservice that only manifests under sustained load. Describe your debugging strategy step by step.",
        f"Compare {t1} and {t2} for building a real-time data pipeline. What are the trade-offs in terms of concurrency, memory management, and ecosystem?",
        f"A critical {t1} service at {company} is experiencing cascading failures. Walk me through your incident response â€” from detection to post-mortem.",
        f"Design a distributed rate limiter for {company}'s public API using {t2}. It must handle 100K RPM across multiple regions. What data structures and algorithms would you use?",
        f"Write a function in {t1} that finds the k most frequent elements in a data stream of 10 million items. Optimize for both time and space.",
        f"You need to migrate {company}'s monolithic {t1} application to microservices. Describe your decomposition strategy, communication patterns, and how you'd handle data consistency.",
        f"Explain the internal workings of {t1}'s garbage collector (or memory model). How does this knowledge influence the way you write production code?",
        f"Design a search system for {company} that handles 50M documents. Describe your indexing strategy, ranking algorithm, and how you'd ensure sub-100ms query latency.",
        f"A junior developer pushes code using {t1} that passes all unit tests but causes a subtle data corruption bug in production. How would you find it, fix it, and prevent it from happening again?",
        f"Architect a real-time notification system for {company} that supports email, push, and in-app channels with user preference management. Use {t2} where appropriate.",
        f"Explain the CAP theorem and how it concretely applies to a system you've built with {t2}. Which trade-off did you choose and why?",
        f"You're given a {t1} codebase with zero test coverage. You have 2 sprints to bring it to production readiness. What's your testing strategy?",
    ]

    if strictness == "strict":
        pool.append(f"Design {company}'s entire backend infrastructure from scratch using {t1} and {t2}. Cover scalability, fault tolerance, observability, and disaster recovery.")

    random.shuffle(pool)
    return pool[:count]


# â”€â”€ Main Engine Class â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class QuestionEngine:
    def generate(self, company: str, role: str, skills: str, jd: str,
                 count: int, persona: str, strictness: str) -> list:
        technologies = extract_technologies(jd, skills)
        prompt = _build_prompt(company, role, skills, jd, technologies, count, persona, strictness)

        # Tier 1: Gemini (free, fast)
        questions = _call_gemini(prompt, count)
        if len(questions) >= count:
            return questions[:count]

        # Tier 2: OpenAI (paid fallback)
        questions = _call_openai(prompt, count)
        if len(questions) >= count:
            return questions[:count]

        # Tier 3: Smart templates (always works)
        return _smart_fallback(company, role, technologies, count, strictness)


engine = QuestionEngine()
