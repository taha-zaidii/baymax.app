"""
backend/api.py — FastAPI Backend for Baymax AI

Provides RESTful API endpoints wrapping all 5 multi-agent pipeline stages:
  - Resume Analyzer (Alex)
  - Interview Coach (Sam)
  - Job Scout (Zara)
  - Career Roadmap (Rahul)
  - Memory Layer (Mem0)

Run with:
    uvicorn api:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import uuid
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    _limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
    _rate_limiting_available = True
except ImportError:
    _limiter = None
    _rate_limiting_available = False

from config import validate_keys, APP_TITLE, DEBUG, GROQ_API_KEY, SERPER_API_KEY

# ── Responsible AI: Input Sanitization ────────────────────────────────────────
_MAX_RESUME_CHARS = 20_000   # ~8 pages of text
_MAX_JD_CHARS     = 10_000
_MAX_MSG_CHARS    = 4_000

BANNED_PATTERNS = [
    "ignore all previous instructions",
    "ignore previous instructions",
    "you are now",
    "act as if",
    "jailbreak",
    "dan mode",
]

def _sanitize(text: str, max_chars: int = _MAX_RESUME_CHARS) -> str:
    """Truncate oversized inputs and reject obvious prompt-injection attempts."""
    text = text[:max_chars]  # hard truncate
    lower = text.lower()
    for pat in BANNED_PATTERNS:
        if pat in lower:
            raise HTTPException(
                status_code=400,
                detail="Input contains disallowed content. Please submit a standard resume or job description."
            )
    return text


# ── In-memory interview session store ────────────────────────────────────────
# Maps session_id -> {job_title, resume_summary, history, question_num}
_interview_sessions: dict = {}

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=APP_TITLE,
    description="Baymax AI — Multi-Agent Career Assistant Backend",
    version="2.0.0",
)

# ── Rate Limiting (Responsible AI guardrail) ──────────────────────────────────
if _rate_limiting_available and _limiter:
    app.state.limiter = _limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def rate_limit(limit: str = "10/minute"):
    """Decorator factory — no-ops gracefully if slowapi not installed."""
    def decorator(func):
        if _rate_limiting_available and _limiter:
            return _limiter.limit(limit)(func)
        return func
    return decorator


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── PDF Helper (lazy import) ──────────────────────────────────────────────────
def _extract_pdf(tmp_path: str) -> str:
    from tools.pdf_tool import extract_text_from_pdf
    return extract_text_from_pdf(tmp_path)


def _structure_pdf(tmp_path: str) -> dict:
    """Return the resume parsed into {profile, summary, sections..., raw_text}."""
    from tools.pdf_tool import extract_structured_resume
    return extract_structured_resume(tmp_path)


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    status: str
    api_keys_configured: bool
    debug_mode: bool


@app.get("/health", response_model=HealthResponse)
async def health_check():
    missing_keys = validate_keys()
    return {
        "status": "healthy" if not missing_keys else "degraded",
        "api_keys_configured": len(missing_keys) == 0,
        "debug_mode": DEBUG,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# RESUME — Upload & Extract
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/extract-resume")
async def extract_resume(file: UploadFile = File(...)):
    """Upload a resume PDF and extract its text."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        text = _extract_pdf(tmp_path)
        os.unlink(tmp_path)

        return {
            "success": True,
            "filename": file.filename,
            "extracted_text": text,
            "character_count": len(text),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# RESUME — Structured parse for the Resume Builder import flow
# ─────────────────────────────────────────────────────────────────────────────
# /resume/parse runs the heuristic structurer in tools/pdf_tool.py and returns
# the resume already split into profile / summary / education / experience /
# skills / projects / certifications. The Resume Builder maps this directly
# to its form state, which is far more reliable than re-parsing the flat
# extracted text on the client.

@app.post("/resume/parse")
async def parse_resume(file: UploadFile = File(...)):
    """Upload a resume PDF and get a fully structured JSON payload back."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large. Maximum size is 5 MB.")
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        structured = _structure_pdf(tmp_path)
        os.unlink(tmp_path)

        # Hide raw_text from the parsed payload — it is returned separately so
        # the analyzer endpoint can store it on the session without forcing
        # the Builder to think about it.
        raw_text = structured.pop("raw_text", "")
        return {
            "success": True,
            "filename": file.filename,
            "parsed": structured,
            "extracted_text": raw_text,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parse error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# RESUME — Analyze (JSON body)
# ═══════════════════════════════════════════════════════════════════════════════

class ResumeAnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str


@app.post("/resume/analyze")
async def resume_analyze(request: ResumeAnalyzeRequest):
    """
    Analyze a resume against a job description.
    Returns: overall_score, ats_score, match_score, strengths, weaknesses,
             missing_keywords, section_feedback, improved_bullets
    """
    try:
        from agents.resume_agent import analyze_resume_structured
        from agents.memory_agent import save_resume_analysis

        resume_text = _sanitize(request.resume_text, _MAX_RESUME_CHARS)
        job_desc    = _sanitize(request.job_description, _MAX_JD_CHARS)

        if len(resume_text.strip()) < 20:
            raise HTTPException(status_code=400, detail="resume_text is too short")
        if len(job_desc.strip()) < 10:
            raise HTTPException(status_code=400, detail="job_description is required")

        result = analyze_resume_structured(resume_text, job_desc)

        try:
            save_resume_analysis("default", job_desc[:80], result)
        except Exception:
            pass

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume analysis error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# RESUME — Analyze via PDF Upload
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/resume/analyze/upload")
async def resume_analyze_upload(
    file: UploadFile = File(...),
    job_description: str = Form(...),
):
    """Upload a resume PDF + job description → structured analysis JSON."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    # Responsible AI: validate file size (max 5 MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF too large. Maximum size is 5 MB.")
    try:
        from agents.resume_agent import analyze_resume_structured
        from agents.memory_agent import save_resume_analysis

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        resume_text = _extract_pdf(tmp_path)
        os.unlink(tmp_path)

        resume_text = _sanitize(resume_text, _MAX_RESUME_CHARS)
        job_desc    = _sanitize(job_description, _MAX_JD_CHARS)

        if len(resume_text.strip()) < 20:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        result = analyze_resume_structured(resume_text, job_desc)

        try:
            save_resume_analysis("default", job_desc[:80], result)
        except Exception:
            pass

        # Pass the extracted text back to the frontend so the user session can
        # remember the candidate's resume content even when they uploaded a PDF
        # rather than building one in the Builder. Without this every
        # downstream agent (interview / jobs / roadmap) would have an empty
        # resume context.
        if isinstance(result, dict):
            result.setdefault("extracted_resume_text", resume_text)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF analysis error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# RESUME — Improve a bullet / paragraph
