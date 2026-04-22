"""
MockMate Question Engine v3 — Pure LLM Generation
===================================================
Every question is generated dynamically by combining:
  1. Candidate profile  (name, experience, education, skills, GitHub)
  2. Resume text        (projects, work history, achievements)
  3. Job description    (requirements, responsibilities, tech stack)
  4. Company context    (via web search for real interview patterns)
  5. Interviewer persona + strictness settings

NO predefined / hardcoded / template questions exist in this file.
"""
import os
import json
import re
import httpx
from pathlib import Path
from typing import Optional
from dotenv import dotenv_values

# ── Config ──────────────────────────────────────────────────────────────────────
backend_dir = Path(__file__).parent.parent.parent
config = dotenv_values(backend_dir / ".env")

GOOGLE_API_KEY = config.get("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
DEEPSEEK_API_KEY = config.get("DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK_API_KEY")
TAVILY_API_KEY = config.get("TAVILY_API_KEY") or os.getenv("TAVILY_API_KEY")

print(f"[QuestionEngine] Gemini Key: {bool(GOOGLE_API_KEY)} | DeepSeek Key: {bool(DEEPSEEK_API_KEY)} | Tavily Key: {bool(TAVILY_API_KEY)}")


# ── Gemini REST (no SDK) ────────────────────────────────────────────────────────
GEMINI_REST_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
gemini_available = bool(GOOGLE_API_KEY)
gemini_model = gemini_available   # for health-check alias
gemini_client = gemini_available  # for health-check alias
gemini_model_name = "gemini-2.5-flash"

# ── DeepSeek (fallback — OpenAI-compatible API, 10x cheaper than GPT-4o) ────────
deepseek_client = None
if DEEPSEEK_API_KEY:
    try:
        from openai import OpenAI
        deepseek_client = OpenAI(
            api_key=DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com",
        )
        print("[QuestionEngine] DeepSeek client ready (fallback)")
    except Exception as e:
        print(f"[QuestionEngine] DeepSeek init error: {e}")


# ═════════════════════════════════════════════════════════════════════════════════
# 1. TECHNOLOGY EXTRACTION
# ═════════════════════════════════════════════════════════════════════════════════
TECH_PATTERNS = [
    # Languages
    ("Python", r"\bpython\b"), ("Java", r"\bjava\b(?!script)"),
    ("JavaScript", r"\bjavascript\b"), ("TypeScript", r"\btypescript\b"),
    ("Go", r"\b(?:golang|go)\b"), ("Rust", r"\brust\b"),
    ("C++", r"\bc\+\+\b"), ("C#", r"\bc#\b"),
    ("Swift", r"\bswift\b"), ("Kotlin", r"\bkotlin\b"),
    ("Ruby", r"\bruby\b"), ("Scala", r"\bscala\b"), ("PHP", r"\bphp\b"),
    # Frontend
    ("React", r"\breact\b"), ("Next.js", r"\bnext\.?js\b"),
    ("Vue", r"\bvue\b"), ("Angular", r"\bangular\b"),
    ("Svelte", r"\bsvelte\b"), ("Redux", r"\bredux\b"), ("Tailwind", r"\btailwind\b"),
    # Backend
    ("Node.js", r"\bnode\.?js\b"), ("Django", r"\bdjango\b"),
    ("Flask", r"\bflask\b"), ("FastAPI", r"\bfastapi\b"),
    ("Spring Boot", r"\bspring\s*boot\b"), ("Express", r"\bexpress\b"),
    ("NestJS", r"\bnestjs\b"), ("Rails", r"\brails\b"), ("Laravel", r"\blaravel\b"),
    # Cloud & Infra
    ("AWS", r"\baws\b"), ("GCP", r"\bgcp\b"), ("Azure", r"\bazure\b"),
    ("Docker", r"\bdocker\b"), ("Kubernetes", r"\bkubernetes\b|\bk8s\b"),
    ("Terraform", r"\bterraform\b"), ("CI/CD", r"\bci/?cd\b"), ("Linux", r"\blinux\b"),
    # Databases
    ("PostgreSQL", r"\bpostgres(?:ql)?\b"), ("MySQL", r"\bmysql\b"),
    ("MongoDB", r"\bmongo(?:db)?\b"), ("Redis", r"\bredis\b"),
    ("Elasticsearch", r"\belasticsearch\b"), ("DynamoDB", r"\bdynamodb\b"),
    ("Cassandra", r"\bcassandra\b"),
    # Messaging / APIs
    ("Kafka", r"\bkafka\b"), ("RabbitMQ", r"\brabbitmq\b"),
    ("GraphQL", r"\bgraphql\b"), ("REST", r"\brest(?:ful)?\b"), ("gRPC", r"\bgrpc\b"),
    # ML/AI
    ("PyTorch", r"\bpytorch\b"), ("TensorFlow", r"\btensorflow\b"),
    ("scikit-learn", r"\bscikit[-\s]?learn\b|\bsklearn\b"),
    ("Hugging Face", r"\bhugging\s*face\b|\btransformers\b"),
    ("LLM", r"\bllm\b|\blarge\s+language\s+model\b"),
    ("Machine Learning", r"\bmachine\s*learning\b"),
    ("Deep Learning", r"\bdeep\s*learning\b"),
    ("NLP", r"\bnlp\b|\bnatural\s+language\b"),
    ("Computer Vision", r"\bcomputer\s+vision\b"),
    ("MLOps", r"\bmlops\b"), ("Pandas", r"\bpandas\b"),
    ("NumPy", r"\bnumpy\b"), ("Spark", r"\bspark\b"),
    # Monitoring
    ("Prometheus", r"\bprometheus\b"), ("Grafana", r"\bgrafana\b"),
    ("Microservices", r"\bmicroservices?\b"),
]


def _extract_technologies(jd: str, skills: str, resume: str = "") -> list[str]:
    """Extract technology names from all available text sources."""
    text = f"{jd} {skills} {resume}".lower()
    found = []
    for name, pattern in TECH_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE) and name not in found:
            found.append(name)
    return found[:15]


