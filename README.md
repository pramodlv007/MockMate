<div align="center">

#  MockMate

### AI-Powered Technical Interview Coach

**Practice. Get evaluated. Ace your next interview.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
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

## What is MockMate?

**MockMate** is a production-grade AI-powered mock interview platform that simulates real technical interviews for software engineers. Candidates can practice interviews for any company and role, record their video responses, and receive **instant, in-depth AI-generated feedback** — all without needing a human interviewer.

MockMate bridges the gap between practice and performance. Whether you're preparing for a FAANG interview or your first engineering role, MockMate delivers:

- **Role-specific, AI-generated questions** tailored to your target company, job description, and resume
- **Live video recording** directly in the browser — no external tools needed
- **Multi-agent GenAI evaluation** analyzing what you said, how you said it, and how you presented yourself
- **Detailed scorecards** with per-question breakdowns, top mistakes, and a 7-day personalized training plan
- **Secure authentication** with JWT access tokens and refresh token rotation

---

## How MockMate Helps You

| Problem | MockMate Solution |
|---|---|
| No access to real interviewers | AI interviewer simulates any company's persona |
| Generic prep resources | Questions generated from your actual resume + JD |
| No feedback after practice | Full AI scorecard delivered post-interview |
| Hard to identify weaknesses | Top-10 mistakes flagged with quotes and fixes |
| No structured study plan | Personalized 7-day improvement plan generated |
| Body language blind spots | Vision AI analyzes eye contact, posture, engagement |
| Filler words go unnoticed | Speech metrics: WPM, filler count, pace assessment |

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
│   /auth/* /users/* /interviews/* /profile/* → :8000          │
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
| `/questions/*` | AI question generation (Gemini 2.5 Flash + DeepSeek fallback) |
| `/interviews/*` | Session lifecycle, video upload to S3, transcript storage |
| `/evaluation/*` | 4-agent AI pipeline — transcription, content, vision, synthesis |

---

## GenAI Pipeline

MockMate's evaluation engine is a **4-agent AI pipeline** powered by Gemini 2.5 Flash.

```
Video Upload (stored on AWS S3)
     │
     ▼
Agent 1 · SCRIBE  ── Gemini 2.5 Flash native video transcription
     │                Output: per-question verbatim transcript
     │
     ├─────────────────────────────────────┐
     ▼                                     ▼
Agent 2 · OBSERVER                  Speech Metrics
Gemini Vision — 3 frames sampled    WPM · filler words · pace
Eye contact % · Posture %
Engagement score
     │                                     │
     └──────────────┬──────────────────────┘
                    ▼
Agent 3 · EVALUATOR + SYNTHESIZER  ── Gemini 2.5 Flash
Inputs:  Transcript + resume + JD + questions + vision + speech
Outputs:
  ├─ Overall score (0–100) + hire recommendation
  ├─ Section scores (Technical, Communication, Problem-Solving)
  ├─ Per-question breakdown with score + feedback
  ├─ Top-10 mistakes with direct quotes + suggested fixes
  ├─ Strengths & critical improvements
  └─ Personalized 7-day training plan
```

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

MockMate is deployed on **AWS** with a CI/CD pipeline via GitHub Actions.

```
git push origin main
        │
        ▼
GitHub Actions
  ├── Test — Python tests + TypeScript build
  ├── Build — Vite frontend with EC2 API URL
  ├── Sync  — rsync frontend/dist → EC2 via SSH
  ├── Deploy — SSH: git pull + docker build + restart
  └── Smoke test — health check against EC2
```

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
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=your-jwt-secret-key
GEMINI_API_KEY=your-gemini-api-key
QUESTION_SERVICE_URL=http://localhost:8000/questions
INTERVIEW_SERVICE_URL=http://localhost:8000/interviews
EVALUATION_SERVICE_URL=http://localhost:8000/evaluation
AUTH_SERVICE_URL=http://localhost:8000
```

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

### 4. Open the App

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API Docs | http://localhost:8000/docs |

---

## Project Structure

```
MockMate/
├── .github/workflows/deploy.yml   # CI/CD: test → build → EC2 deploy
├── backend/
│   ├── app_consolidated.py        # Single FastAPI app — all services mounted
│   ├── common/
│   │   ├── auth.py                # Shared JWT validation dependency
│   │   └── database.py            # SQLAlchemy engine + session
│   ├── services/
│   │   ├── auth/                  # Signup, login, token refresh, user profile
│   │   ├── profile/               # Resume upload, GitHub analysis
│   │   ├── question/              # AI question generation engine
│   │   │   ├── engine.py          # Gemini + DeepSeek, resume intelligence
│   │   │   └── company_patterns.py # Per-company question styles
│   │   ├── interview/             # Sessions, S3 video upload, transcripts
│   │   └── evaluation/            # 4-agent AI evaluation pipeline
│   ├── Dockerfile.consolidated    # Single-container build
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Home, Login, Signup, InterviewRoom, Results, Profile
│   │   ├── components/            # Reusable UI components
│   │   └── context/               # Auth context
│   └── package.json
└── Dockerfile.consolidated        # Root-level copy for EC2 deploy
```

---

## Authentication Flow

```
Signup/Login → Access Token (30 min, Bearer)
             + Refresh Token (7 days, rotation)
                   │
           Every 25 min → Silent /auth/refresh
                   │
           Logout  → Tokens cleared
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built by [Pramod](https://github.com/pramodlv007)

**MockMate — Because every interview deserves a rehearsal.**

</div>