# ═══════════════════════════════════════════════════════════════════════════════

class ResumeImproveRequest(BaseModel):
    text: str
    context: str = ""


@app.post("/resume/improve")
async def resume_improve(request: ResumeImproveRequest):
    """Rewrite a single resume bullet or paragraph."""
    try:
        from agents.resume_agent import improve_text
        if len(request.text.strip()) < 3:
            raise HTTPException(status_code=400, detail="text is required")
        improved = improve_text(request.text, request.context)
        return {"improved": improved}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Improve error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# RESUME — Improve a section (ResumeBuilder)
# ═══════════════════════════════════════════════════════════════════════════════

class SectionImproveRequest(BaseModel):
    section_name: str
    content: str
    job_title: str


@app.post("/resume/improve-section")
async def resume_improve_section(request: SectionImproveRequest):
    """Take an existing resume section and return AI-enhanced content."""
    try:
        from agents.resume_agent import improve_resume_section
        if len(request.content.strip()) < 5:
            raise HTTPException(status_code=400, detail="Content is too short")
        improved = improve_resume_section(request.section_name, request.content, request.job_title)
        return {"improved_content": improved}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Section improve error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# RESUME — Generate a new section (ResumeBuilder)
# ═══════════════════════════════════════════════════════════════════════════════

class SectionGenerateRequest(BaseModel):
    section_name: str
    context: str
    job_title: str