# ═════════════════════════════════════════════════════════════════════════════════
# 2. DOMAIN CLASSIFICATION
# ═════════════════════════════════════════════════════════════════════════════════
def _classify_domain(skills: str, jd: str, role: str) -> str:
    """Detect the candidate's primary skill domain. Role name is weighted heavily."""
    text = f"{skills} {jd} {role}".lower()
    role_lower = role.lower()
    signals = {
        "ML/AI": ["machine learning", "deep learning", "pytorch", "tensorflow", "scikit",
                   "nlp", "llm", "transformer", "neural", "mlops", "computer vision",
                   "reinforcement", "hugging", "bert", "gpt", "diffusion", "embedding",
                   "feature engineering", "data science", "model training", "pandas", "numpy"],
        "Frontend": ["react", "vue", "angular", "next.js", "frontend", "css", "html",
                      "typescript", "webpack", "tailwind", "svelte", "redux", "ui", "ux"],
        "Backend": ["fastapi", "django", "flask", "spring", "node", "express", "rails",
                     "backend", "api", "microservices", "rest", "grpc", "kafka", "rabbitmq"],
        "DevOps": ["kubernetes", "docker", "terraform", "ci/cd", "aws", "gcp", "azure",
                    "devops", "sre", "infrastructure", "helm", "ansible", "prometheus"],
    }
    scores = {domain: sum(s in text for s in kws) for domain, kws in signals.items()}

    # Role name is a very strong signal — give +3 bonus if role explicitly names a domain
    role_boost = {
        "ML/AI": ["ml ", "machine learning", "data scien", "ai "],
        "Frontend": ["frontend", "front-end", "ui ", "ux "],
        "Backend": ["backend", "back-end", "server", "api "],
        "DevOps": ["devops", "sre", "infrastructure", "platform"],
    }
    for domain, patterns in role_boost.items():
        if any(p in role_lower for p in patterns):
            scores[domain] += 3

    best = max(scores, key=scores.get)
    return best if scores[best] >= 2 else "General SWE"


