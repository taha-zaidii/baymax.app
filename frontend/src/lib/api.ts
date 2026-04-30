/**
 * api.ts - Backend API client utilities
 * Centralizes all API calls to the Baymax backend
 *
 * In development : VITE_API_URL is empty → Vite proxy forwards to :8000
 * In production  : VITE_API_URL = https://baymax-backend.onrender.com
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

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

// ─── Structured resume parse ──────────────────────────────────────────────
// Mirrors the backend `/resume/parse` endpoint — returns the resume already
// split into profile / summary / education / experience / skills / projects.

export interface ParsedResumeProfile {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
}

export interface ParsedResume {
  profile: ParsedResumeProfile;
  summary: string;
  education: string[];
  experience: string[];
  skills: string[];
  projects: string[];
  certifications: string[];
}

export interface ParseResumeResponse {
  success: boolean;
  filename: string;
  parsed: ParsedResume;
  extracted_text: string;
}

export async function parseResumeStructured(file: File): Promise<ParseResumeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/resume/parse`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || "Failed to parse resume");
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

// ── New session-aware API helpers ─────────────────────────────────────────────

export interface Certification {
  name: string;
  issuer: string;
  platform: string;
  url: string;
  duration: string;
  cost: string;
  addresses: string;
  why_relevant: string;
}

// ─── Job Scout structured response ──────────────────────────────────────────
//
// Backend now returns a deterministic list of typed JobItem objects (no LLM
// decoration). The frontend renders proper cards from this — see
// components/JobScout.tsx. Mirrors find_jobs() in agents/job_search_agent.py.

export interface JobItem {
  id: string;
  company: string;
  role: string;
  level: string;            // Internship / Trainee / Junior / Entry Level / Graduate
  location: string;         // "Karachi, Pakistan" or "Remote"
  url: string;
  domain: string;
  source: string;           // "Rozee.pk" / "LinkedIn" / ...
  match_pct: number;        // 0-100
  snippet: string;
  skills_matched: string[];
  salary: string | null;
}

export interface JobsResponse {
  jobs: JobItem[];
  top_skill_gap: string;
  application_tip: string;
  query_meta: {
    experience_level: string;
    year: string;
    job_title: string;
    skills_used: string[];
    raw_hits: number;
    kept_after_spam: number;
    returned: number;
  };
}

/**
 * Search jobs — sends the full structured skills list for personalised results.
 */
export async function searchJobsWithSkills(
  jobTitle: string,
  skillsSummary: string,
  skillsList: string[],
  userId: string,
): Promise<JobsResponse> {
  const formData = new FormData();
  formData.append("job_title", jobTitle);
  formData.append("skills_summary", skillsSummary);
  formData.append("skills_list", skillsList.join(","));
  formData.append("user_id", userId);

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

/**
 * Generate a hyper-personalised roadmap using all pipeline context.
 */
export async function generateRoadmapFull(
  jobTitle: string,
  skillsGap: string,
  currentSkills: string,
  interviewWeakAreas: string,
): Promise<{ roadmap: string }> {
  const formData = new FormData();
  formData.append("job_title", jobTitle);
  formData.append("skills_gap", skillsGap);
  formData.append("current_skills", currentSkills);
  formData.append("interview_weak_areas", interviewWeakAreas);

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

/**
 * Persist the user's full resume + analysis to Mem0 after analysis completes.
 */
export async function saveUserProfile(
  userId: string,
  resumeText: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysisResult: Record<string, any>,
  jobTitle: string,
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/resume/save-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      resume_text: resumeText,
      analysis_result: analysisResult,
      job_title: jobTitle,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to save profile");
  }
  return response.json();
}

/**
 * Persist mock interview results for the Roadmap agent.
 */
export async function saveInterviewResult(
  userId: string,
  avgScore: number,
  weakAreas: string,
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/interview/save-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, avg_score: avgScore, weak_areas: weakAreas }),
  });
  if (!response.ok) return { success: false };
  return response.json();
}

/**
 * Get AI-recommended certifications based on the user's specific skill gaps.
 */
export async function getCertifications(
  jobTitle: string,
  skillsGap: string[],
  currentSkills: string[],
): Promise<{ certifications: Certification[] }> {
  const response = await fetch(`${API_BASE_URL}/roadmap/certifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_title: jobTitle, skills_gap: skillsGap, current_skills: currentSkills }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Certifications request failed");
  }
  return response.json();
}

// ── CSP Roadmap Solver (course-required AI algorithm) ────────────────────────
//
// Mirrors backend/agents/csp_planner.py. The frontend asks the backend for
// the full trace of the solver in one call, then animates it locally —
// keeping the UX snappy and the demo reproducible for grading.

export interface CSPTask {
  id: string;
  label: string;
  skill: string;
  hours: number;
  category: string;
  earliest_week: number;
  deadline_week: number | null;
}

export interface CSPConstraints {
  prerequisites: [string, string][];
  exclusives: [string, string][];
  total_weeks: number;
  weekly_hour_budget: number;
}

export interface CSPTraceEvent {
  step: number;
  type: string;
  description: string;
  domains: Record<string, number[]>;
  assignment: Record<string, number>;
  variable?: string;
  value?: number;
  arc?: [string, string];
  removed_values?: number[];
  reason?: string;
  initial_domains?: Record<string, number[]>;
  arcs?: [string, string][];
}

export interface CSPStats {
  ac3_arc_checks: number;
  ac3_values_pruned: number;
  bt_assignments: number;
  bt_backtracks: number;
}

export interface CSPResult {
  success: boolean;
  reason: string;
  assignment: Record<string, number>;
  tasks: CSPTask[];
  constraints: CSPConstraints;
  trace: CSPTraceEvent[];
  stats: CSPStats;
}

/**
 * Run the CSP solver on the backend and return the full trace plus the
 * final assignment. Throws on network / 4xx / 5xx; the caller owns the UI.
 */
export async function runCspRoadmap(
  skillsGap: string[],
  totalWeeks: number = 12,
  weeklyHourBudget: number = 15,
): Promise<CSPResult> {
  const response = await fetch(`${API_BASE_URL}/roadmap/csp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      skills_gap: skillsGap,
      total_weeks: totalWeeks,
      weekly_hour_budget: weeklyHourBudget,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || "CSP solver request failed");
  }
  return response.json();
}


// ── Rahul Interactive Chat ────────────────────────────────────────────────────

export interface RahulChatResponse {
  reply: string;
  show_aid: boolean;
  resources: Array<{ title: string; url: string; platform: string; duration: string; free: boolean; financial_aid?: boolean }>;
  aid_course: string;
  aid_template?: string;
}

/**
 * Send a follow-up message to Rahul (career mentor) and get a response.
 */
export async function chatWithRahul(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  jobTitle: string,
  skillsGap: string,
): Promise<RahulChatResponse> {
  const response = await fetch(`${API_BASE_URL}/roadmap/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_message: userMessage,
      conversation_history: conversationHistory,
      job_title: jobTitle,
      skills_gap: skillsGap,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || "Chat failed");
  }
  return response.json();
}

