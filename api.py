"""
api.py — FastAPI Backend for Baymax AI

Provides RESTful API endpoints that wrap the multi-agent crew pipeline.
Serves the frontend and handles file uploads, text extraction, and worker orchestration.
"""
import os
import uuid
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from typing import List, Optional

from config import validate_keys, APP_TITLE, DEBUG, GROQ_API_KEY, SERPER_API_KEY
from crew import run_pipeline
from tools.pdf_tool import extract_text_from_pdf

# ── In-memory interview session store ────────────────────────────────────────
# Maps session_id -> {job_title, resume_summary, history, question_num}
# Note: resets on server restart — fine for a hackathon/demo
_interview_sessions: dict = {}

# ── FastAPI App Setup ─────────────────────────────────────────────────────────
app = FastAPI(
    title=APP_TITLE,
    description="Baymax AI — Multi-Agent Career Assistant Backend",
    version="1.0.0",
)

# ── CORS Configuration ────────────────────────────────────────────────────────
# Allow frontend to make requests during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://127.0.0.1:8080", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request/Response Models ───────────────────────────────────────────────────
class PipelineRequest(BaseModel):
    """Request body for the full pipeline."""
    resume_text: str
    job_title: str
    candidate_answers: str = ""


class PipelineResponse(BaseModel):
    """Response from the full pipeline."""
    resume_analysis: str
    interview_report: str
    job_matches: str
    career_roadmap: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    api_keys_configured: bool
    debug_mode: bool