# ═════════════════════════════════════════════════════════════════════════════════
# 2b. RESUME INTELLIGENCE EXTRACTION
# ═════════════════════════════════════════════════════════════════════════════════
def _extract_resume_intelligence(resume_text: str) -> dict:
    """Pre-process resume into structured data so question prompt can reference specifics."""
    if not resume_text or len(resume_text.strip()) < 100:
        return {}

    prompt = """Extract from this resume into STRICTLY valid JSON. Be precise — use exact names and technologies as written in the resume.

{
  "projects": [
    {"name": "exact project name", "tech": ["exact technologies used"], "what_they_built": "one sentence", "scale_or_impact": "numbers if mentioned"}
  ],
  "work_experience": [
    {"company": "name", "role": "title", "duration": "if mentioned", "key_claims": ["specific achievements or responsibilities"]}
  ],
  "strongest_skills": ["top 5 skills they've actually USED in projects, not just listed"],
  "gaps_or_red_flags": ["skills listed but no evidence of use", "buzzwords without depth"],
  "probing_angles": ["specific claims that an interviewer should press on to verify depth"]
}

RESUME:
""" + resume_text[:5000]

    # Use lite model for cheap extraction
    if GOOGLE_API_KEY:
        try:
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 2000,
                    "responseMimeType": "application/json",
                    "thinkingConfig": {"thinkingBudget": 0},
                },
            }
            resp = httpx.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent",
                params={"key": GOOGLE_API_KEY},
                json=payload,
                timeout=30.0,
            )
            if resp.status_code == 200:
                raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(raw.strip())
                print(f"[QuestionEngine] Resume intelligence extracted: {len(parsed.get('projects', []))} projects, {len(parsed.get('work_experience', []))} roles")
                return parsed
            else:
                # Fallback to main Gemini model if lite preview isn't available
                resp2 = httpx.post(
                    GEMINI_REST_URL,
                    params={"key": GOOGLE_API_KEY},
                    json=payload,
                    timeout=30.0,
                )
                if resp2.status_code == 200:
                    raw = resp2.json()["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw.strip())
                    print(f"[QuestionEngine] Resume intelligence (main model): {len(parsed.get('projects', []))} projects")
                    return parsed
        except Exception as e:
            print(f"[QuestionEngine] Resume extraction error: {e}")

    return {}


# ═════════════════════════════════════════════════════════════════════════════════
# 3. WEB SEARCH — Real interview questions for this company/role
# ═════════════════════════════════════════════════════════════════════════════════
def _search_interview_context(company: str, role: str, technologies: list[str]) -> str:
    """Search for real interview questions asked at this company for this role."""
    if not TAVILY_API_KEY:
        return ""
    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=TAVILY_API_KEY)
        tech_str = ", ".join(technologies[:4]) if technologies else role
        queries = [
            f"{company} {role} interview questions 2024 2025",
            f"{tech_str} technical interview questions experienced",
        ]
        results = []
        for q in queries:
            try:
                res = client.search(query=q, search_depth="basic", max_results=3, include_answer=True)
                for r in res.get("results", []):
                    content = r.get("content", "").strip()
                    if content and len(content) > 100:
                        results.append(f"[Source: {r.get('url', 'web')}]\n{content[:800]}")
            except Exception as e:
                print(f"[QuestionEngine] Tavily query error: {e}")
        if results:
            combined = "\n\n---\n\n".join(results[:5])
            print(f"[QuestionEngine] Web context: {len(combined)} chars")
            return combined
    except Exception as e:
        print(f"[QuestionEngine] Tavily init error: {e}")
    return ""


