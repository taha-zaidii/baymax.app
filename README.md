# 🤖 Baymax.app — AI Career Assistant

> **Multi-Agent Career Platform** built for the AI Hackathon.
> Five specialised AI agents working sequentially to take a candidate from resume to job offer.

---

## 🧠 Agents

| Agent | Name | Role |
|-------|------|------|
| 1 | **Cass** | Resume Builder — build or upload a resume |
| 2 | **Honey** | Resume Analyzer — ATS score, keyword gaps, improved bullets |
| 3 | **Hiro** | Interview Coach — personalized multi-turn voice interview |
| 4 | **Fred** | Job Scout — live jobs from Rozee.pk, LinkedIn, Mustakbil |
| 5 | **Abigail** | Career Roadmap — 90-day plan with free resources & Rahul chat |

---

## 🏗️ Project Structure

```
baymax.app/
├── backend/                  ← FastAPI backend (Python)
│   ├── api.py                ← All REST endpoints
│   ├── config.py             ← API keys + model config
│   ├── requirements.txt
│   ├── agents/
│   │   ├── resume_agent.py       (Alex — Groq LLaMA 3.3-70b)
│   │   ├── interview_agent.py    (Sam — Groq LLaMA 3.3-70b + Whisper)
│   │   ├── job_search_agent.py   (Zara — Firecrawl + Serper)
│   │   ├── career_planner_agent.py (Rahul — Groq LLaMA 3.3-70b)
│   │   └── memory_agent.py       (Mem0 cloud memory)
│   └── tools/
│       ├── pdf_tool.py       ← PDF text extraction (pypdf)
│       └── search_tool.py    ← Serper API web search fallback
│
├── frontend/                 ← React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/       ← All agent UI panels
│   │   ├── hooks/            ← useUserSession, useApi
│   │   └── lib/api.ts        ← Typed API client
│   └── vite.config.ts        ← Proxy → backend:8000
│
├── start.sh                  ← One-command local start
├── render.yaml               ← Render.com deployment
└── .env                      ← API keys (never commit)
```

---

## ⚡ Quick Start

### 1. Set up environment variables

```bash
cp .env.example .env
# Fill in your API keys
```

| Key | Where to get |
|-----|-------------|
| `GROQ_API_KEY` | https://console.groq.com |
| `SERPER_API_KEY` | https://serper.dev (100 free/month) |
| `FIRECRAWL_API_KEY` | https://firecrawl.dev |
| `MEM0_API_KEY` | https://app.mem0.ai |

### 2. Start everything

```bash
bash start.sh
```

This will:
- Auto-create `backend/venv` and install all Python packages
- Start the FastAPI backend on **http://localhost:8000**
- Start the React frontend on **http://localhost:8080**

### 3. Or start manually

**Backend:**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Backend health check |
| `POST` | `/resume/analyze` | Analyze resume vs job description (JSON) |
| `POST` | `/resume/analyze/upload` | Same, but PDF upload |
| `POST` | `/resume/improve` | Rewrite a single bullet |
| `POST` | `/resume/improve-section` | Improve a resume section |
| `POST` | `/resume/generate-section` | Generate a new section |
| `POST` | `/resume/save-profile` | Persist profile to Mem0 |
| `GET` | `/resume/profile/{user_id}` | Retrieve saved profile |
| `POST` | `/interview/start` | Begin interview session |
| `POST` | `/interview/reply` | Submit answer, get feedback |
| `POST` | `/interview/transcribe` | Voice → text (Groq Whisper) |
| `POST` | `/interview/save-result` | Persist interview score |
| `POST` | `/jobs` | Search jobs (Firecrawl + Serper) |
| `POST` | `/roadmap` | Generate 90-day career roadmap |
| `POST` | `/roadmap/certifications` | Recommend certifications |
| `POST` | `/roadmap/chat` | Chat with Rahul (career mentor) |

Swagger docs: **http://localhost:8000/docs**

---

## 🛠️ Tech Stack

**Backend:** Python 3.11+, FastAPI, Groq (LLaMA 3.3-70b + Whisper), Firecrawl, Serper, Mem0

**Frontend:** React 18, TypeScript, Vite, TailwindCSS, shadcn/ui

---

## 📝 License

MIT
