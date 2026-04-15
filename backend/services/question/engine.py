"""
MockMate Question Engine - Gemini-First with OpenAI Fallback
Generates deeply technical, resume-driven, skill-domain-aware interview questions.
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

# -- Initialize Gemini --------------------------------------------------------
gemini_model = None
if GOOGLE_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GOOGLE_API_KEY)
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        print("[QuestionEngine] Gemini model initialized")
    except Exception as e:
        print(f"[QuestionEngine] Gemini init error: {e}")

# -- Initialize OpenAI (fallback) ---------------------------------------------
openai_client = None
if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        print("[QuestionEngine] OpenAI client initialized (fallback)")
    except Exception as e:
        print(f"[QuestionEngine] OpenAI init error: {e}")


# -- Technology Extraction ----------------------------------------------------
TECH_PATTERNS = [
    # Languages
    ("Python", r"\bpython\b"),
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
    ("Scala", r"\bscala\b"),
    # Frontend
    ("React", r"\breact\b"),
    ("Next.js", r"\bnext\.?js\b"),
    ("Vue", r"\bvue\b"),
    ("Angular", r"\bangular\b"),
    ("Svelte", r"\bsvelte\b"),
    ("Redux", r"\bredux\b"),
    ("Tailwind", r"\btailwind\b"),
    # Backend
    ("Node.js", r"\bnode\.?js\b"),
    ("Django", r"\bdjango\b"),
    ("Flask", r"\bflask\b"),
    ("FastAPI", r"\bfastapi\b"),
    ("Spring Boot", r"\bspring\s*boot\b"),
    ("Express", r"\bexpress\b"),
    ("NestJS", r"\bnestjs\b"),
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
    # ML/AI
    ("PyTorch", r"\bpytorch\b"),
    ("TensorFlow", r"\btensorflow\b"),
    ("scikit-learn", r"\bscikit[-\s]?learn\b|\bsklearn\b"),
    ("Hugging Face", r"\bhugging\s*face\b|\btransformers\b"),
    ("LLM", r"\bllm\b|\blarge\s+language\s+model\b"),
    ("Machine Learning", r"\bmachine\s*learning\b"),
    ("Deep Learning", r"\bdeep\s*learning\b"),
    ("NLP", r"\bnlp\b|\bnatural\s+language\b"),
    ("Computer Vision", r"\bcomputer\s+vision\b|\bcv\b"),
    ("MLOps", r"\bmlops\b"),
    ("Pandas", r"\bpandas\b"),
    ("NumPy", r"\bnumpy\b"),
    ("Spark", r"\bspark\b"),
    # Monitoring
    ("Prometheus", r"\bprometheus\b"),
    ("Grafana", r"\bgrafana\b"),
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
    print(f"[QuestionEngine] Extracted tech: {found[:12]}")
    return found[:12]


# -- Skill Domain Classifier --------------------------------------------------
def _classify_domain(skills: str, jd: str, role: str) -> str:
    """Detect primary skill domain to drive question category distribution."""
    text = f"{skills} {jd} {role}".lower()

    ml_signals    = ["machine learning", "deep learning", "pytorch", "tensorflow", "scikit",
                     "nlp", "llm", "transformer", "neural", "mlops", "computer vision",
                     "reinforcement", "hugging", "bert", "gpt", "diffusion", "embedding",
                     "feature engineering", "data science", "xgboost", "model training",
                     "pandas", "numpy", "regression", "classification"]
    fe_signals    = ["react", "vue", "angular", "next.js", "frontend", "css", "html",
                     "typescript", "webpack", "tailwind", "svelte", "redux", "ui", "ux"]
    be_signals    = ["fastapi", "django", "flask", "spring", "node", "express", "rails",
                     "backend", "api", "microservices", "rest", "grpc", "kafka", "rabbitmq"]
    devops_signals = ["kubernetes", "docker", "terraform", "ci/cd", "aws", "gcp", "azure",
                      "devops", "sre", "infrastructure", "helm", "ansible", "prometheus"]

    scores = {
        "ML/AI":    sum(s in text for s in ml_signals),
        "Frontend": sum(s in text for s in fe_signals),
        "Backend":  sum(s in text for s in be_signals),
        "DevOps":   sum(s in text for s in devops_signals),
    }
    primary = max(scores, key=scores.get)
    return primary if scores[primary] >= 2 else "General SWE"


def _domain_question_guide(domain: str, role: str, company: str, tech: list) -> str:
    """Return domain-specific question type instructions for the LLM."""
    t  = tech[0] if tech else "Python"
    t2 = tech[1] if len(tech) > 1 else t

    guides = {
        "ML/AI": f"""