# ═════════════════════════════════════════════════════════════════════════════════
# 4. COMBINED PROMPT BUILDER — The heart of the engine
# ═════════════════════════════════════════════════════════════════════════════════
def _build_combined_prompt(
    company: str, role: str, jd: str, count: int,
    persona: str, strictness: str,
    # Profile data
    full_name: str = "", skills: str = "", experience_years: int = 0,
    education: str = "", github_url: str = "",
    # Resume
    resume_text: str = "",
    # Web search
    web_context: str = "",
    # Derived
    technologies: list[str] = None, domain: str = "General SWE",
) -> str:
    """
    Build a single, deeply fused prompt that combines ALL available candidate
    data with the job description and company context. Every question the LLM
    generates must be informed by this combined intelligence.
    """
    tech_display = ", ".join(technologies) if technologies else (skills or role)

    persona_desc = {
        "friendly": "supportive and growth-focused, but still technically deep — push the candidate to think further",
        "neutral": "professional, balanced — standard industry mid-level bar",
        "tough": "demanding, no hand-holding — senior FAANG bar, expects precision, depth, and optimal solutions",
    }.get(persona, "professional, balanced")

    strictness_desc = {
        "easy": "focus on conceptual understanding, encourage thinking aloud",
        "standard": "solid engineering fundamentals required, expect working approaches",
        "strict": "top 1% bar — only extreme depth, precision, and optimal solutions accepted",
    }.get(strictness, "solid engineering fundamentals")

    is_senior = any(w in role.lower() for w in
                    ["senior", "lead", "staff", "principal", "architect", "manager", "vp", "director"])

    # ── Section A: Candidate Intelligence ──
    candidate_lines = []
    if full_name:
        candidate_lines.append(f"Name: {full_name}")
    if experience_years and experience_years > 0:
        candidate_lines.append(f"Years of Experience: {experience_years}")
    if education:
        candidate_lines.append(f"Education: {education}")
    if skills:
        candidate_lines.append(f"Declared Skills: {skills}")
    if github_url:
        candidate_lines.append(f"GitHub: {github_url}")

    candidate_block = "\n".join(candidate_lines) if candidate_lines else "No profile data available"

    # ── Section B: Resume Intelligence (STRUCTURED) ──
    resume_intelligence = _extract_resume_intelligence(resume_text) if resume_text else {}

    if resume_intelligence and resume_intelligence.get("projects"):
        projects_str = ""
        for p in resume_intelligence["projects"]:
            projects_str += f"\n  - Project: {p['name']} | Tech: {', '.join(p.get('tech', []))} | Built: {p.get('what_they_built', 'N/A')}"

        experience_str = ""
        for w in resume_intelligence.get("work_experience", []):
            experience_str += f"\n  - {w.get('role', '')} at {w.get('company', '')} | Claims: {'; '.join(w.get('key_claims', []))}"

        probing = resume_intelligence.get("probing_angles", [])
        probing_str = "\n  - ".join(probing) if probing else "None identified"

        resume_block = f"""=== CANDIDATE'S VERIFIED BACKGROUND ===
PROJECTS:{projects_str}

WORK EXPERIENCE:{experience_str}

STRONGEST DEMONSTRATED SKILLS: {', '.join(resume_intelligence.get('strongest_skills', []))}

RED FLAGS TO PROBE: {'; '.join(resume_intelligence.get('gaps_or_red_flags', []))}

ANGLES TO PRESS ON:
  - {probing_str}
=== END BACKGROUND ===

RESUME-BASED QUESTION RULES:
- You MUST reference at least {max(2, count // 2)} specific projects or work experiences from above BY NAME.
- Frame questions like a real interviewer: "I see you built [project] using [tech]. Walk me through how you handled [challenge from JD]."
- Probe their claims: "You mention [achievement]. What specifically was YOUR contribution vs the team's?"
- Connect their past to the new role: "At [company] you did [X]. How would you approach that differently at {company} given [JD requirement]?"
- At least 1 question should target a RED FLAG or GAP identified above."""
    elif resume_text and len(resume_text.strip()) > 100:
        resume_block = f"""=== CANDIDATE'S RESUME (raw) ===
{resume_text[:4000]}
=== END RESUME ===

RESUME-BASED RULES:
- Reference specific projects and technologies from the resume.
- At least {max(2, count // 2)} questions must be based on resume claims."""
    else:
        resume_block = "[No resume uploaded — generate all questions from the Job Description and skills only]"

    # ── Section C: Web Search Intelligence ──
    if web_context and len(web_context.strip()) > 100:
        web_block = f"""=== REAL INTERVIEW QUESTIONS FOUND ONLINE FOR {company.upper()} / {role.upper()} ===
{web_context[:3000]}
=== END WEB RESEARCH ===

WEB RESEARCH RULES:
- Study the real questions above to understand what {company} actually asks in {role} interviews.
- Use these as INSPIRATION to understand the topics, difficulty level, and style of real interviews.
- Generate ORIGINAL questions in the same spirit — do NOT copy any question verbatim.
- Match the difficulty and focus areas to what this company's real interviewers emphasize."""
    else:
        web_block = ""

    # ── Section E: Company Interview Intelligence ──
    from .company_patterns import get_company_pattern
    company_pattern = get_company_pattern(company)
    company_intel_block = f"""
════════════════════════════════════════════════════════
SECTION E — COMPANY INTERVIEW INTELLIGENCE ({company.upper()})
════════════════════════════════════════════════════════
Interview Style: {company_pattern['style']}
Technical Emphasis: {', '.join(company_pattern['technical_emphasis'])}
What They Probe For: {company_pattern['what_they_probe']}
Example Question Patterns (for inspiration, NOT to copy):
{chr(10).join(f'  - {q}' for q in company_pattern['question_types'])}

RULE: Match {company}'s actual interview style described above.
If web research is available above, it takes priority over these patterns."""


    # ── Section D: Domain-specific guidance ──
    domain_guides = {
        "ML/AI": f"""DOMAIN-SPECIFIC DISTRIBUTION (YOU MUST FOLLOW):
  40% — ML theory & model internals (attention mechanisms, loss functions, regularisation, gradient issues)
  25% — Practical ML implementation (training pipelines, debugging models, handling imbalanced data, feature engineering)
  20% — MLOps & production (model serving, A/B testing, monitoring drift, scaling inference)
  15% — ML system design (recommendation engine, ranking system, search relevance at {company}'s scale)

BANNED: Generic LeetCode DSA (sorting, trees, linked lists), standard web system design, vague behavioural questions.""",

        "Backend": f"""DOMAIN-SPECIFIC DISTRIBUTION:
  30% — API design & performance (latency debugging, query optimisation, caching strategies)
  25% — Database design (schema modelling, indexing, transactions, migrations at scale)
  20% — Distributed systems (concurrency, async patterns, consistency vs availability)
  15% — System design (a specific {company} backend feature at production scale)
  10% — Targeted algorithms (rate limiting, consistent hashing, load balancing)

BANNED: Generic culture-fit, unrelated frontend questions.""",

        "Frontend": f"""DOMAIN-SPECIFIC DISTRIBUTION:
  35% — Framework deep-dives (React internals, hooks, state management, rendering optimisation)
  25% — Performance (bundle splitting, lazy loading, Core Web Vitals, rendering strategies)
  20% — Complex UI scenarios (real-time collaborative features, complex form state)
  20% — Frontend architecture (component library design, micro-frontends, state management at scale)

BANNED: Backend infrastructure, database internals.""",

        "DevOps": f"""DOMAIN-SPECIFIC DISTRIBUTION:
  35% — Infrastructure design & failure scenarios
  25% — CI/CD pipeline design, deployment strategies (blue-green, canary, rollback)
  20% — Observability (SLI/SLO/SLA, tracing, alerting, incident response)
  20% — Reliability engineering & cost optimisation at {company}'s scale

BANNED: Standard web dev, generic LeetCode DSA.""",

        "General SWE": f"""DOMAIN-SPECIFIC DISTRIBUTION:
  30% — System design using the candidate's specific tech stack
  30% — Technical problem-solving at the appropriate seniority level
  25% — Deep knowledge of technologies from the JD and resume
  15% — Project deep-dives (probe the candidate's past work)""",
    }
    domain_guide = domain_guides.get(domain, domain_guides["General SWE"])

    seniority_note = (
        f"\n- At least 1 question MUST be a {domain}-relevant system design question at {company}'s scale."
        if is_senior else ""
    )
    experience_note = ""
    if experience_years:
        if experience_years <= 2:
            experience_note = f"\n- Calibrate difficulty for a JUNIOR engineer ({experience_years} years). Focus on fundamentals and problem-solving approach."
        elif experience_years <= 5:
            experience_note = f"\n- Calibrate for a MID-LEVEL engineer ({experience_years} years). Expect solid design thinking and practical depth."
        else:
            experience_note = f"\n- Calibrate for a SENIOR+ engineer ({experience_years} years). Expect strong system design, leadership, and deep technical expertise."

    # ── ASSEMBLE THE PROMPT ──
    return f"""You are a principal-level technical interviewer at {company}, preparing questions for a {role} interview.

Your task: Generate exactly {count} interview questions that are MOST LIKELY to be asked at {company} for the {role} position, personalised to this specific candidate's background.

INTERVIEWER STYLE: {persona_desc}
EVALUATION BAR: {strictness_desc}
PRIMARY DOMAIN: {domain}

══════════════════════════════════════════════════════════
SECTION A — CANDIDATE PROFILE
══════════════════════════════════════════════════════════
{candidate_block}

══════════════════════════════════════════════════════════
SECTION B — CANDIDATE'S RESUME
══════════════════════════════════════════════════════════
{resume_block}

══════════════════════════════════════════════════════════
SECTION C — JOB DESCRIPTION
══════════════════════════════════════════════════════════
{jd[:2500]}

DETECTED TECHNOLOGIES: {tech_display}

{web_block}

══════════════════════════════════════════════════════════
SECTION D — QUESTION GENERATION RULES
══════════════════════════════════════════════════════════
{domain_guide}

UNIVERSAL RULES:
- Generate questions that {company} would ACTUALLY ask in a {role} interview based on their interview style and the JD requirements.
- Every question must reference at least one technology from: {tech_display}
- Questions must be concrete and scenario-based — give a realistic problem to solve.
- Frame each question exactly as a face-to-face interviewer would ask it.{seniority_note}{experience_note}
- If resume data is available, weave the candidate's specific projects and experience into the questions naturally.
- NEVER generate generic questions like: "Tell me about yourself", "Why this company?", "What are your strengths?", "Describe a challenge you faced."
- Each question should test a DIFFERENT technical concept — no redundancy.

══════════════════════════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════════════════════════
Return ONLY valid JSON (no markdown, no commentary, no extra text):
{{"questions": ["Question 1 full text", "Question 2 full text", ...]}}

Generate exactly {count} questions now."""