# ── Health Check Endpoint ─────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Check API health and configuration status.
    """
    missing_keys = validate_keys()
    return {
        "status": "healthy" if not missing_keys else "degraded",
        "api_keys_configured": len(missing_keys) == 0,
        "debug_mode": DEBUG,
    }


# ── File Upload & Extract Text ────────────────────────────────────────────────
@app.post("/extract-resume")
async def extract_resume(file: UploadFile = File(...)):
    """
    Upload a resume PDF and extract text.
    
    Args:
        file: PDF file uploaded by the client
        
    Returns:
        Dictionary with extracted text and file metadata
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name
        
        # Extract text from PDF
        text = extract_text_from_pdf(tmp_path)
        
        # Cleanup
        os.unlink(tmp_path)
        
        return {
            "success": True,
            "filename": file.filename,
            "extracted_text": text,
            "character_count": len(text),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


# ── Main Pipeline Endpoint ────────────────────────────────────────────────────
@app.post("/analyze", response_model=PipelineResponse)
async def analyze(request: PipelineRequest):
    """
    Run the full Baymax AI multi-agent pipeline.
    
    Args:
        request: PipelineRequest containing resume_text, job_title, and optional candidate_answers
        
    Returns:
        PipelineResponse with analysis results from all 4 agents
    """
    try:
        # Validate input
        if not request.resume_text or len(request.resume_text.strip()) < 10:
            raise HTTPException(status_code=400, detail="Resume text is too short or empty")
        
        if not request.job_title or len(request.job_title.strip()) < 2:
            raise HTTPException(status_code=400, detail="Job title is required")
        
        # Run pipeline
        print(f"🚀 Starting pipeline for: {request.job_title}")
        result = run_pipeline(
            resume_text=request.resume_text,
            job_title=request.job_title,
            candidate_answers=request.candidate_answers,
        )
        
        return {
            "resume_analysis": result["resume_analysis"],
            "interview_report": result["interview_report"],
            "job_matches": result["job_matches"],
            "career_roadmap": result["career_roadmap"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


# ── Resume Analyze (open-resume schema: JSON body) ────────────────────────────
class ResumeAnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str


@app.post("/resume/analyze")
async def resume_analyze(request: ResumeAnalyzeRequest):
    """
    Analyze a resume against a job description.
    Accepts JSON { resume_text, job_description }.
    Returns the exact AnalysisResponse schema:
      overall_score, ats_score, match_score,
      strengths, weaknesses, missing_keywords,
      section_feedback, improved_bullets
    """
    try:
        from agents.resume_agent import analyze_resume_structured
        from agents.memory_agent import save_resume_analysis

        if not request.resume_text or len(request.resume_text.strip()) < 20:
            raise HTTPException(status_code=400, detail="resume_text is too short")
        if not request.job_description or len(request.job_description.strip()) < 10:
            raise HTTPException(status_code=400, detail="job_description is required")

        result = analyze_resume_structured(
            resume_text=request.resume_text,
            job_description=request.job_description,
        )
        # Save to mem0 for cross-agent context
        try:
            save_resume_analysis("default", request.job_description[:80], result)
        except Exception:
            pass
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume analysis error: {str(e)}")


# ── Resume Analyze via PDF Upload (open-resume schema) ───────────────────────
@app.post("/resume/analyze/upload")
async def resume_analyze_upload(
    file: UploadFile = File(...),
    job_description: str = Form(...),
):
    """
    Upload a resume PDF + paste job description.
    Returns the same AnalysisResponse schema as /resume/analyze.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    try:
        from agents.resume_agent import analyze_resume_structured
        from agents.memory_agent import save_resume_analysis
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        resume_text = extract_text_from_pdf(tmp_path)
        os.unlink(tmp_path)

        if not resume_text or len(resume_text.strip()) < 20:
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


# ── Resume Improve (open-resume schema: /improve endpoint) ───────────────────
class ResumeImproveRequest(BaseModel):
    text: str
    context: str = ""


@app.post("/resume/improve")
async def resume_improve(request: ResumeImproveRequest):
    """
    Rewrite a single resume bullet / paragraph.
    Accepts JSON { text, context }.
    Returns { improved: "..." }
    """
    try:
        from agents.resume_agent import improve_text

        if not request.text or len(request.text.strip()) < 3:
            raise HTTPException(status_code=400, detail="text is required")

        improved = improve_text(request.text, request.context)
        return {"improved": improved}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Improve error: {str(e)}")


# ── Resume Analysis Only (legacy plain-text) ──────────────────────────────────
@app.post("/resume-analysis")
async def resume_analysis_only(
    resume_text: str = Form(...),
    job_title: str = Form(...),
):
    """
    Analyze a resume (step 1 of pipeline) without running full analysis.
    Returns plain markdown text for backward compatibility.
    """
    try:
        from agents.resume_agent import analyze_resume
        
        if not resume_text or len(resume_text.strip()) < 10:
            raise HTTPException(status_code=400, detail="Resume text is too short")
        
        if not job_title or len(job_title.strip()) < 2:
            raise HTTPException(status_code=400, detail="Job title is required")
        
        analysis = analyze_resume(resume_text, job_title)
        return {"analysis": analysis}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume analysis error: {str(e)}")


# ── Resume Analysis Structured (legacy — kept for backward compat) ────────────
@app.post("/resume/analyze-structured")
async def resume_analyze_structured_legacy(
    file: UploadFile = File(...),
    job_title: str = Form(...),
):
    """
    Legacy endpoint: Upload PDF + job_title → AnalysisResponse JSON.
    Prefer /resume/analyze/upload (uses job_description for better accuracy).
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    try:
        from agents.resume_agent import analyze_resume_structured
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        resume_text = extract_text_from_pdf(tmp_path)
        os.unlink(tmp_path)

        if not resume_text or len(resume_text.strip()) < 20:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")

        result = analyze_resume_structured(resume_text, f"Target role: {job_title}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Structured analysis error: {str(e)}")


# ── Resume Section Improver (NEW) ─────────────────────────────────────────────
class SectionImproveRequest(BaseModel):
    section_name: str
    content: str
    job_title: str

@app.post("/resume/improve-section")
async def resume_improve_section(request: SectionImproveRequest):
    """
    Take an existing resume section and return AI-enhanced content.
    Uses strong action verbs, metrics, and ATS-friendly language.
    """
    try:
        from agents.resume_agent import improve_resume_section

        if not request.content or len(request.content.strip()) < 5:
            raise HTTPException(status_code=400, detail="Content is too short to improve")

        improved = improve_resume_section(
            section_name=request.section_name,
            content=request.content,
            job_title=request.job_title,
        )
        return {"improved_content": improved}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Section improve error: {str(e)}")


# ── Resume Section Generator (NEW) ───────────────────────────────────────────
class SectionGenerateRequest(BaseModel):
    section_name: str
    context: str
    job_title: str

@app.post("/resume/generate-section")
async def resume_generate_section(request: SectionGenerateRequest):
    """
    Generate a complete resume section from minimal context.
    Returns polished, ATS-optimized content.
    """
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


# ── Multi-Turn Interview Session Models ──────────────────────────────────────
class InterviewStartRequest(BaseModel):
    job_title: str
    resume_summary: str = ""

class InterviewReplyRequest(BaseModel):
    session_id: str
    answer: str
    question_num: int


# ── Start Interview Session ───────────────────────────────────────────────────
@app.post("/interview/start")
async def interview_start(request: InterviewStartRequest):
    """
    Begin a new multi-turn interview session with Sam.
    Returns the first question and a session_id for subsequent turns.
    """
    try:
        from agents.interview_agent import start_interview

        if not request.job_title or len(request.job_title.strip()) < 2:
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interview start error: {str(e)}")


# ── Reply to Interview (multi-turn) ──────────────────────────────────────────
@app.post("/interview/reply")
async def interview_reply(request: InterviewReplyRequest):
    """
    Submit an answer for the current question in a multi-turn session.
    Returns feedback, score, next question, and whether the interview is done.
    """
    try:
        from agents.interview_agent import evaluate_answer

        session = _interview_sessions.get(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found. Start a new interview.")

        if not request.answer or len(request.answer.strip()) < 2:
            raise HTTPException(status_code=400, detail="Answer cannot be empty")

        # Append user answer to history
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

        # Append assistant response to history
        session["history"].append({
            "role": "assistant",
            "content": f"Feedback: {feedback}\n\nNext: {next_question}"
        })
        session["question_num"] = request.question_num + 1

        # Clean up session if done
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


# ── Interview Generation (batch/legacy Form endpoint) ────────────────────────
@app.post("/interview")
async def generate_interview_questions(
    job_title: str = Form(...),
    resume_summary: str = Form(...),
):
    """
    Generate interview questions based on job title and resume (step 2 of pipeline).
    """
    try:
        from agents.interview_agent import generate_interview
        
        interview = generate_interview(
            job_title=job_title,
            resume_summary=resume_summary,
            candidate_answers="",
        )
        return {"interview": interview}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interview generation error: {str(e)}")


# ── Job Search ────────────────────────────────────────────────────────────────
@app.post("/jobs")
async def search_jobs(
    job_title: str = Form(...),
    skills_summary: str = Form(""),
    skills_list: str = Form(""),  # comma-separated list of skills
):
    """
    Search for matching jobs using Firecrawl (Agent 3: Zara).
    Accepts job_title, skills_summary, and optional comma-separated skills_list.
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
            save_job_search("default", job_title, skills_summary)
        except Exception:
            pass
        return {"jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job search error: {str(e)}")


# ── Career Roadmap ───────────────────────────────────────────────────────────
@app.post("/roadmap")
async def generate_roadmap(
    job_title: str = Form(...),
    skills_gap: str = Form(...),
):
    """
    Generate career roadmap (step 4 of pipeline).
    """
    try:
        from agents.career_planner_agent import build_roadmap
        
        roadmap = build_roadmap(job_title=job_title, skills_gap=skills_gap)
        return {"roadmap": roadmap}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Roadmap generation error: {str(e)}")


# ── Audio Transcription ───────────────────────────────────────────────────────
@app.post("/interview/transcribe")
async def transcribe_audio_endpoint(file: UploadFile = File(...)):
    """
    Transcribe voice audio using Groq Whisper.
    Accepts any browser audio format (webm, wav, mp4, ogg).
    Returns: { text: "transcribed text" }
    """
    try:
        from agents.interview_agent import transcribe_audio

        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty audio file")

        text = transcribe_audio(contents)
        return {"text": text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")


# ── Root index.html for SPA ───────────────────────────────────────────────────
@app.get("/")
async def serve_index():
    """Serve the main HTML file for the SPA."""
    frontend_dist = Path(__file__).parent / "frontend/dist/index.html"
    if frontend_dist.exists():
        return FileResponse(frontend_dist)
    return {"message": "Frontend not built yet. Run 'npm run build' in frontend/"}


# ── Mount static files (CSS, JS, assets) ──────────────────────────────────────
frontend_dist = Path(__file__).parent / "frontend/dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets", html=False), name="assets")


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"""
    ╔════════════════════════════════════════════════════════╗
    ║         Baymax AI Backend API                          ║
    ║  🚀 Starting server on {host}:{port}              ║
    ║  📖 Docs available at http://localhost:{port}/docs ║
    ╚════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=DEBUG,
        log_level="info",
    )
