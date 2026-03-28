/**
 * api.ts - Backend API client utilities
 * Centralizes all API calls to the Baymax backend
 */

export const API_BASE_URL = import.meta.env.DEV
  ? "http://localhost:8000"
  : window.location.origin;

export interface PipelineResponse {
  resume_analysis: string;
  interview_report: string;
  job_matches: string;
  career_roadmap: string;
}

export interface ExtractResponse {
  success: boolean;
  filename: string;
  extracted_text: string;
  character_count: number;
}

export interface HealthResponse {
  status: string;
  api_keys_configured: boolean;
  debug_mode: boolean;
}

/**
 * Check if the backend API is healthy
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) throw new Error("Health check failed");
  return response.json();
}

/**
 * Extract text from a resume PDF
 */
export async function extractResume(file: File): Promise<ExtractResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/extract-resume`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to extract resume");
  }

  return response.json();
}

/**
 * Run the full pipeline analysis
 */
export async function runPipeline(
  resumeText: string,
  jobTitle: string,
  candidateAnswers: string = "",
): Promise<PipelineResponse> {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resume_text: resumeText,
      job_title: jobTitle,
      candidate_answers: candidateAnswers,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Pipeline analysis failed");
  }

  return response.json();
}

/**
 * Analyze resume only (step 1)
 */
export async function analyzeResume(
  resumeText: string,
  jobTitle: string,
): Promise<{ analysis: string }> {
  const formData = new FormData();
  formData.append("resume_text", resumeText);
  formData.append("job_title", jobTitle);

  const response = await fetch(`${API_BASE_URL}/resume-analysis`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Resume analysis failed");
  }

  return response.json();
}

/**
 * Generate interview questions (step 2)
 */
export async function generateInterview(
  jobTitle: string,
  resumeSummary: string,
): Promise<{ interview: string }> {
  const formData = new FormData();
  formData.append("job_title", jobTitle);
  formData.append("resume_summary", resumeSummary);

  const response = await fetch(`${API_BASE_URL}/interview`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Interview generation failed");
  }

  return response.json();
}

/**
 * Search for matching jobs (step 3)
 */
export async function searchJobs(
  jobTitle: string,
  skillsSummary: string,
): Promise<{ jobs: string }> {
  const formData = new FormData();
  formData.append("job_title", jobTitle);
  formData.append("skills_summary", skillsSummary);

  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Job search failed");
  }

  return response.json();
}

export interface RoadmapResponse {
  roadmap: string;
}

export async function generateRoadmap(
  jobTitle: string,
  skillsGap: string,
): Promise<RoadmapResponse> {
  const formData = new FormData();
  formData.append("job_title", jobTitle);
  formData.append("skills_gap", skillsGap);

  const response = await fetch(`${API_BASE_URL}/roadmap`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Roadmap generation failed");
  }

  return response.json();
}

// ── Multi-turn Interview Session API ─────────────────────────────────────────

export interface InterviewStartResponse {
  session_id: string;
  question: string;
}

export interface InterviewReplyResponse {
  feedback: string;
  score: number;
  next_question: string;
  is_done: boolean;
}

/**
 * Start a new multi-turn interview session with Sam.
 * Returns the first question and a session_id.
 */
export async function startInterview(
  jobTitle: string,
  resumeSummary: string = "",
): Promise<InterviewStartResponse> {
  const response = await fetch(`${API_BASE_URL}/interview/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_title: jobTitle, resume_summary: resumeSummary }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to start interview");
  }

  return response.json();
}

/**
 * Submit an answer for the current interview question.
 * Returns feedback, score, the next question, and whether the interview is done.
 */
export async function replyInterview(
  sessionId: string,
  answer: string,
  questionNum: number,
): Promise<InterviewReplyResponse> {
  const response = await fetch(`${API_BASE_URL}/interview/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      answer,
      question_num: questionNum,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to submit answer");
  }

  return response.json();
}

/**
 * Transcribe voice audio via Groq Whisper on the backend.
 * Accepts any audio blob from the browser's MediaRecorder.
 */
export async function transcribeAudio(
  audioBlob: Blob,
): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");

  const response = await fetch(`${API_BASE_URL}/interview/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Transcription failed");
  }

  return response.json();
}

// ── Structured Resume Analysis (NEW) ─────────────────────────────────────────

export interface ResumeImprovement {
  section: string;
  before: string;
  after: string;
  why: string;
}

export interface ResumeAnalysisStructured {
  overall_score: number;
  ats_score: number;
  keyword_match_score: number;
  impact_score: number;
  formatting_score: number;
  verdict: "Excellent" | "Good" | "Needs Improvement";
  strengths: string[];
  skill_gaps: string[];
  keywords_found: string[];
  keywords_missing: string[];
  improvements: ResumeImprovement[];
  rewritten_summary: string;
  recommendation: string;
}

/**
 * Upload a PDF resume and get a fully structured JSON analysis back.
 * Returns 5 scores, keyword clouds, strengths, gaps, improvements, and
 * a rewritten professional summary.
 */
export async function analyzeResumeStructured(
  file: File,
  jobTitle: string,
  experienceLevel: string = "0-1",
): Promise<ResumeAnalysisStructured> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("job_title", jobTitle);
  formData.append("experience_level", experienceLevel);

  const response = await fetch(`${API_BASE_URL}/resume/analyze-structured`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Structured analysis failed");
  }

  return response.json();
}

/**
 * Enhance an existing resume section using AI.
 * Returns improved content with strong action verbs, metrics, and ATS keywords.
 */
export async function improveResumeSection(
  sectionName: string,
  content: string,
  jobTitle: string,
): Promise<{ improved_content: string }> {
  const response = await fetch(`${API_BASE_URL}/resume/improve-section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      section_name: sectionName,
      content,
      job_title: jobTitle,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Section improvement failed");
  }

  return response.json();
}

/**
 * Generate a brand-new resume section from minimal context using AI.
 * Returns polished, ATS-optimized content ready to paste.
 */
export async function generateResumeSection(
  sectionName: string,
  context: string,
  jobTitle: string,
): Promise<{ generated_content: string }> {
  const response = await fetch(`${API_BASE_URL}/resume/generate-section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      section_name: sectionName,
      context,
      job_title: jobTitle,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Section generation failed");
  }

  return response.json();
}