@app.post("/resume/generate-section")
async def resume_generate_section(request: SectionGenerateRequest):
    """Generate a complete resume section from minimal context."""
    try:
        from agents.resume_agent import generate_resume_section
        generated = generate_resume_section(
            section_name=request.section_name,
            context=request.context or f"Targeting {request.job_title} role",
            job_title=request.job_title,
        )
        return {"generated_content": generated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Section generation error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# RESUME — Legacy analyze-structured (PDF + job_title form)
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/resume/analyze-structured")
async def resume_analyze_structured_legacy(
    file: UploadFile = File(...),
    job_title: str = Form(...),
):
    """Legacy: Upload PDF + job_title → AnalysisResponse JSON."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    try:
        from agents.resume_agent import analyze_resume_structured

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        resume_text = _extract_pdf(tmp_path)
        os.unlink(tmp_path)

        if len(resume_text.strip()) < 20:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        return analyze_resume_structured(resume_text, f"Target role: {job_title}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Structured analysis error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# RESUME — Save / Retrieve full profile (Mem0)
# ═══════════════════════════════════════════════════════════════════════════════

class SaveProfileRequest(BaseModel):
    user_id: str
    resume_text: str
    analysis_result: dict
    job_title: str


@app.post("/resume/save-profile")
async def save_user_profile(request: SaveProfileRequest):
    """Persist the user's full resume + analysis to Mem0."""
    try:
        from agents.memory_agent import save_full_profile
        ok = save_full_profile(
            user_id=request.user_id,
            resume_text=request.resume_text,
            analysis=request.analysis_result,
            job_title=request.job_title,
        )
        if not ok:
            raise HTTPException(status_code=500, detail="Failed to save profile to memory")
        return {"success": True, "user_id": request.user_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Save profile error: {str(e)}")


@app.get("/resume/profile/{user_id}")
async def get_user_profile(user_id: str):
    """Retrieve a user's saved full profile from Mem0."""
    try:
        from agents.memory_agent import get_full_profile
        profile = get_full_profile(user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        return profile
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Get profile error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# INTERVIEW — Multi-Turn Session (Sam)
# ═══════════════════════════════════════════════════════════════════════════════

class InterviewStartRequest(BaseModel):
    job_title: str
    resume_summary: str = ""


class InterviewReplyRequest(BaseModel):
    session_id: str
    answer: str
    question_num: int


@app.post("/interview/start")
async def interview_start(request: InterviewStartRequest):
    """Begin a new multi-turn interview session. Returns session_id + first question."""
    try:
        from agents.interview_agent import start_interview

        if len(request.job_title.strip()) < 2:
            raise HTTPException(status_code=400, detail="Job title is required")

        result = start_interview(request.job_title, request.resume_summary)
        question = result.get("question", result.get("follow_up_or_next", "Tell me about yourself."))

        session_id = str(uuid.uuid4())
        _interview_sessions[session_id] = {
            "job_title": request.job_title,
            "resume_summary": request.resume_summary,
            "history": [{"role": "assistant", "content": question}],
            "question_num": 1,
        }

        return {"session_id": session_id, "question": question}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interview start error: {str(e)}")


@app.post("/interview/reply")
async def interview_reply(request: InterviewReplyRequest):
    """Submit an answer. Returns feedback, score, next question, and done flag."""
    try:
        from agents.interview_agent import evaluate_answer

        session = _interview_sessions.get(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found. Start a new interview.")

        if len(request.answer.strip()) < 2:
            raise HTTPException(status_code=400, detail="Answer cannot be empty")

        session["history"].append({"role": "user", "content": request.answer})

        result = evaluate_answer(
            job_title=session["job_title"],
            conversation_history=session["history"],
            latest_answer=request.answer,
            question_num=request.question_num,
            total_questions=8,
            resume_summary=session.get("resume_summary", ""),
        )

        feedback = result.get("feedback", "Good answer!")
        score = result.get("score", 7)
        next_question = result.get("follow_up_or_next", "")
        is_done = (request.question_num >= 8) or not next_question.strip()

        session["history"].append({
            "role": "assistant",
            "content": f"Feedback: {feedback}\n\nNext: {next_question}",
        })
        session["question_num"] = request.question_num + 1

        if is_done:
            _interview_sessions.pop(request.session_id, None)

        return {
            "feedback": feedback,
            "score": score,
            "next_question": next_question,
            "is_done": is_done,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interview reply error: {str(e)}")


@app.post("/interview/transcribe")
async def transcribe_audio_endpoint(file: UploadFile = File(...)):
    """Transcribe voice audio using Groq Whisper. Returns { text: '...' }."""
    try:
        from agents.interview_agent import transcribe_audio
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty audio file")
        text = transcribe_audio(contents)
        return {"text": text.strip()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")


@app.post("/interview/save-result")
async def save_interview_result_endpoint(request: dict):
    """Persist interview performance to Mem0."""
    try:
        from agents.memory_agent import save_interview_result
        ok = save_interview_result(
            user_id=request.get("user_id", "default"),
            avg_score=float(request.get("avg_score", 0)),
            weak_areas=str(request.get("weak_areas", "")),
        )
        return {"success": ok}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Save interview error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# JOB SEARCH — Zara
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/jobs")
async def search_jobs(
    job_title: str = Form(...),
    skills_summary: str = Form(""),
    skills_list: str = Form(""),
    user_id: str = Form("default"),
):
    """
    Search for matching jobs.

    Returns a structured payload:
        {
          "jobs":            [JobItem, ...],
          "top_skill_gap":   str,
          "application_tip": str,
          "query_meta":      {...}
        }
    """
    try:
        from agents.job_search_agent import find_jobs
        from agents.memory_agent import save_job_search

        parsed_skills = [s.strip() for s in skills_list.split(",") if s.strip()] if skills_list else []

        result = find_jobs(
            job_title=job_title,
            skills_summary=skills_summary,
            skills_list=parsed_skills,
        )

        try:
            save_job_search(user_id, job_title, skills_summary)
        except Exception:
            pass

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job search error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# CAREER ROADMAP — Rahul
# ═══════════════════════════════════════════════════════════════════════════════

@app.post("/roadmap")
async def generate_roadmap(
    job_title: str = Form(...),
    skills_gap: str = Form(""),
    current_skills: str = Form(""),
    interview_weak_areas: str = Form(""),
    resume_analysis_raw: str = Form(""),
):
    """Generate a personalised 90-day career roadmap with free learning resources."""
    try:
        from agents.career_planner_agent import build_roadmap

        roadmap = build_roadmap(
            job_title=job_title,
            skills_gap=skills_gap,
            resume_analysis_raw=resume_analysis_raw,
            job_market_context="",
            current_skills=current_skills,
            interview_weak_areas=interview_weak_areas,
        )
        return {"roadmap": roadmap}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roadmap generation error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# ROADMAP — Certifications
# ═══════════════════════════════════════════════════════════════════════════════

class CertRequest(BaseModel):
    job_title: str
    skills_gap: List[str]
    current_skills: List[str] = []


@app.post("/roadmap/certifications")
async def get_certifications(request: CertRequest):
    """Recommend 4-5 relevant certifications based on the user's skill gaps."""
    try:
        from agents.career_planner_agent import recommend_certifications

        if len(request.job_title.strip()) < 2:
            raise HTTPException(status_code=400, detail="job_title is required")

        certs = recommend_certifications(
            job_title=request.job_title,
            skills_gap=request.skills_gap,
            current_skills=request.current_skills,
        )
        return {"certifications": certs}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Certifications error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# ROADMAP — CSP Solver (course-required AI algorithm)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Wraps the deterministic CSP planner in agents/csp_planner.py.
# The endpoint takes a list of skill gaps plus weekly-hour budget and returns
# the final assignment together with a full step-by-step trace that the
# frontend animates. This is the algorithm that satisfies the CS 2005
# "AI technique + visualization" requirement.

class CSPRoadmapRequest(BaseModel):
    skills_gap: List[str]
    total_weeks: int = 12
    weekly_hour_budget: int = 15


@app.post("/roadmap/csp")
async def roadmap_csp(request: CSPRoadmapRequest):
    """
    Solve the career roadmap as a Constraint Satisfaction Problem.

    Returns
    -------
    success            bool   -- did the solver find a complete assignment?
    reason             str    -- ok | unary_dead_end | ac3_dead_end | bt_failed
    assignment         dict   -- {task_id: week_number}
    tasks              list   -- variable definitions (id, label, hours, ...)
    constraints        dict   -- prerequisites, exclusives, weekly budget
    trace              list   -- ordered events for the visualizer
    stats              dict   -- counters (arc checks, prunings, backtracks)
    """
    try:
        from agents.csp_planner import solve_roadmap_csp

        # Validate the small, well-defined parameter space.
        if not request.skills_gap:
            raise HTTPException(
                status_code=400,
                detail="skills_gap must contain at least one skill",
            )
        if not (4 <= request.total_weeks <= 26):
            raise HTTPException(
                status_code=400,
                detail="total_weeks must be between 4 and 26",
            )
        if not (4 <= request.weekly_hour_budget <= 60):
            raise HTTPException(
                status_code=400,
                detail="weekly_hour_budget must be between 4 and 60",
            )

        # Light-weight sanitisation of free-text gap labels.
        clean_gaps = [
            _sanitize(g, _MAX_MSG_CHARS).strip()
            for g in request.skills_gap
            if g and g.strip()
        ]

        return solve_roadmap_csp(
            clean_gaps,
            total_weeks=request.total_weeks,
            weekly_hour_budget=request.weekly_hour_budget,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSP solver error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════════
# ROADMAP — Chat with Rahul
# ═══════════════════════════════════════════════════════════════════════════════

class RoadmapChatRequest(BaseModel):
    user_message: str
    conversation_history: list = []
    job_title: str = ""
    skills_gap: str = ""


@app.post("/roadmap/chat")
async def roadmap_chat(request: RoadmapChatRequest):
    """Interactive follow-up Q&A with Rahul (career mentor)."""
    try:
        from agents.career_planner_agent import chat_with_rahul, get_financial_aid_template

        safe_msg = _sanitize(request.user_message, _MAX_MSG_CHARS)

        result = chat_with_rahul(
            user_message=safe_msg,
            conversation_history=request.conversation_history[-20:],  # cap history
            job_title=request.job_title[:100],
            skills_gap=request.skills_gap[:500],
        )

        if result.get("show_aid"):
            template = get_financial_aid_template(
                course_name=result.get("aid_course") or "[COURSE NAME]",
                job_title=request.job_title or "[JOB TITLE]",
                skill_area=request.skills_gap[:60] if request.skills_gap else "[SKILL AREA]",
            )
            result["aid_template"] = template

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roadmap chat error: {str(e)}")



# ═══════════════════════════════════════════════════════════════════════════════
# SPA — Serve built frontend
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
async def serve_index():
    """Serve the React SPA."""
    frontend_dist = Path(__file__).parent.parent / "frontend/dist/index.html"
    if frontend_dist.exists():
        return FileResponse(frontend_dist)
    return {"message": "Frontend not built. Run: cd frontend && npm run build"}


frontend_dist = Path(__file__).parent.parent / "frontend/dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets", html=False), name="assets")


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")

    print(f"""
    ╔════════════════════════════════════════════════════════╗
    ║           Baymax AI Backend  v2.0                      ║
    ║  🚀 Starting on  {host}:{port}                    ║
    ║  📖 Docs at      http://localhost:{port}/docs      ║
    ║  🎯 Agents:  Alex · Sam · Zara · Rahul · Mem0          ║
    ╚════════════════════════════════════════════════════════╝
    """)

    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=DEBUG,
        log_level="info",
    )