# ═════════════════════════════════════════════════════════════════════════════════
# 5. LLM CALLERS
# ═════════════════════════════════════════════════════════════════════════════════
def _parse_questions_json(raw: str) -> Optional[list[str]]:
    """Parse the LLM response, stripping markdown fences if present."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    try:
        data = json.loads(text)
        questions = data.get("questions", [])
        if isinstance(questions, list) and all(isinstance(q, str) for q in questions):
            return questions
    except json.JSONDecodeError as e:
        print(f"[QuestionEngine] JSON parse error: {e}")
    return None


def _call_gemini(prompt: str, count: int) -> list[str]:
    """Call Gemini REST API with 1 retry on parse failure."""
    if not GOOGLE_API_KEY:
        return []

    for attempt in range(2):  # retry once on parse failure
        try:
            print(f"[QuestionEngine] Gemini REST call (attempt {attempt + 1})...")
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.8,
                    "maxOutputTokens": 3000,
                    "responseMimeType": "application/json",
                    "thinkingConfig": {"thinkingBudget": 0},
                },
            }
            resp = httpx.post(
                GEMINI_REST_URL,
                params={"key": GOOGLE_API_KEY},
                json=payload,
                timeout=60.0,
            )
            if resp.status_code != 200:
                print(f"[QuestionEngine] Gemini HTTP {resp.status_code}: {resp.text[:300]}")
                return []

            raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            questions = _parse_questions_json(raw_text)
            if questions and len(questions) >= count:
                print(f"[QuestionEngine] Gemini returned {len(questions)} questions")
                return questions[:count]
            elif questions:
                print(f"[QuestionEngine] Gemini returned {len(questions)}/{count}, retrying...")
            else:
                print(f"[QuestionEngine] Gemini JSON parse failed, retrying...")

        except Exception as e:
            print(f"[QuestionEngine] Gemini error: {type(e).__name__}: {e}")
            return []

    return questions or []  # return whatever we got


def _call_deepseek(prompt: str, count: int) -> list[str]:
    """Call DeepSeek V3 as fallback (OpenAI-compatible API, ~10x cheaper than GPT-4o)."""
    if not deepseek_client:
        return []

    questions: list[str] = []
    for attempt in range(2):
        try:
            print(f"[QuestionEngine] DeepSeek deepseek-chat (attempt {attempt + 1})...")
            resp = deepseek_client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.8,
                max_tokens=3000,
            )
            raw_text = resp.choices[0].message.content
            questions = _parse_questions_json(raw_text) or []
            if questions and len(questions) >= count:
                print(f"[QuestionEngine] DeepSeek returned {len(questions)} questions")
                return questions[:count]
            elif questions:
                print(f"[QuestionEngine] DeepSeek returned {len(questions)}/{count}, retrying...")
            else:
                print(f"[QuestionEngine] DeepSeek JSON parse failed, retrying...")

        except Exception as e:
            print(f"[QuestionEngine] DeepSeek error: {e}")
            return []

    return questions


# ═════════════════════════════════════════════════════════════════════════════════
# 6. MAIN ENGINE
# ═════════════════════════════════════════════════════════════════════════════════
class QuestionEngine:
    def __init__(self):
        self._recent_questions: dict[str, list[str]] = {}  # user_id -> past questions

    def generate(
        self,
        company: str,
        role: str,
        skills: str,
        jd: str,
        count: int,
        persona: str,
        strictness: str,
        # Extended profile data
        resume_text: str = "",
        full_name: str = "",
        experience_years: int = 0,
        education: str = "",
        github_url: str = "",
        # Deduplication
        user_id: str = "",
    ) -> list[str]:
        """
        Generate interview questions by combining all available candidate data
        with the job description into a single LLM prompt.
        """
        # Step 1: Extract technologies from ALL sources
        technologies = _extract_technologies(jd, skills, resume_text)
        domain = _classify_domain(skills, jd, role)
        print(f"[QuestionEngine] Domain: {domain} | Tech: {technologies[:8]} | Resume: {len(resume_text)} chars")

        # Step 2: Web search for real interview questions at this company
        web_context = _search_interview_context(company, role, technologies)

        # Step 3: Build the combined prompt with ALL context
        prompt = _build_combined_prompt(
            company=company, role=role, jd=jd, count=count,
            persona=persona, strictness=strictness,
            full_name=full_name, skills=skills,
            experience_years=experience_years, education=education,
            github_url=github_url, resume_text=resume_text,
            web_context=web_context, technologies=technologies, domain=domain,
        )

        # Step 3b: Add deduplication block if user has prior questions
        past = self._recent_questions.get(user_id, []) if user_id else []
        if past:
            dedup_block = "\n\nPREVIOUSLY ASKED IN THIS USER'S PRIOR SESSIONS (DO NOT REPEAT OR REPHRASE):\n"
            dedup_block += "\n".join(f"- {q}" for q in past[-20:])
            prompt += dedup_block

        # Step 4: Gemini (primary)
        questions = _call_gemini(prompt, count)
        if len(questions) >= count:
            # Store for dedup
            if user_id:
                self._recent_questions.setdefault(user_id, []).extend(questions)
                self._recent_questions[user_id] = self._recent_questions[user_id][-50:]
            return questions[:count]

        # Step 5: DeepSeek (fallback)
        questions = _call_deepseek(prompt, count)
        if len(questions) >= count:
            if user_id:
                self._recent_questions.setdefault(user_id, []).extend(questions)
                self._recent_questions[user_id] = self._recent_questions[user_id][-50:]
            return questions[:count]

        # Step 6: If both LLMs fail, return partial results or an error message
        if questions:
            print(f"[QuestionEngine] Returning {len(questions)} partial questions")
            if user_id:
                self._recent_questions.setdefault(user_id, []).extend(questions)
                self._recent_questions[user_id] = self._recent_questions[user_id][-50:]
            return questions

        print("[QuestionEngine] All LLMs failed — returning error placeholder")
        return [
            f"The AI question generator is temporarily unavailable. Please try again in a moment. "
            f"(Target: {company} {role} interview with {count} questions)"
        ]


engine = QuestionEngine()
