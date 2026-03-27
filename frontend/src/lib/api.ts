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

/**
 * Generate career roadmap (step 4)
 */
export async function generateRoadmap(
  jobTitle: string,
  skillsGap: string,
): Promise<{ roadmap: string }> {
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
