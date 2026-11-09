<div align="center">

#  MockMate

### AI-Powered Technical Interview Coach

**Practice. Get evaluated. Ace your next interview.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker)](https://docker.com)
[![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini)

[![Deploy](https://github.com/pramodlv007/MockMate/actions/workflows/deploy.yml/badge.svg)](https://github.com/pramodlv007/MockMate/actions/workflows/deploy.yml)
[![AWS EC2](https://img.shields.io/badge/Backend-AWS_EC2-FF9900?style=for-the-badge&logo=amazonec2)](https://aws.amazon.com/ec2)
[![AWS S3](https://img.shields.io/badge/Storage-AWS_S3-FF9900?style=for-the-badge&logo=amazons3)](https://aws.amazon.com/s3)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)

**Live:** http://3.19.239.13

</div>

---

## The Problem

Most engineers fail technical interviews — not because they lack the skills, but because they've never practiced in a realistic setting. Mock interviews with peers are hard to schedule. Platforms like LeetCode train you to solve problems but not to communicate your thinking. You finish a practice session with no idea whether your answers, delivery, or body language were good enough.

**MockMate was built to fix that.**

The idea started from a simple question: *what if you could have an AI sit across from you, ask exactly the questions a real Google or Amazon interviewer would ask based on your resume and the job description, record your response, and then give you brutally honest feedback on everything — content, communication, confidence, pace, and eye contact?*

That's MockMate.

---

## What MockMate Does

MockMate is a full end-to-end interview simulation platform. You pick a company, paste a job description, and MockMate generates a tailored set of questions from your actual resume. You answer on camera in the browser. When you're done, a multi-agent AI pipeline evaluates the recording and returns a detailed scorecard within minutes.

**For the candidate:**
- Realistic interview experience — same pressure, same format, zero scheduling overhead
- Questions that reflect your actual experience, not generic bank questions
- Feedback that tells you *exactly* what you said wrong, with direct quotes and suggested rewrites
- A 7-day personalized study plan based on where you struggled

**For engineers studying AI/ML roles:**
- Resume-aware questions that probe your specific projects and tech stack
- Company-specific question styles (Google system design, Amazon leadership principles, Meta product sense, etc.)
- Strictness levels from beginner-friendly to FAANG bar

---

## How MockMate Helps You

| Pain Point | MockMate Solution |
|---|---|
| No realistic practice environment | Full video interview simulation in the browser |
| Generic prep that ignores your background | Questions generated from your resume + job description |
| Zero feedback after practice sessions | AI scorecard: content, communication, delivery, body language |
| Can't identify your own weak spots | Top-10 mistakes with direct quotes and specific fixes |
| No structure to your preparation | Personalized 7-day training plan based on your gaps |
| Unaware of filler words and pace issues | Speech metrics: WPM, filler count, pacing assessment |
| Body language blind spots | Vision AI scores eye contact, posture, and engagement |
| Questions repeat across sessions | Cross-session deduplication of previously asked questions |

---

## Architecture

MockMate runs as a **consolidated FastAPI application** — all microservices mounted as sub-apps in a single process, deployed on AWS EC2 behind nginx.

```
┌─────────────────────────────────────────────────────────────┐
│                  React Frontend (Vite + TS)                  │
│        Auth · Profile · Interview Room · Results             │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP  (nginx :80)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               nginx  (EC2 port 80)                           │
│   Static files → frontend/dist                               │
│   /auth /users /profile /interviews /rubric … → :8000        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         Consolidated FastAPI App  (Docker :8000)             │
│                                                              │
│  /auth/*        → Auth Service    (signup, login, refresh)   │
│  /users/*       → Auth Service    (profile CRUD)             │
│  /profile/*     → Profile Service (resume upload, GitHub)    │
│  /questions/*   → Question Service (AI question generation)  │
│  /interviews/*  → Interview Service (sessions, video upload) │
│  /evaluation/*  → Evaluation Service (AI scoring pipeline)   │
│  /rubric/*      → Rubric Service  (single-question practice) │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       Supabase DB      AWS S3       Gemini 2.5
      (PostgreSQL)    (Videos)      Flash API
```

### Service Breakdown

| Mount Path | Responsibility |
|---|---|
| `/auth/*` `/users/*` | Signup, login, JWT tokens, user profile |
| `/profile/*` | Resume upload & text extraction, GitHub analysis |
| `/questions/*` | AI question generation (Gemini 2.5 Flash + DeepSeek fallback). Internal only |
| `/interviews/*` | Session lifecycle, video upload to S3, transcripts, deletion. Owner-only access |
| `/evaluation/*` | AI evaluation pipeline. Internal only |
| `/rubric/*` | Practice mode: one question, graded against a fixed rubric (`services/rubric/bank.json`) |

"Internal only" endpoints require the `X-Internal-Token` header (`INTERNAL_API_TOKEN`); the services call
each other over `localhost` inside the one process.

---

## GenAI Pipeline

MockMate's evaluation runs as a background task after the video upload, powered by Gemini 2.5 Flash.

```
Video upload (S3, or local disk in dev)
     │
     ├─ Transcription ── Gemini: full transcript of the recording
     ├─ Body language ── Gemini video analysis (3-frame fallback): eye contact, posture, engagement
     └─ Speech metrics ─ no AI: real duration (ffmpeg), WPM, filler words
     │
     ▼
Per-question answers ── browser-captured transcripts if present, else LLM segmentation
     │
     ▼
Per-question evaluation ── LLM, with resume + JD context: 5 sub-scores + feedback
     │
     ▼
Composite score ── deterministic Python: content 60% · communication 25% · presence 15%
     │
     ▼
Synthesis ── LLM writes the summary only (scores are inputs, not outputs):
             hire recommendation, strengths, top mistakes, resume/JD alignment, 7-day training plan
```

Any failure marks the session `error`, which the Results page shows instead of a spinner.

### Question Generation Intelligence

- **Resume parsing** — extracts tech stack, projects, experience level
- **Company patterns** — tailored question styles for Google, Amazon, Meta, Apple, Microsoft, Netflix, Stripe, OpenAI, Uber, Airbnb
- **Cross-session deduplication** — never repeats questions for the same user
- **JD alignment** — maps job description keywords to question themes

### Interviewer Personas & Strictness

| Persona | Style |
|---|---|
| Friendly | Warm, supportive, encouraging |
| Neutral | Balanced, professional, objective |
| Tough | FAANG-level critical, rigorous |

| Strictness | Benchmark |
|---|---|
| Easy | Fundamentals focus |
| Standard | Real-world industry bar |
| Strict | Top-1% — penalizes every vague answer |

---

## Infrastructure & Deployment

MockMate is deployed on **AWS** with a CI/CD pipeline via GitHub Actions (`.github/workflows/deploy.yml`).

```
every push / PR
  ├── test   — backend pytest (backend/tests, rubric_eval) + frontend build; fails the run on any failure
  └── image  — build backend Docker image, smoke-test it against Postgres, push to GHCR (tagged with the SHA)
push to main only
  └── deploy — rsync frontend/dist + nginx config to EC2, pull the tested image, swap the container,
               roll back to the previous image if the health check fails, then smoke-test the live site
```

`.github/workflows/diagnose.yml` is a manual, read-only EC2 health check. `aws/setup-https.sh` sets up
Let's Encrypt on the server.

### AWS Stack

| Component | Service | Purpose |
|---|---|---|
| Compute | EC2 t2.micro | Runs Docker container (FastAPI + nginx) |
| Storage | S3 (`mockmate-videos-pramod`) | Interview video files |
| Database | Supabase PostgreSQL | Users, sessions, questions, scores |
| Web server | nginx | Static file serving + API reverse proxy |
| Container | Docker | Isolated, reproducible backend runtime |

### Cost

| Service | Cost |
|---|---|
| EC2 t2.micro | Free tier (12 months) |
| S3 | Free tier (5 GB) |
| Supabase | Free |
| GitHub Actions | Free |
| **Total** | **$0/month** (free tier) |

---

## Privacy & Data Retention

- **Consent:** users must tick a consent box on the interview setup page before anything is recorded.
- **Deletion:** `DELETE /interviews/{id}` (the **Delete** button in History) removes the S3 recording, then the
  session and its questions from the database. Only the owner can delete.
- **Retention:** recordings in S3 expire after 30 days. Apply this lifecycle rule once per bucket. It is not set by
  the app or CI, so the consent text is only true once you have run it:

```bash
aws s3api put-bucket-lifecycle-configuration --bucket mockmate-videos-pramod \
  --lifecycle-configuration '{"Rules":[{"ID":"expire-recordings-30d","Status":"Enabled",
    "Filter":{"Prefix":"videos/"},"Expiration":{"Days":30}}]}'
# verify
aws s3api get-bucket-lifecycle-configuration --bucket mockmate-videos-pramod
```

  Expiry removes the video only; the session's transcript and scores stay until the user deletes the interview.
- **Third parties:** recordings are uploaded to Google Gemini for transcription and body-language analysis;
  transcripts (text only) may go to DeepSeek as a fallback.

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (async Python 3.11) |
| Auth | `python-jose` (JWT), `passlib[bcrypt]` |
| ORM | SQLAlchemy + psycopg2 |
| HTTP Client | httpx (async) |
| Video Storage | boto3 → AWS S3 |
| Resume Parsing | pdfplumber, python-docx |
| Rate Limiting | slowapi |

### AI / GenAI
| Purpose | Model |
|---|---|
| Question Generation | Gemini 2.5 Flash (primary) · DeepSeek (fallback) |
| Video Transcription | Gemini 2.5 Flash native video |
| Content Evaluation | Gemini 2.5 Flash |
| Vision Analysis | Gemini 2.5 Flash (frame sampling) |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Video Recording | MediaRecorder API (native browser) |
| Speech-to-Text | Web Speech API (per-question transcripts) |
| State & Auth | React Context + JWT |

---

## Getting Started (Local)

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL (or a Supabase project)
- Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### 1. Clone & Configure

```bash
git clone https://github.com/pramodlv007/MockMate.git
cd MockMate
cp backend/.env.example backend/.env   # then fill in GOOGLE_API_KEY, SECRET_KEY, REFRESH_SECRET_KEY
```

`backend/.env.example` documents every variable the backend reads. Leave the `*_SERVICE_URL` variables unset.

### 2. Start Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app_consolidated:app --reload --port 8000
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Optional `frontend/.env`: `VITE_API_URL` (default `http://localhost:8000`) and `VITE_GOOGLE_CLIENT_ID`.

### Tests

```bash
cd backend
python -m pytest tests rubric_eval
```

The tests use in-memory SQLite and mock S3/LLM calls; no services or keys needed.

### 4. Open the App

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API Docs | http://localhost:8000/docs |

---

## Project Structure

```
MockMate/
├── .github/workflows/
│   ├── deploy.yml                 # CI/CD: test → image → EC2 deploy
│   └── diagnose.yml               # manual read-only EC2 diagnostics
├── aws/setup-https.sh             # Let's Encrypt setup on EC2
├── nginx/mockmate.conf            # static frontend + API reverse proxy
├── backend/
│   ├── app_consolidated.py        # Single FastAPI app — all services mounted
│   ├── common/
│   │   ├── auth.py                # JWT validation, internal-token check, rate-limit key
│   │   └── database.py            # SQLAlchemy engine + session
│   ├── services/
│   │   ├── auth/                  # Signup, login, Google sign-in, token refresh, user profile
│   │   ├── profile/               # Resume upload, GitHub analysis
│   │   ├── question/              # AI question generation engine
│   │   │   ├── engine.py          # Gemini + DeepSeek, resume intelligence
│   │   │   └── company_patterns.py # Per-company question styles
│   │   ├── interview/             # Sessions, video upload, transcripts, deletion
│   │   ├── evaluation/            # AI evaluation pipeline
│   │   └── rubric/                # Rubric-graded practice questions
│   ├── rubric_eval/               # Grader metrics + tests
│   ├── tests/                     # API tests (auth, ownership, limits, speech metrics)
│   ├── Dockerfile.consolidated    # The image CI builds and EC2 runs
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── pages/                 # Home, Login, Signup, InterviewSetup, InterviewRoom, Results, History, Practice, Profile
    │   ├── components/            # Header, GoogleButton
    │   └── context/               # Auth context
    └── package.json
```

---

## Authentication Flow

```
Signup / Login / Google → Access token (30 min, kept in memory, sent as Bearer)
                        + Refresh token (7 days, HttpOnly cookie, rotated on every refresh)
                                │
        On page load or any 401 → silent POST /auth/refresh, then retry the request
                                │
                     Logout → cookie cleared, in-memory token dropped
```

---

## License

MIT License. No LICENSE file has been added to the repository yet.

---

<div align="center">

Built by [Pramod](https://github.com/pramodlv007)

**MockMate — Because every interview deserves a rehearsal.**

</div>
