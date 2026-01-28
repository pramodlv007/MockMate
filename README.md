# 🤖 MockMate - AI-Powered Interview Coach

MockMate is an advanced, full-stack interview simulation platform designed to help candidates prepare for high-stakes technical interviews. Unlike generic question generators, MockMate uses **autonomous AI agents** to research, conduct, and evaluate interviews with human-like perception.

![MockMate Dashboard](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop)

## 🚀 Key Features

- **Real-Time Web Research**: The AI scrapes the web for the **latest interview questions** from specific companies (e.g., "Google 2025 L4 questions"), ensuring you practice with relevant material.
- **Multimodal Analysis**: Evaluation isn't just about what you say. MockMate analyzes:
  - **Visuals**: Body language, eye contact, and posture via **Computer Vision**.
  - **Audio**: Speech pace (WPM), tone, and filler word usage (`um`, `like`) via **Speech Processing**.
  - **Content**: Technical accuracy and behavioral quality (STAR method).
- **Adaptive Personas**: Choose your interviewer's personality:
  - 🟢 **Friendly**: Encouraging and warm.
  - 🔵 **Professional**: Balanced and objective.
  - 🔴 **Rigorous**: Intense, "Bar Raiser" style questioning.
- **Strictness Levels**: From "Learning" mode to "Elite (Top 1%)" benchmarking.

---

## 🧠 AI Architecture: Who Does What?

MockMate employs a **multi-provider AI orchestration layer** to deliver robust performance without locking into a single vendor. Here is the breakdown of responsibilities:

### 1. The Researcher (Question Generation)
*Responsible for finding and selecting realistic interview questions.*
- **Primary Tool**: **Tavily AI** (Search API).
- **Task**: Scrapes Glassdoor, LeetCode, and Blind for recent interview experiences at the target company.
- **Fallback**: If web search fails, it utilizes a local **Knowledge Base** of curated FAANG questions.
- **Synthesizer**: **OpenAI GPT-4o** (Fallback: **Google Gemini 1.5 Flash**) processes the raw search data to formulate structured, role-specific questions.

### 2. The Observer (Vision Analysis)
*Responsible for analyzing non-verbal cues.*
- **Model**: **OpenAI GPT-4o Vision**.
- **Process**: The backend extracts key frames from your video feed and analyzes them for:
  - Eye contact consistency.
  - Posture and confidence.
  - Nervous habits (touching face, shifting).

### 3. The Scribe (Audio Transcription)
*Responsible for converting speech to text.*
- **Model**: **OpenAI Whisper-1**.
- **Process**: Converts raw video audio into high-fidelity transcripts, distinguishing between candidate speech and background noise.

### 4. The Evaluator (Comprehensive Feedback)
*Responsible for the final report card.*
- **Model**: **OpenAI GPT-4o** (Fallback: **Gemini 1.5 Flash**).
- **Process**: Acts as the "Hiring Manager." It ingests:
  - The Question Context (Strictness/Persona).
  - The Transcript (Content).
  - The Speech Metrics (WPM, Filler Words).
  - The Vision Analysis (Body Language).
- **Output**: Generates a score (0-100), detailed feedback, and a 7-day personalized training plan.

---

## 🛠️ Tech Stack

### Frontend
- **React + Vite**: Fast, modern UI framework.
- **TailwindCSS**: For a premium, glassmorphic design.
- **Lucide React**: Beautiful iconography.
- **Axios**: API communication.

### Backend
- **FastAPI (Python)**: High-performance async API.
- **SQLAlchemy + SQLite**: Robust data persistence.
- **MoviePy + Pillow**: Video processing and frame extraction.
- **Google Generative AI SDK**: Gemini integration.
- **OpenAI SDK**: GPT-4o and Whisper integration.

---

## ⚡ Quick Start

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- API Keys: OpenAI, Google Gemini (Optional), Tavily (Optional).

### installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/pramodlv007/MockMate.git
   cd MockMate
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Setup .env
   # Add OPENAI_API_KEY, GOOGLE_API_KEY, etc.
   
   # Run Server
   python -c "import uvicorn; from app.main import app; uvicorn.run(app, host='127.0.0.1', port=8001)"
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the App**
   Open `http://localhost:5173` in your browser.

---

## 🛡️ License

This project is open-source and available under the MIT License.
