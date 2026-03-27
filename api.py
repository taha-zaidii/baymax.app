"""
api.py — FastAPI Backend for Baymax AI

Provides RESTful API endpoints that wrap the multi-agent crew pipeline.
Serves the frontend and handles file uploads, text extraction, and worker orchestration.
"""
import os
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path

from config import validate_keys, APP_TITLE, DEBUG, GROQ_API_KEY, SERPER_API_KEY
from crew import run_pipeline
from tools.pdf_tool import extract_text_from_pdf

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


# ── Resume Analysis Only ──────────────────────────────────────────────────────
@app.post("/resume-analysis")
async def resume_analysis_only(
    resume_text: str = Form(...),
    job_title: str = Form(...),
):
    """
    Analyze a resume (step 1 of pipeline) without running full analysis.
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


# ── Interview Generation ──────────────────────────────────────────────────────
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
    skills_summary: str = Form(...),
):
    """
    Search for matching jobs (step 3 of pipeline).
    """
    try:
        from agents.job_search_agent import find_jobs
        
        jobs = find_jobs(job_title, skills_summary=skills_summary)
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
