"""
Quick test: Question Engine v3 — validates the combined prompt generation
Runs the engine directly without needing Docker / PostgreSQL.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from services.question.engine import (
    _extract_technologies, _classify_domain, _build_combined_prompt, engine
)

print("=" * 70)
print("TEST 1: Technology Extraction")
print("=" * 70)

jd = """We are looking for a Senior Backend Engineer to build scalable APIs 
using Python, FastAPI, and PostgreSQL. Experience with Docker, Kubernetes, 
Redis caching, and CI/CD pipelines required. Familiarity with AWS services 
(Lambda, S3, DynamoDB) is a plus."""

skills = "Python, FastAPI, PostgreSQL, Docker, AWS, Redis"
resume = """Built a real-time notification microservice using FastAPI and Redis Pub/Sub 
serving 50K concurrent users. Led migration from monolith to Kubernetes-orchestrated 
microservices on AWS EKS."""

techs = _extract_technologies(jd, skills, resume)
print(f"Extracted: {techs}")
assert "Python" in techs, "Should find Python"
assert "FastAPI" in techs, "Should find FastAPI"
assert "PostgreSQL" in techs, "Should find PostgreSQL"
assert "Docker" in techs, "Should find Docker"
assert "Kubernetes" in techs, "Should find Kubernetes"
assert "Redis" in techs, "Should find Redis"
assert "AWS" in techs, "Should find AWS"
print(f"✅ All expected technologies found ({len(techs)} total)\n")

print("=" * 70)
print("TEST 2: Domain Classification")
print("=" * 70)

# Backend
domain = _classify_domain(skills, jd, "Senior Backend Engineer")
print(f"Backend role → {domain}")
assert domain == "Backend", f"Expected Backend, got {domain}"

# ML
ml_skills = "PyTorch, TensorFlow, scikit-learn, NLP, transformers"
ml_jd = "Build and deploy machine learning models for NLP tasks"
domain = _classify_domain(ml_skills, ml_jd, "ML Engineer")
print(f"ML role → {domain}")
assert domain == "ML/AI", f"Expected ML/AI, got {domain}"

# Frontend
fe_skills = "React, TypeScript, Next.js, Redux, Tailwind CSS"
fe_jd = "Build responsive frontend applications with React and TypeScript"
domain = _classify_domain(fe_skills, fe_jd, "Frontend Engineer")
print(f"Frontend role → {domain}")
assert domain == "Frontend", f"Expected Frontend, got {domain}"

# DevOps
devops_skills = "Kubernetes, Docker, Terraform, AWS, CI/CD, Prometheus"
devops_jd = "Manage cloud infrastructure and deployment pipelines"
domain = _classify_domain(devops_skills, devops_jd, "DevOps Engineer")
print(f"DevOps role → {domain}")
assert domain == "DevOps", f"Expected DevOps, got {domain}"

print("✅ All domain classifications correct\n")

print("=" * 70)
print("TEST 3: Combined Prompt Build — Full Profile + Resume + JD")
print("=" * 70)

prompt = _build_combined_prompt(
    company="Google",
    role="Senior ML Engineer",
    jd="""Google is looking for a Senior ML Engineer to work on large-scale 
    recommendation systems. Requirements: 5+ years in ML, experience with 
    PyTorch/TensorFlow, distributed training, and deploying models at scale.
    Familiarity with transformer architectures and LLMs preferred.""",
    count=5,
    persona="tough",
    strictness="strict",
    full_name="Pramod LV",
    skills="Python, PyTorch, TensorFlow, scikit-learn, NLP, Kubernetes",
    experience_years=6,
    education="MS Computer Science, University of XYZ",
    github_url="https://github.com/pramodlv007",
    resume_text="""WORK EXPERIENCE
    Senior ML Engineer at TechCorp (2022-2025)
    - Built a real-time recommendation engine serving 10M users using PyTorch and FAISS
    - Reduced model inference latency by 60% through TensorRT optimisation and model distillation
    - Led migration from batch to streaming ML pipeline using Apache Kafka and Spark
    
    ML Engineer at DataCo (2020-2022)
    - Developed NLP classification models using BERT and fine-tuned transformers
    - Built end-to-end MLOps pipeline with MLflow, DVC, and Kubernetes
    - Improved model accuracy from 78% to 94% through feature engineering and hyperparameter tuning
    
    PROJECTS
    - Open-source RAG chatbot using LangChain + ChromaDB (500+ GitHub stars)
    - Custom vision model for manufacturing defect detection (deployed at 3 factories)""",
    technologies=["Python", "PyTorch", "TensorFlow", "scikit-learn", "NLP", "Kubernetes"],
    domain="ML/AI",
)

# Verify the prompt contains all key sections
assert "Pramod LV" in prompt, "Should contain candidate name"
assert "6" in prompt and "Years of Experience" in prompt, "Should contain experience years"
assert "MS Computer Science" in prompt, "Should contain education"
assert "github.com/pramodlv007" in prompt, "Should contain GitHub URL"
assert "TechCorp" in prompt, "Should contain resume work experience"
assert "recommendation engine" in prompt, "Should contain project details from resume"
assert "PyTorch" in prompt, "Should contain technologies"
assert "Google" in prompt, "Should contain company name"
assert "SENIOR+" in prompt or "senior" in prompt.lower(), "Should calibrate for senior"
assert "ML/AI" in prompt, "Should state the domain"
assert "40%" in prompt, "Should include ML/AI category distribution"
assert "BANNED" in prompt, "Should include banned question types"
assert "questions" in prompt.lower() and "5" in prompt, "Should ask for 5 questions"

print(f"Prompt length: {len(prompt)} chars")
print(f"✅ Prompt contains all required sections:\n"
      f"   ✓ Candidate name, experience, education, GitHub\n"
      f"   ✓ Resume projects and work history\n"
      f"   ✓ Company + JD context\n"
      f"   ✓ ML/AI domain-specific distribution\n"
      f"   ✓ Seniority calibration\n"
      f"   ✓ Banned question types\n")

print("=" * 70)
print("TEST 4: No Resume Scenario")
print("=" * 70)

prompt_no_resume = _build_combined_prompt(
    company="Amazon", role="Backend Engineer", jd="Build scalable services",
    count=5, persona="neutral", strictness="standard",
    skills="Python, Java", resume_text="",
    technologies=["Python", "Java"], domain="Backend",
)
assert "No resume uploaded" in prompt_no_resume, "Should indicate no resume"
print(f"✅ No-resume prompt handled correctly ({len(prompt_no_resume)} chars)\n")

print("=" * 70)
print("TEST 5: Junior vs Senior Calibration")
print("=" * 70)

prompt_junior = _build_combined_prompt(
    company="Startup", role="Junior Developer", jd="Entry-level Python role",
    count=3, persona="friendly", strictness="easy",
    experience_years=1, skills="Python",
    technologies=["Python"], domain="General SWE",
)
assert "JUNIOR" in prompt_junior, "Should calibrate for junior"
print(f"✅ Junior (1yr) calibration: found JUNIOR keyword")

prompt_senior = _build_combined_prompt(
    company="Meta", role="Staff Engineer", jd="Lead architecture initiatives",
    count=5, persona="tough", strictness="strict",
    experience_years=10, skills="Python, Go, Kubernetes",
    technologies=["Python", "Go", "Kubernetes"], domain="Backend",
)
assert "SENIOR+" in prompt_senior, "Should calibrate for senior+"
assert "system design" in prompt_senior.lower(), "Should require system design for senior"
print(f"✅ Senior (10yr) calibration: found SENIOR+ and system design requirement\n")

print("=" * 70)
print("TEST 6: Live LLM Generation (Gemini)")
print("=" * 70)

from services.question.engine import GOOGLE_API_KEY, OPENAI_API_KEY
if GOOGLE_API_KEY or OPENAI_API_KEY:
    print("Calling LLM to generate 3 questions...")
    questions = engine.generate(
        company="Google",
        role="Senior Backend Engineer",
        skills="Python, FastAPI, PostgreSQL, Redis, Docker, Kubernetes",
        jd="""We're hiring a Senior Backend Engineer to design and build 
        high-performance APIs serving millions of users. You'll work with 
        Python/FastAPI microservices, PostgreSQL, Redis, and deploy on GKE.
        Experience with distributed systems and observability required.""",
        count=3,
        persona="neutral",
        strictness="standard",
        resume_text="""Built a notification microservice at ScaleUp Inc using FastAPI 
        and Redis Pub/Sub, handling 50K concurrent WebSocket connections.
        Led database migration from MySQL to PostgreSQL with zero-downtime 
        using logical replication. Designed rate-limiting middleware processing 
        100K RPM across 12 service instances.""",
        full_name="Pramod LV",
        experience_years=5,
        education="MS Computer Science",
        github_url="https://github.com/pramodlv007",
    )
    print(f"\n{'─' * 60}")
    print(f"Generated {len(questions)} questions:")
    print(f"{'─' * 60}")
    for i, q in enumerate(questions, 1):
        print(f"\nQ{i}: {q}")
    print(f"\n{'─' * 60}")
    
    assert len(questions) >= 1, "Should generate at least 1 question"
    assert all(isinstance(q, str) for q in questions), "All questions should be strings"
    assert all(len(q) > 20 for q in questions), "Questions should be substantial"
    print(f"\n✅ LLM generated {len(questions)} questions successfully!")
else:
    print("⚠️  No API keys found — skipping live LLM test")
    print("   Set GOOGLE_API_KEY or OPENAI_API_KEY in backend/.env to test")

print("\n" + "=" * 70)
print("ALL TESTS PASSED ✅")
print("=" * 70)
