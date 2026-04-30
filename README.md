# Baymax — AI Career Coaching System

<div align="center">

**Multi-agent AI career coach with a Constraint-Satisfaction-Problem roadmap planner.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-baymax--app--six.vercel.app-red?style=for-the-badge)](https://baymax-app-six.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-DigitalOcean-blue?style=for-the-badge)](https://baymax-app-ozhwo.ondigitalocean.app/health)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

> **CS 2005 Final Submission · FAST NUCES Karachi · Spring 2026.**
> The graded artefact is the CSP solver and its animated visualization.
> Read **[`PROJECT_REPORT.md`](PROJECT_REPORT.md)** for the full writeup
> with code excerpts, screenshots and test cases.

---

## CS 2005 — Quick Reference for Grading

| Course requirement | Where it lives in this repo |
|-------------------|----------------------------|
| **AI technique** — CSP (AC-3 + Backtracking with MRV / LCV / Forward-Checking) | [`backend/agents/csp_planner.py`](backend/agents/csp_planner.py) |
| **Algorithm pipeline** — unary → AC-3 → backtracking | `RoadmapCSP.solve()` in the same file |
| **Visualization (compulsory)** — variables · domains · constraints · backtracking · assignments | [`frontend/src/components/CSPVisualizer.tsx`](frontend/src/components/CSPVisualizer.tsx) |
| **UI (mandatory)** — React + Tailwind, deployed | `frontend/` — open *Roadmap → 🧠 CSP Algorithm* |
| **Working system** | `POST /roadmap/csp` in [`backend/api.py`](backend/api.py) |
| **Clean, commented code** | `csp_planner.py` (520 lines, fully docstring'd) and `CSPVisualizer.tsx` (top-of-file design note + inline comments) |

**To grade in 30 seconds:** open the live app → click **Career Roadmap** in the sidebar → make sure **🧠 CSP Algorithm** is selected → press **Run CSP Solver** → press **▶** on the controls and watch the algorithm step through.

---

## How to Run Locally

### Prerequisites

* **Python 3.10+** (3.11 / 3.12 tested)
* **Node.js 18+** and **npm 9+**
* A **Groq API key** from <https://console.groq.com/keys> — required for the LLM agents
* *(optional)* a **Serper API key** from <https://serper.dev> — only the Job Scout uses it

Copy `.env.example` to `.env` at the repo root and fill in `GROQ_API_KEY` (and `SERPER_API_KEY` if you have one).

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate            # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```

The API is now live at <http://localhost:8000>. Open <http://localhost:8000/docs> for the auto-generated Swagger UI.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev                          # Vite dev server on http://localhost:5173
```

Vite proxies all backend routes to `localhost:8000`, so you do **not** need to set `VITE_API_URL` for local development.

### Production build

```bash
# Backend (Docker, optional)
docker build -t baymax-backend backend/
docker run --rm -p 8000:8000 --env-file .env baymax-backend

# Frontend
cd frontend && npm run build         # static bundle in frontend/dist/
```

The repo also ships `render.yaml` and `start.sh` for one-click DigitalOcean / Render deployments.

### Verifying the build

Quick end-to-end smoke test from the project root:

```bash
# Backend smoke test
cd backend && source venv/bin/activate && python -c "
from fastapi.testclient import TestClient
from api import app
c = TestClient(app)
print('health:', c.get('/health').json()['status'])
r = c.post('/roadmap/csp', json={
    'skills_gap': ['python','docker','react','system design','machine learning','interview'],
    'total_weeks': 12, 'weekly_hour_budget': 15})
d = r.json()
print('csp.success =', d['success'], '| stats =', d['stats'])
"

# Frontend production build + typecheck
cd ../frontend && npm run build && npx tsc --noEmit -p tsconfig.app.json
```

Expected:

```
health: healthy
csp.success = True | stats = {'ac3_arc_checks': 29, 'ac3_values_pruned': 5, 'bt_assignments': 8, 'bt_backtracks': 0}
✓ built in ~3s     # vite
                   # (no tsc output = no errors)
```

---

## Repository Map

```
baymax.app/
├── PROJECT_REPORT.md              ← final report (proposal-style)
├── README.md                      ← this file
├── docs/screenshots/              ← capture instructions inside README.md
├── backend/
│   ├── api.py                     FastAPI routes
│   ├── config.py
│   ├── agents/
│   │   ├── csp_planner.py         ★ AI-Lab algorithm: CSP / AC-3 / Backtracking
│   │   ├── resume_agent.py        Alex — analyzer + builder helpers
│   │   ├── interview_agent.py     Sam — feature extraction + adaptive interview
│   │   ├── job_search_agent.py    Zara — Serper + spam filter + Jaccard scoring
│   │   ├── career_planner_agent.py  Rahul — LLM Plan Summary + curated resources
│   │   └── memory_agent.py        Mem0 (graceful degradation)
│   ├── tools/
│   │   ├── pdf_tool.py            Plain-text + structural PDF parser
│   │   └── search_tool.py         Serper API wrapper
│   ├── Dockerfile · Procfile · requirements.txt · runtime.txt
└── frontend/
    └── src/
        ├── pages/Index.tsx
        ├── components/
        │   ├── Dashboard.tsx           5-tab pipeline shell
        │   ├── ResumeBuilder.tsx       PDF→form parser + live preview
        │   ├── ResumeAnalyzer.tsx      ATS score + bullet rewriter
        │   ├── InterviewCoach.tsx      Voice interview (TTS + Whisper)
        │   ├── JobScout.tsx            Ranked job cards
        │   ├── RoadmapPlanner.tsx      🧠 CSP / 📋 Summary / 📚 Resources
        │   ├── CSPVisualizer.tsx       ★ AI-Lab visualization
        │   └── BaymaxMascot.tsx
        ├── hooks/use-user-session.ts
        └── lib/api.ts
```

The `★`-marked files are the canonical entry points for AI-Lab grading.

---

## REST API

`POST /roadmap/csp` is the algorithmic centrepiece. Full table in
[`PROJECT_REPORT.md`](PROJECT_REPORT.md#appendix-b--rest-api-reference).

```bash
curl -X POST http://localhost:8000/roadmap/csp \
  -H 'Content-Type: application/json' \
  -d '{
    "skills_gap": ["python","docker","react","system design","machine learning","interview"],
    "total_weeks": 12,
    "weekly_hour_budget": 15
  }' | jq '.success, .stats, .assignment'
```

Returns `{success, reason, assignment, tasks, constraints, trace, stats}` with
`trace` containing every solver step the visualization animates.

---

## Group Members

Taha Zaidi · Amna Khan · Kissa Zehra · Aiza Gazyani

## License

MIT — see [`LICENSE`](LICENSE).
