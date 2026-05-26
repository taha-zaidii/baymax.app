# Baymax — Multi-Agent AI Career Coaching Platform

> Pakistan's first multi-agent AI career platform. Five specialized agents share a live `CareerContext` through a hierarchical orchestrator. Powered by LLaMA 3.3 70B on Groq, with a CSP-based 90-day roadmap planner solving AC-3 + backtracking under the hood.

[![Live Demo](https://img.shields.io/badge/Live-baymax--app--six.vercel.app-000000?style=flat-square&logo=vercel&logoColor=white)](https://baymax-app-six.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-DigitalOcean-0080FF?style=flat-square&logo=digitalocean&logoColor=white)](https://www.digitalocean.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)

---

## What Baymax does

Baymax is a hierarchical multi-agent system that walks a user end-to-end through career preparation. Instead of dumping advice from a single LLM call, five specialized agents collaborate over a shared context:

| Agent | Role | Core Technique |
|---|---|---|
| **Resume Analyzer** | Parses uploaded resumes, extracts skills/experience/education, scores ATS-readiness | RAG over ChromaDB + HuggingFace embeddings |
| **Voice Interview Coach** | Real-time STT → LLM-graded mock interviews with follow-up questioning | Groq Whisper STT + LLaMA 3.3 70B |
| **Job Scout** | Live job aggregation matched against resume + preferences | Serper API across LinkedIn, Indeed, Rozee.pk, Mustakbil |
| **Roadmap Planner** | Generates a personalized 90-day learning plan that respects time, prerequisite, and difficulty constraints | **CSP — AC-3 arc consistency + backtracking with MRV / LCV / forward-checking** |
| **Memory** | Maintains persistent `CareerContext` across sessions so agents see prior conversations | Stateful session store |

A `SafetyGuard` wrapper sits in front of every LLM call for prompt-injection detection and PII handling.

---

## The CSP planner — what makes this not just another GPT wrapper

The roadmap planner (`backend/agents/csp_planner.py`) is a classical AI technique implementation, not an LLM hack:

1. **Variables** — each of N days in the 90-day window
2. **Domains** — pruned by unary constraints (time budget, current skill level, prerequisite chains)
3. **AC-3** — enforces arc consistency between dependent skill nodes (you can't schedule "Advanced Pandas" before "Python Basics")
4. **Backtracking search** — with three classical heuristics layered on top:
   - **MRV** (Minimum Remaining Values) for variable selection
   - **LCV** (Least Constraining Value) for value ordering
   - **Forward-checking** for early failure detection
5. **Interactive React visualization** — frontend animates the algorithm in real time so users can see the planner reason

Worked walkthrough in [PROJECT_REPORT.md](PROJECT_REPORT.md).

---

## Architecture

```
                          ┌─────────────────────────────┐
                          │   Orchestrator (custom)     │
                          │   ↕ shared CareerContext    │
                          └──────────────┬──────────────┘
                                         │
        ┌────────────────┬───────────────┼───────────────┬─────────────────┐
        ↓                ↓               ↓               ↓                 ↓
   Resume Agent     Interview      Job Scout        Roadmap            Memory
   (RAG / ATS)      Coach (Voice)  (Serper API)     Planner (CSP)      (Session)
        │                │               │               │                 │
        └────────────────┴──────────┬────┴───────────────┴─────────────────┘
                                    ↓
                          SafetyGuard (prompt-injection + PII)
                                    ↓
                       LLaMA 3.3 70B  on  Groq
```

---

## Stack

| Layer | Tech |
|---|---|
| **LLM** | LLaMA 3.3 70B via Groq · Whisper STT via Groq |
| **Agent orchestration** | CrewAI · LangChain · LangGraph · custom hierarchical orchestrator |
| **RAG** | ChromaDB · HuggingFace sentence-transformers |
| **Backend** | FastAPI · Uvicorn · Python 3.10+ |
| **Frontend** | Next.js 14 · React · TypeScript · Tailwind CSS · Vite |
| **Job aggregation** | Serper API (LinkedIn / Indeed / Rozee.pk / Mustakbil) |
| **Deploy** | FastAPI on DigitalOcean · Frontend on Vercel |

---

## Quick Start

**Try it live:** https://baymax-app-six.vercel.app

**Run locally:**

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # add GROQ_API_KEY, SERPER_API_KEY (optional)
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                # http://localhost:5173 — proxies /api → backend
```

**Prerequisites:**
- Python 3.10+
- Node.js 18+
- Groq API key — https://console.groq.com/keys
- Serper API key (optional, for live job search) — https://serper.dev

---

## Repository Structure

```
baymax.app/
├── backend/
│   ├── agents/
│   │   ├── csp_planner.py       ← AC-3 + backtracking roadmap solver
│   │   ├── resume_analyzer.py   ← RAG + ATS scoring
│   │   ├── interview_coach.py   ← voice agent + grading
│   │   ├── job_scout.py         ← Serper aggregation
│   │   ├── memory.py            ← session-scoped CareerContext
│   │   └── safety_guard.py      ← prompt-injection + PII layer
│   ├── orchestrator.py          ← hierarchical agent router
│   ├── main.py                  ← FastAPI entry
│   └── requirements.txt
├── frontend/
│   ├── src/components/
│   │   ├── CSPVisualizer.tsx    ← live algorithm animation
│   │   ├── ResumeUpload.tsx
│   │   ├── InterviewRoom.tsx
│   │   └── JobBoard.tsx
│   └── package.json
├── docs/                        ← screenshots, architecture diagrams
├── PROJECT_REPORT.md            ← full technical writeup
├── render.yaml                  ← deployment manifest
└── LICENSE
```

---

## Project Context

Final submission for **CS 2005 — Artificial Intelligence**, FAST NUCES Karachi (Spring 2026).

**Team:** Syed Taha Zaidi · Amna Khan · Kissa Zehra · Aiza Gazyani

The system is hosted as a publicly-available product beyond the original course scope.

---

## License

MIT — see [LICENSE](LICENSE).
