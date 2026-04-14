---
description: Production-Grade MockMate Rebuild - Microservices Architecture
---

# MockMate Production Rebuild - Implementation Plan

## Phase 1: Architecture & Infrastructure Setup

### 1.1 Microservices Architecture
- **Auth Service** (Port 8001): JWT-based authentication, user management
- **Profile Service** (Port 8002): User profiles, resume parsing, GitHub integration
- **Question Service** (Port 8003): AI-powered question generation
- **Interview Service** (Port 8004): Session management, video/audio handling
- **Evaluation Service** (Port 8005): Multi-agent AI evaluation system
- **API Gateway** (Port 8000): Request routing, rate limiting, CORS

### 1.2 Database Architecture
- **PostgreSQL**: User accounts, profiles, interview sessions (structured data)
- **MongoDB**: Resume documents, GitHub data, AI analysis results (unstructured)
- **Redis**: Session management, caching, rate limiting
- **S3-Compatible Storage**: Video/audio files with presigned URLs

### 1.3 Message Queue
- **RabbitMQ/Celery**: Async tasks for video processing, AI evaluation

## Phase 2: Enhanced Authentication & User Management

### 2.1 Auth Service Features
- JWT with refresh tokens
- OAuth2 integration (GitHub, Google, LinkedIn)
- Email verification
- Password reset flow
- Role-based access control (RBAC)

### 2.2 Enhanced Signup Flow
**Collect During Signup:**
- Full Name, Email, Password
- Target Role(s)
- Years of Experience
- Education Background
- Resume Upload (PDF/DOCX)
- GitHub Profile URL
- LinkedIn Profile URL
- Portfolio URL
- Primary Skills (autocomplete)

## Phase 3: Profile Service with Resume & GitHub Analysis

### 3.1 Resume Parser
- Extract: Education, Work Experience, Projects, Skills, Certifications
- Store in MongoDB for semantic search
- Use OpenAI/Claude for intelligent parsing

### 3.2 GitHub Integration
- Fetch repositories via GitHub API
- Analyze: Languages used, contribution patterns, project complexity
- Extract technical skills from code
- Store repository metadata

### 3.3 Profile Data Model (MongoDB)
```json
{
  "user_id": "uuid",
  "resume": {
    "raw_text": "...",
    "parsed": {
      "education": [],
      "experience": [],
      "projects": [],
      "skills": [],
      "certifications": []
    }
  },
  "github": {
    "username": "...",
    "repos": [],
    "languages": {},
    "activity_score": 0
  },
  "linkedin_data": {},
  "updated_at": "timestamp"
}
```

## Phase 4: Advanced Question Generation Service

### 4.1 Multi-Source Question Generation
**Data Sources:**
1. Resume projects and experience
2. GitHub repository analysis
3. Job description requirements
4. Target role expectations
5. Web research (Tavily/Perplexity)

### 4.2 Question Types
- **Resume-Based**: "I see you worked on [Project X]. Can you explain the architecture?"
- **GitHub-Based**: "Your [Repo Name] uses [Tech]. Why did you choose it over [Alternative]?"
- **JD-Based**: "The role requires [Skill]. How would you approach [Scenario]?"
- **Behavioral**: Company-specific leadership principles

### 4.3 Question Generation Prompt
```
CONTEXT:
- Resume: {parsed_resume}
- GitHub: {top_3_repos_with_tech_stack}
- Job Description: {jd}
- Target Role: {role}
- User Skills: {skills}

TASK: Generate {count} questions:
- 40% based on user's actual projects/experience
- 30% based on job description requirements
- 20% behavioral (company-specific)
- 10% system design/architecture

RULES:
- Reference specific projects from resume
- Ask about technologies in GitHub repos
- No generic questions
- Progressive difficulty
```

## Phase 5: Video/Audio Storage & Processing

### 5.1 S3 Storage Architecture
```
s3://mockmate-interviews/
  ├── {user_id}/
  │   ├── {interview_id}/
  │   │   ├── video.webm
  │   │   ├── audio.mp3 (extracted)
  │   │   ├── frames/
  │   │   │   ├── q1_frame_001.jpg
  │   │   │   ├── q1_frame_002.jpg
  │   │   │   └── ...
  │   │   └── metadata.json
```

### 5.2 Video Processing Pipeline
1. Upload video to S3 with presigned URL
2. Trigger Lambda/Celery task
3. Extract audio track → S3
4. Extract frames (1 per 2 seconds) → S3
5. Store timestamps for each question
6. Update MongoDB with file paths

### 5.3 Timestamp Tracking
```json
{
  "interview_id": "uuid",
  "questions": [
    {
      "question_id": 1,
      "text": "...",
      "start_time": 0.0,
      "end_time": 120.5,
      "video_segment": "s3://path/q1_segment.webm",
      "frames": ["s3://path/q1_frame_001.jpg", ...]
    }
  ]
}
```

## Phase 6: Multi-Agent Evaluation System

### 6.1 Agent Architecture
**Agent 1: Transcription Agent**
- Model: OpenAI Whisper-1
- Input: Audio file per question
- Output: Transcript with timestamps

**Agent 2: Content Evaluator Agent**
- Model: GPT-4o / Claude Sonnet
- Input: Transcript + Question + Resume context
- Output: Technical accuracy score, depth analysis

**Agent 3: Communication Agent**
- Model: GPT-4o
- Input: Transcript
- Output: Clarity, structure, filler word count, pace (WPM)

**Agent 4: Vision Agent (VLM)**
- Model: GPT-4o Vision / Claude Vision
- Input: Frame sequence per question
- Output: Eye contact %, posture analysis, confidence signals

