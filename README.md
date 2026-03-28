# 🤖 Baymax AI — JobPrep Career Coach

Pakistan's First AI-powered Interview & Career Coach. Upload your resume, get AI analysis, mock interview questions, live job matches, and a 3/6/12-month career roadmap — all powered by Groq ⚡

## Quick Start

### 1. Backend (FastAPI)

```bash
cd ai-mustaqbil

# Create virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env and add your GROQ_API_KEY and SERPER_API_KEY

# Start the backend
uvicorn api:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**
API docs at: **http://localhost:8000/docs**

### 2. Frontend (React/Vite)

```bash
cd ai-mustaqbil/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## API Keys Needed

| Key | Get it from | Required? |
|-----|-------------|-----------|
| `GROQ_API_KEY` | https://console.groq.com | ✅ Yes |
| `SERPER_API_KEY` | https://serper.dev | Recommended (free 100 searches/month) |

---

## The 4 AI Agents

| Agent | Name | Role |
|-------|------|------|
| 📄 Alex | Resume Analyst | Scores resume, finds skill gaps |
| 🎤 Sam | Interview Coach | Generates mock interview Q&A |
| 🔍 Zara | Job Matcher | Finds live job listings |
| 🗺️ Rahul | Career Planner | Builds 3/6/12-month roadmap |

---

## Project Structure

```
ai-mustaqbil/
├── agents/             # 4 AI agents
├── tools/              # PDF parser + Serper web search
├── rag/                # ChromaDB RAG pipeline (optional)
├── frontend/           # React/Vite UI
├── api.py              # FastAPI backend  ← main entry
├── crew.py             # Pipeline orchestrator
├── config.py           # Config & env vars
├── requirements.txt
└── .env                # Your API keys
```

