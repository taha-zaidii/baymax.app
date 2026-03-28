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

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import validate_keys, APP_TITLE, DEBUG, GROQ_API_KEY, SERPER_API_KEY

# ── In-memory interview session store ────────────────────────────────────────
# Maps session_id -> {job_title, resume_summary, history, question_num}
_interview_sessions: dict = {}

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=APP_TITLE,
    description="Baymax AI — Multi-Agent Career Assistant Backend",
    version="2.0.0",
)

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

        if len(request.resume_text.strip()) < 20:
            raise HTTPException(status_code=400, detail="resume_text is too short")
        if len(request.job_description.strip()) < 10:
            raise HTTPException(status_code=400, detail="job_description is required")

        result = analyze_resume_structured(request.resume_text, request.job_description)

        try:
            save_resume_analysis("default", request.job_description[:80], result)
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
    try:
        from agents.resume_agent import analyze_resume_structured
        from agents.memory_agent import save_resume_analysis

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        resume_text = _extract_pdf(tmp_path)
        os.unlink(tmp_path)

        if len(resume_text.strip()) < 20:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        result = analyze_resume_structured(resume_text, job_description)

        try:
            save_resume_analysis("default", job_description[:80], result)
        except Exception:
            pass

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
    Search for matching jobs using Firecrawl (primary) or Serper (fallback).
    Returns 6 formatted job cards.
    """
    try:
        from agents.job_search_agent import find_jobs
        from agents.memory_agent import save_job_search

        parsed_skills = [s.strip() for s in skills_list.split(",") if s.strip()] if skills_list else []

        jobs = find_jobs(
            job_title=job_title,
            skills_summary=skills_summary,
            skills_list=parsed_skills,
        )

        try:
            save_job_search(user_id, job_title, skills_summary)
        except Exception:
            pass

        return {"jobs": jobs}

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

        result = chat_with_rahul(
            user_message=request.user_message,
            conversation_history=request.conversation_history,
            job_title=request.job_title,
            skills_gap=request.skills_gap,
        )

        if result.get("show_aid"):
            template = get_financial_aid_template(
                course_name=result.get("aid_course") or "[COURSE NAME]",
                job_title=request.job_title or "[JOB TITLE]",
                skill_area=request.skills_gap[:60] if request.skills_gap else "[SKILL AREA]",
            )
            result["aid_template"] = template

        return result
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
