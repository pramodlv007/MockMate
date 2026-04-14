<div align="center">

#  MockMate

### AI-Powered Technical Interview Coach

**Practice. Get evaluated. Ace your next interview.**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)](https://docker.com)
[![Gemini](https://img.shields.io/badge/Google-Gemini_1.5-4285F4?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini)

[![Deploy](https://github.com/pramodlv007/MockMate/actions/workflows/deploy.yml/badge.svg)](https://github.com/pramodlv007/MockMate/actions/workflows/deploy.yml)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge&logo=render)](https://render.com)
[![AWS Lambda](https://img.shields.io/badge/Showcase-AWS_Lambda-FF9900?style=for-the-badge&logo=awslambda)](https://aws.amazon.com/lambda)

</div>

---

## 📌 What is MockMate?

**MockMate** is a production-grade AI-powered mock interview platform that simulates real technical interviews for software engineers. Candidates can practice interviews for any company and role, record their video responses, and receive **instant, in-depth AI-generated feedback** — all without needing a human interviewer.

MockMate bridges the gap between practice and performance. Whether you're preparing for a FAANG interview or your first engineering role, MockMate delivers:

- 🤖 **Role-specific, AI-generated questions** tailored to your target company, job description, and skill set
- 🎥 **Live video recording** directly in the browser — no external tools needed
- 🧠 **Multi-agent GenAI evaluation** analyzing what you said, how you said it, and how you presented yourself
- 📊 **Detailed scorecards** with per-question breakdowns, top mistakes, and a 7-day personalized training plan
- 🔐 **Secure authentication** with JWT access tokens and HttpOnly refresh cookies

---

## 💡 How MockMate Helps You

| Problem | MockMate Solution |
|---|---|
| No access to real interviewers | AI interviewer simulates any company's persona |
| Generic prep resources | Questions generated from your actual skills + JD |
| No feedback after practice | Full AI scorecard delivered post-interview |
| Hard to identify weaknesses | Top-10 mistakes flagged with quotes and fixes |
| No structured study plan | Personalized 7-day improvement plan generated |
| Body language blind spots | Vision AI analyzes eye contact, posture, engagement |
| Filler words go unnoticed | Speech metrics: WPM, filler count, pace assessment |

---

## 🏗️ Architecture

MockMate is built as a **microservices architecture** — six independent FastAPI services orchestrated behind a single API Gateway, with a React + TypeScript frontend.

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend (Vite/TS)                  │
│   Auth · Profile · Interview Room · Results · History            │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP (localhost:5173 → :8000)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway  :8000                            │
│   JWT validation · CORS · Request routing · User-ID injection    │
└──┬──────┬──────┬───────┬──────────┬────────────────────────────┘
   │      │      │       │          │
   ▼      ▼      ▼       ▼          ▼
 Auth  Profile Question Interview Evaluation
 :8001  :8002   :8003    :8004      :8005
   │      │       │        │          │
   ▼      ▼       ▼        ▼          ▼
 PostgreSQL  MongoDB   Gemini/   PostgreSQL  Gemini/OpenAI
 (users)     (profiles) OpenAI  (sessions)   (multi-agent)
                                    │
                               MinIO (videos)
```

### Microservices Breakdown

| Service | Port | Responsibility |
|---|---|---|
| **API Gateway** | 8000 | Single entry point — validates JWT, injects `x-user-id`, proxies to downstream services |
| **Auth Service** | 8001 | Signup/login, JWT access + HttpOnly refresh tokens, `/users/me` profile |
| **Profile Service** | 8002 | Resume upload, GitHub integration, MongoDB-backed profile storage |
| **Question Service** | 8003 | AI question generation engine (Gemini 1.5 Flash / GPT-4o) |
| **Interview Service** | 8004 | Session lifecycle, video upload, per-question storage, evaluation trigger |
| **Evaluation Service** | 8005 | Multi-agent AI pipeline — transcription, content analysis, vision, synthesis |

### Infrastructure

| Component | Role |
|---|---|
| **PostgreSQL 15** | User accounts, interview sessions, questions, scores |
| **MongoDB 6** | Unstructured resume data, GitHub analysis, AI logs |
| **Redis 7** | Session caching, rate limiting |
| **MinIO** | S3-compatible object storage for video/audio files |
| **RabbitMQ** | Message broker for async task queuing |

---

## 🚀 Production Deployment

MockMate is deployed across a **hybrid cloud stack** optimised for cost and reliability (~$8/month total):

```mermaid
graph TB
    User(["👤 User<br/>Browser"])

    subgraph CF["☁️ Cloudflare (Free)"]
        CDN["CDN + DDoS Protection<br/>yourdomain.com"]
    end

    subgraph Vercel["▲ Vercel (Free)"]
        FE["React Frontend<br/>Vite + TypeScript"]
    end

    subgraph Render["🎨 Render ($7/mo)"]
        GW["API Gateway :8000"]
        AUTH["Auth Service :8001"]
        PROF["Profile Service :8002"]
        QUEST["Question Service :8003"]
        INTV["Interview Service :8004"]
        EVAL["Evaluation Service :8005"]
        GW --> AUTH & PROF & QUEST & INTV & EVAL
    end

    subgraph Databases["🗄️ Managed Databases (Free Tier)"]
        PG[("Supabase PostgreSQL<br/>Auth + Sessions")]
        MONGO[("MongoDB Atlas M0<br/>Profiles")]
        REDIS[("Upstash Redis<br/>Caching")]
        R2[("Cloudflare R2<br/>Video Files")]
    end

    subgraph AWS["☁️ AWS (Showcase Layer ~$0.24/mo)"]
        SM["Secrets Manager<br/>API Keys"]
        subgraph Lambda["Lambda (Graviton2 ARM)"]
            LQ["question_generate<br/>10 req/min limit"]
            LE["evaluation_trigger<br/>3 req/hour limit"]
        end
        CW["CloudWatch<br/>Structured Logs + Dashboard"]
        LQ & LE --> SM
        LQ & LE --> CW
    end

    subgraph CICD["🔄 CI/CD — GitHub Actions (Free)"]
        GA["Push to main →<br/>Test → Build → Deploy"]
    end

    User --> CDN
    CDN --> FE
    CDN --> GW
    AUTH --> PG
    INTV --> PG
    PROF --> MONGO
    QUEST --> REDIS
    INTV --> R2
    GW -.->|"showcase routes"| LQ & LE
    GA -.->|"sam deploy"| Lambda
    GA -.->|"vercel deploy"| FE
    GA -.->|"deploy hooks"| GW
```

### CI/CD Flow

```
git push → GitHub Actions
              ├── 🧪 Run tests + build frontend
              ├── ▲  Deploy frontend → Vercel (prod)
              ├── 🎨 Trigger Render redeploys (all 6 services)
              └── ☁️  sam deploy → AWS Lambda (question + evaluation)
```

### Cost Breakdown

| Service | Plan | Cost |
|---|---|---|
| Vercel (frontend) | Hobby | Free |
| Render (6 microservices) | Starter | $7/mo |
| MongoDB Atlas (profiles) | M0 | Free |
| Supabase (PostgreSQL) | Free | Free |
| Upstash (Redis) | Free | Free |
| Cloudflare R2 (files) | Free 10GB | Free |
| Cloudflare (DNS + CDN) | Free | Free |
| AWS Lambda (2 routes) | Free tier | ~$0 |
| AWS Secrets Manager | 1 secret | ~$0.24/mo |
| Domain (.com) | Annual | ~$1/mo |
| **Total** | | **~$8/month** |

---

## 🤖 GenAI Pipeline

MockMate's evaluation engine is a **4-agent AI pipeline** that runs asynchronously after the interview recording is uploaded.

```
Video Upload
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  Agent 1 · SCRIBE (Transcription)                    │
│  OpenAI Whisper-1 (primary) → Gemini 1.5 (fallback)  │
│  Output: Full verbatim transcript                     │
└─────────────────────────┬────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐      ┌─────────────────────────┐
│  Agent 2 · OBSERVER │      │  Speech Metrics Engine  │
│  (Vision Analysis)  │      │  (No AI — Pure Math)    │
│  Gemini Vision /    │      │  WPM · Filler words ·   │
│  GPT-4o Vision      │      │  Pace assessment        │
│  3 frames sampled   │      └─────────────────────────┘
│  Eye contact %      │                  │
│  Posture %          │                  │
│  Engagement %       │                  │
└──────────┬──────────┘                  │
           │                             │
           └────────────┬────────────────┘
                        ▼
┌──────────────────────────────────────────────────────┐
│  Agent 3 · EVALUATOR + SYNTHESIZER                    │
│  Gemini 1.5 Flash (primary) → GPT-4o Mini (fallback)  │
│                                                       │
│  Inputs:  Transcript + JD + Questions + Speech Metrics │
│           + Vision Scores + Company Persona           │
│                                                       │
│  Outputs:                                             │
│  ├─ Overall score (0-100)                             │
│  ├─ Hire recommendation (Strong Yes → Strong No)      │
│  ├─ Section scores (Technical, Communication, etc.)   │
│  ├─ Per-question breakdown (score + feedback)          │
│  ├─ Top-10 mistakes with quotes + suggestions         │
│  ├─ Strengths & critical improvements                 │
│  └─ 7-day personalized training plan                  │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
           Interview Service DB updated
           Frontend polls → Results page
```

### Interviewer Personas & Strictness

The question generation and evaluation can be configured before each session:

| Persona | Style |
|---|---|
| 🤝 Friendly | Warm, supportive, encouraging |
| ⚖️ Neutral | Balanced, professional, objective |
| 💀 Tough | FAANG-level critical, rigorous |

| Strictness | Benchmark |
|---|---|
| Easy | Fundamentals focus |
| Standard | Real-world industry bar |
| Strict | Top-1% — penalizes every vague answer |

---

## 🛠️ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (async Python) |
| Auth | `python-jose` (JWT), `passlib[bcrypt]` |
| ORM | SQLAlchemy + psycopg2 (PostgreSQL) |
| Async DB | Motor (MongoDB async driver) |
| Caching | redis-py |
| Storage | MinIO (S3-compatible) |
| HTTP Client | httpx (async) |
| Rate Limiting | slowapi |
| Video | moviepy, opencv-python |

### AI / GenAI
| Purpose | Model / Library |
|---|---|
| Question Generation | Gemini 1.5 Flash / GPT-4o |
| Audio Transcription | OpenAI Whisper-1 / Gemini |
| Content Evaluation | Gemini 1.5 Flash / GPT-4o Mini |
| Vision Analysis | Gemini Vision / GPT-4o Vision |
| Web Research | Tavily Python client |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS |
| Video Recording | MediaRecorder API (native browser) |
| State & Auth | React Context + JWT |
| HTTP | Axios / Fetch |

### DevOps & Infrastructure
| Tool | Purpose |
|---|---|
| Docker + Docker Compose | Container orchestration |
| PostgreSQL 15 | Relational data |
| MongoDB 6 | Document storage |
| Redis 7 | Cache & sessions |
| MinIO | Object storage |
| RabbitMQ | Message broker |

---

## 🚀 Getting Started

### Prerequisites
- Docker Desktop (running)
- Python 3.11+
- Node.js 18+
- API Keys: Google Gemini and/or OpenAI

### 1. Clone & Configure

```bash
git clone https://github.com/pramodlv007/MockMate.git
cd MockMate
```

Copy the environment template and fill in your API keys:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your keys
```

Key environment variables:
```env
SECRET_KEY=your-jwt-secret
GOOGLE_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
DATABASE_URL=postgresql://mockmate:password@localhost:5432/mockmate_db
```

### 2. Start Infrastructure (Docker)

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts: PostgreSQL · MongoDB · Redis · MinIO · RabbitMQ

### 3. Start Backend Microservices

```bash
pip install -r backend/requirements.txt
.\start_services.ps1      # Windows
# or manually: uvicorn services.gateway.main:app --port 8000 ...
```

Six terminal windows will open, one per service.

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Open the App

| Service | URL |
|---|---|
| 🌐 Frontend | http://localhost:5173 |
| 🔀 API Gateway | http://localhost:8000/docs |
| 🔐 Auth Service | http://localhost:8001/docs |
| 👤 Profile Service | http://localhost:8002/docs |
| ❓ Question Service | http://localhost:8003/docs |
| 🎥 Interview Service | http://localhost:8004/docs |
| 📊 Evaluation Service | http://localhost:8005/docs |

---

## 📂 Project Structure

```
MockMate/
├── .github/
│   ├── workflows/
│   │   └── deploy.yml           # CI/CD: test → Vercel → Render → AWS Lambda
│   └── SECRETS_SETUP.md         # Guide for adding GitHub secrets
├── aws/                         # AWS Lambda showcase layer
│   ├── lambda/
│   │   ├── question_generate/   # Lambda: POST /questions/generate
│   │   │   ├── handler.py       # FastAPI + Mangum + Secrets Manager
│   │   │   └── requirements.txt
│   │   └── evaluation_trigger/  # Lambda: POST /evaluate/trigger
│   │       ├── handler.py       # Async pipeline + CloudWatch logging
│   │       └── requirements.txt
│   ├── template.yaml            # AWS SAM infrastructure template
│   ├── samconfig.toml           # SAM deploy defaults
│   └── README.md                # AWS setup guide
├── backend/
│   ├── common/                  # Shared DB config, utilities
│   ├── services/
│   │   ├── gateway/             # API Gateway (port 8000) — JWT + proxy
│   │   ├── auth/                # Auth Service (port 8001)
│   │   ├── profile/             # Profile Service (port 8002)
│   │   ├── question/            # Question Service (port 8003) — rate limited
│   │   ├── interview/           # Interview Service (port 8004)
│   │   └── evaluation/          # Evaluation Service (port 8005) — rate limited
│   ├── Dockerfile.service       # Multi-service Dockerfile
│   ├── requirements.txt
│   ├── .env                     # Real keys — never committed
│   └── .env.example             # Template with cloud URLs
├── frontend/
│   ├── src/
│   │   ├── pages/               # Home, Login, Signup, InterviewRoom, Results, History, Profile
│   │   ├── components/          # Reusable UI components
│   │   ├── context/             # Auth context
│   │   └── api.ts               # API client layer
│   ├── vercel.json              # Vercel SPA routing + cache config
│   └── package.json
├── render.yaml                  # Render IaC — all 6 services declared
├── docker-compose.yml           # Full local production stack
├── docker-compose.dev.yml       # Infrastructure only (dev)
└── start_services.ps1           # Dev startup script (Windows)
```

---

## 🔐 Authentication Flow

```
Signup/Login → Access Token (30 min, JSON body)
                + Refresh Token (7 days, HttpOnly cookie)
                      │
              Every 30 min → Silent /auth/refresh
                      │
              Logout → Cookie cleared
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ by [Pramod](https://github.com/pramodlv007)

**MockMate — Because every interview deserves a rehearsal.**

</div>