QUESTION CATEGORY DISTRIBUTION (strictly follow):
  40% — Model internals & theory (e.g. transformer attention complexity, vanishing gradients, regularisation strategies, loss function trade-offs)
  25% — Practical ML implementation (e.g. debugging a training loop, handling class imbalance, hyperparameter tuning in {t})
  20% — MLOps & production deployment (e.g. model serving, A/B testing, monitoring data/concept drift at {company}'s scale)
  15% — ML system design (e.g. design a ranking model or recommendation engine for {company})

STRICTLY BANNED question types:
  - Generic LeetCode DSA (sorting, trees, linked lists) unless directly related to an ML algorithm
  - Standard web system design (URL shortener, ride-sharing, etc.)
  - Culture-fit or vague behavioural questions
""",
        "Backend": f"""
QUESTION CATEGORY DISTRIBUTION:
  30% — API design & performance optimisation using {t}/{t2} at scale
  25% — Database design, query optimisation, indexing strategies, transactions
  20% — Concurrency, async patterns, distributed systems challenges
  15% — System design (specific {company} backend feature at production scale)
  10% — Targeted algorithmic problems relevant to backend (rate-limiting, caching, consistent hashing)

BANNED: Generic culture-fit, unrelated frontend questions, vague "describe a time..." questions.
""",
        "Frontend": f"""
QUESTION CATEGORY DISTRIBUTION:
  35% — Deep framework internals (React reconciler, hooks, Virtual DOM, state management with {t})
  25% — Performance optimisation (bundle splitting, lazy loading, rendering strategies, Core Web Vitals)
  20% — Complex UI implementation scenario (e.g. build a real-time collaborative editor)
  20% — Frontend system design (e.g. design {company}'s component library or micro-frontend architecture)

BANNED: Backend infrastructure design, database internals, generic DSA unrelated to UI algorithms.
""",
        "DevOps": f"""
QUESTION CATEGORY DISTRIBUTION:
  35% — Infrastructure design & failure scenarios using {t}/{t2}
  25% — CI/CD pipeline design, deployment strategies (blue-green, canary, rollback)
  20% — Observability (SLI/SLO/SLA, distributed tracing, alerting, incident response)
  20% — Reliability engineering & cost optimisation at {company}'s scale

BANNED: Generic web development questions, standard LeetCode DSA.
""",
        "General SWE": f"""
QUESTION CATEGORY DISTRIBUTION:
  30% — System design using the candidate's specific tech stack
  30% — Algorithmic problems at the appropriate seniority level
  25% — Deep technical knowledge of technologies listed in the JD
  15% — Project deep-dives (probe the candidate's specific past experiences)
""",
    }
    return guides.get(domain, guides["General SWE"])


# -- Core Prompt Builder ------------------------------------------------------
def _build_prompt(company: str, role: str, skills: str, jd: str,
                  technologies: list, count: int, persona: str, strictness: str,
                  resume_text: str = "") -> str:
    """Build a resume-driven, skill-category-aware interview question prompt."""
    domain       = _classify_domain(skills, jd, role)
    tech_display = ", ".join(technologies) if technologies else (skills or role)
    print(f"[QuestionEngine] Domain detected: {domain}")

    persona_desc = {
        "friendly": "warm and encouraging but deeply technical — push the candidate to think deeper",
        "neutral":  "professional, balanced — FAANG mid-level bar",
        "tough":    "demanding, no hand-holding — L5/L6 FAANG bar, expects precision and depth",
    }.get(persona, "professional, balanced")

    strictness_desc = {
        "easy":     "focus on conceptual understanding, encourage thinking aloud",
        "standard": "solid engineering fundamentals required, expect working solutions",
        "strict":   "top 1% bar — only extreme depth, precision, and optimal solutions accepted",
    }.get(strictness, "solid engineering fundamentals required")

    is_senior = any(w in role.lower() for w in
                    ["senior", "lead", "staff", "principal", "architect", "manager", "vp", "director"])

    # Resume context block
    if resume_text and len(resume_text.strip()) > 100:
        resume_block = f"""
=== CANDIDATE RESUME (read carefully and use this to personalise questions) ===
{resume_text[:3500]}
=== END OF RESUME ===

RESUME-DRIVEN INSTRUCTIONS:
- Identify 2-3 specific PROJECTS or EXPERIENCES from the resume above
- Generate at least {max(1, count // 3)} questions that reference a specific project, technology, or achievement from the resume
- Format: "In your [Project Name] project you used [Technology] — explain how you handled [specific challenge]"
- This grounds questions in the candidate's real work, making them maximally relevant
"""
    else:
        resume_block = "\n[No resume uploaded — generate questions based on JD and declared skills only]\n"

    domain_guide = _domain_question_guide(domain, role, company, technologies)
    senior_note = (
        f"- At least 1 question MUST be a {domain}-specific system design question at {company}'s scale.\n"
        if is_senior else ""
    )

    return f"""You are a principal-level technical interviewer at {company} evaluating a {role} candidate.

STYLE: {persona_desc}
BAR: {strictness_desc}
PRIMARY SKILL DOMAIN DETECTED: {domain} — questions MUST reflect this domain

{resume_block}
=== JOB DESCRIPTION ===
{jd[:2000]}
=== END JD ===

CANDIDATE'S DECLARED SKILLS: {skills or "Not specified"}
DETECTED TECHNOLOGIES: {tech_display}

{domain_guide}

UNIVERSAL RULES:
{senior_note}- EVERY question must reference at least one technology from: {tech_display}
- Questions must be concrete, scenario-based — give a realistic problem to solve
- Frame each exactly as you would ask face-to-face: no meta-commentary, just the question
- NEVER generate: "Tell me about yourself", "Why this company?", "Describe a challenge", "What are your strengths?"

Return ONLY valid JSON (no markdown, no extra text):
{{"questions": ["Question 1 text", "Question 2 text", ...]}}

Generate exactly {count} questions."""


# -- LLM Callers --------------------------------------------------------------
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
                "max_output_tokens": 2500,
                "response_mime_type": "application/json",
            }
        )
        text = response.text.strip()
        data = json.loads(text)
        questions = data.get("questions", [])
        if questions and len(questions) >= count:
            print(f"[QuestionEngine] Gemini returned {len(questions)} questions")
            return questions[:count]
        print(f"[QuestionEngine] Gemini returned only {len(questions)} questions, need {count}")
        return questions
    except Exception as e:
        print(f"[QuestionEngine] Gemini error: {e}")
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
            max_tokens=2500,
        )
        data = json.loads(resp.choices[0].message.content)
        questions = data.get("questions", [])
        if questions and len(questions) >= count:
            print(f"[QuestionEngine] OpenAI returned {len(questions)} questions")
            return questions[:count]
        return questions
    except Exception as e:
        print(f"[QuestionEngine] OpenAI error: {e}")
        return []


# -- Smart Template Fallback --------------------------------------------------
def _smart_fallback(company: str, role: str, technologies: list, count: int,
                    strictness: str, domain: str = "General SWE") -> list:
    """Last resort: JD-aware, domain-specific template questions."""
    print(f"[QuestionEngine] Using smart template fallback (domain={domain})")
    tech = technologies if technologies else [role]
    t1 = tech[0]
    t2 = tech[1] if len(tech) > 1 else t1

    ml_pool = [
        f"Explain the mathematical intuition behind backpropagation and how it applies to training your {t1} model. What happens when gradients vanish?",
        f"You're training a {t1} classifier at {company} and it achieves 95% accuracy but performs poorly in production. Walk me through how you'd diagnose this.",
        f"Design a real-time recommendation system for {company} using {t1}. How do you handle the cold-start problem at scale?",
        f"Compare {t1} and {t2} for building a large-scale NLP pipeline. What are the trade-offs in training speed, memory, and deployment?",
        f"How would you detect and handle data drift in a {t1} model deployed at {company}? Describe your monitoring strategy.",
        f"Walk me through how you'd fine-tune a pre-trained {t1} transformer model for a domain-specific classification task with limited labelled data.",
        f"Design an MLOps pipeline for {company} that handles model versioning, A/B testing, and automated rollback using {t2}.",
        f"Explain the bias-variance trade-off and give a concrete example from a project where you managed it in a {t1} model.",
    ]
    swe_pool = [
        f"You're building a high-traffic API at {company} using {t1}. The P99 latency spiked from 50ms to 2s. Walk me through exactly how you'd diagnose and fix it.",
        f"Implement an LRU cache in {t1}. What's the time complexity of get/put? How do you make it thread-safe?",
        f"Design the data model and API contracts for {company}'s core product. How do you handle schema migrations at scale?",
        f"You discover a memory leak in a {t1} microservice that only appears under sustained load. Describe your debugging strategy.",
        f"Design a distributed rate limiter for {company}'s public API using {t2}. It must handle 100K RPM across multiple regions.",
        f"Compare {t1} and {t2} for a real-time data pipeline. What are the trade-offs in concurrency and memory management?",
        f"A {t1} service at {company} is experiencing cascading failures. Walk me through incident response from detection to post-mortem.",
        f"Design a search system for {company} handling 50M documents with sub-100ms P99 query latency.",
    ]

    pool = ml_pool if domain == "ML/AI" else swe_pool
    if strictness == "strict":
        pool.append(f"Design {company}'s entire {domain} infrastructure from scratch using {t1} and {t2}. Cover scalability, fault tolerance, observability, and disaster recovery.")

    random.shuffle(pool)
    return pool[:count]


# -- Main Engine Class --------------------------------------------------------
class QuestionEngine:
    def generate(self, company: str, role: str, skills: str, jd: str,
                 count: int, persona: str, strictness: str,
                 resume_text: str = "") -> list:
        technologies = extract_technologies(jd, skills)
        domain = _classify_domain(skills, jd, role)
        prompt = _build_prompt(company, role, skills, jd, technologies,
                               count, persona, strictness, resume_text)

        # Tier 1: Gemini (free, fast)
        questions = _call_gemini(prompt, count)
        if len(questions) >= count:
            return questions[:count]

        # Tier 2: OpenAI (paid fallback)
        if openai_client:
            questions = _call_openai(prompt, count)
            if len(questions) >= count:
                return questions[:count]

        # Tier 3: Domain-aware smart templates
        return _smart_fallback(company, role, technologies, count, strictness, domain)


engine = QuestionEngine()