**Agent 5: Synthesis Agent**
- Model: GPT-4o
- Input: All agent outputs
- Output: Final score, detailed feedback, improvement plan

### 6.2 Per-Question Evaluation Flow
```python
for question in interview.questions:
    # Extract segment
    video_segment = extract_segment(video, question.start_time, question.end_time)
    audio_segment = extract_audio(video_segment)
    frames = extract_frames(video_segment, fps=0.5)
    
    # Agent 1: Transcribe
    transcript = transcription_agent.process(audio_segment)
    
    # Agent 2: Content
    content_score = content_agent.evaluate(
        question=question.text,
        transcript=transcript,
        resume=user.resume,
        github=user.github
    )
    
    # Agent 3: Communication
    comm_score = communication_agent.evaluate(transcript)
    
    # Agent 4: Vision
    vision_score = vision_agent.evaluate(frames)
    
    # Store per-question results
    question.evaluation = {
        "transcript": transcript,
        "content": content_score,
        "communication": comm_score,
        "vision": vision_score
    }

# Agent 5: Synthesize
final_report = synthesis_agent.generate(interview.questions)
```

### 6.3 Vision Agent Prompt
```
Analyze these {n} frames from a {duration}s interview response.

FRAMES: [Base64 encoded images]

EVALUATE:
1. Eye Contact: % of frames with direct gaze
2. Posture: Upright/slouched, fidgeting
3. Facial Expressions: Confidence, nervousness
4. Hand Gestures: Natural/excessive/none
5. Background: Professional/distracting

Return JSON with scores and observations.
```

## Phase 7: Database Schema

### 7.1 PostgreSQL Schema
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    full_name VARCHAR,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- Interview Sessions
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    company_name VARCHAR,
    target_role VARCHAR,
    job_description TEXT,
    status VARCHAR, -- 'created', 'in_progress', 'completed', 'evaluated'
    video_s3_path VARCHAR,
    audio_s3_path VARCHAR,
    overall_score FLOAT,
    created_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Questions
CREATE TABLE questions (
    id UUID PRIMARY KEY,
    interview_id UUID REFERENCES interview_sessions(id),
    question_text TEXT,
    question_type VARCHAR, -- 'resume', 'github', 'jd', 'behavioral'
    source_reference TEXT, -- e.g., "Resume: Project X"
    start_timestamp FLOAT,
    end_timestamp FLOAT,
    evaluation_data JSONB
);
```

### 7.2 MongoDB Collections
```javascript
// profiles collection
{
  _id: ObjectId,
  user_id: "uuid",
  resume: { /* parsed data */ },
  github: { /* repo data */ },
  linkedin: { /* profile data */ }
}

// evaluations collection
{
  _id: ObjectId,
  interview_id: "uuid",
  question_evaluations: [
    {
      question_id: "uuid",
      transcript: "...",
      content_analysis: {},
      communication_analysis: {},
      vision_analysis: {},
      frames_analyzed: []
    }
  ],
  final_synthesis: {}
}
```

## Phase 8: Implementation Order

### Week 1: Infrastructure
1. Set up PostgreSQL, MongoDB, Redis
2. Create microservices boilerplate (FastAPI)
3. Set up API Gateway (Kong/Nginx)
4. Configure S3/MinIO for storage

### Week 2: Auth & Profile
1. Implement Auth Service with JWT
2. Build Profile Service with resume parser
3. Integrate GitHub API
4. Create enhanced signup flow

### Week 3: Question Generation
1. Build Question Service
2. Implement multi-source data aggregation
3. Create advanced LLM prompts
4. Add web search integration

### Week 4: Video Processing
1. Implement S3 upload with presigned URLs
2. Build video segmentation pipeline
3. Create frame extraction service
4. Add timestamp tracking

### Week 5-6: Multi-Agent Evaluation
1. Build Transcription Agent
2. Build Content Evaluator Agent
3. Build Communication Agent
4. Build Vision Agent (VLM)
5. Build Synthesis Agent
6. Integrate per-question evaluation

### Week 7: Integration & Testing
1. End-to-end testing
2. Performance optimization
3. Security audit
4. Documentation

## Phase 9: Technology Stack

### Backend
- **Framework**: FastAPI (all microservices)
- **Auth**: python-jose, passlib, bcrypt
- **Database**: SQLAlchemy (PostgreSQL), Motor (MongoDB async)
- **Cache**: redis-py
- **Storage**: boto3 (S3), minio (local dev)
- **Tasks**: Celery + RabbitMQ
- **Video**: moviepy, opencv-python
- **AI**: openai, anthropic, google-generativeai

### Frontend
- **Framework**: React + TypeScript
- **State**: Zustand or Redux Toolkit
- **Upload**: tus-js-client (resumable uploads)
- **Video**: MediaRecorder API with chunked upload

### DevOps
- **Containers**: Docker + Docker Compose
- **Orchestration**: Kubernetes (production)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

## Phase 10: Security Considerations

1. **Authentication**: JWT with short expiry + refresh tokens
2. **Authorization**: RBAC with service-level permissions
3. **Data Encryption**: At rest (S3 encryption) and in transit (TLS)
4. **API Security**: Rate limiting, input validation, CORS
5. **Secrets Management**: AWS Secrets Manager / HashiCorp Vault
6. **Video Privacy**: Presigned URLs with expiry, user-only access

## Next Steps

Would you like me to:
1. Start implementing the microservices architecture?
2. Begin with the enhanced authentication system?
3. Build the resume parser and GitHub integration first?
4. Set up the database schemas and migrations?

This is a 6-8 week project for a production-grade system. We can proceed incrementally.
