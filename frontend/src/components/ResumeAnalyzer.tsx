/**
 * ResumeAnalyzer.tsx — AI Resume Analyzer (Alex)
 *
 * Layout matching the open-resume AnalysisPanel / ResumeAnalyzerForm design:
 *   Left panel  (50%) — Resume source picker + Job Description textarea + trigger
 *   Right panel (50%) — Score cards, Strengths, Gaps, Keywords, Section Feedback,
 *                        Improved Bullets with "Apply to Builder" action
 *
 * API endpoints used:
 *   POST /resume/analyze        — JSON { resume_text, job_description }
 *   POST /resume/analyze/upload — multipart/form-data  { file, job_description }
 */

import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, Copy, Check, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types (matching AnalysisResponse from open-resume jobprep-api.ts) ─────────

interface SectionFeedback {
  education: string;
  skills: string;
  projects: string;
  experience: string;
}

interface ImprovedBullet {
  original: string;
  improved: string;
}

interface AnalysisResult {
  overall_score: number;
  ats_score: number;
  match_score: number;
  strengths: string[];
  weaknesses: string[];
  missing_keywords: string[];
  section_feedback: SectionFeedback;
  improved_bullets: ImprovedBullet[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

import { API_BASE_URL as API_BASE } from "@/lib/api";


async function analyzeResumeJSON(resumeText: string, jobDescription: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/resume/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume_text: resumeText, job_description: jobDescription }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Returns both the analysis and the extracted resume text so the caller can
// stash the resume content into the user session even when the user only
// uploaded a PDF (no Builder content). Without this every downstream agent
// would see an empty resume and produce generic output.
async function analyzeResumePDF(
  file: File,
  jobDescription: string,
): Promise<{ analysis: AnalysisResult; extractedText: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("job_description", jobDescription);
  const res = await fetch(`${API_BASE}/resume/analyze/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  const json = await res.json();
  const extractedText: string = (json && typeof json.extracted_resume_text === "string")
    ? json.extracted_resume_text
    : "";
  return { analysis: json, extractedText };
}

// ── Normalize API response — fill in all missing/null fields ────────────────
// Without this, null fields crash the render (TypeError → blank white page)
function normalizeResult(data: unknown): AnalysisResult {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    overall_score:     typeof d.overall_score  === "number" ? d.overall_score  : 0,
    ats_score:         typeof d.ats_score       === "number" ? d.ats_score       : 0,
    match_score:       typeof d.match_score     === "number" ? d.match_score     : 0,
    strengths:         Array.isArray(d.strengths)         ? (d.strengths as string[])         : [],
    weaknesses:        Array.isArray(d.weaknesses)        ? (d.weaknesses as string[])        : [],
    missing_keywords:  Array.isArray(d.missing_keywords)  ? (d.missing_keywords as string[])  : [],
    improved_bullets:  Array.isArray(d.improved_bullets)  ? (d.improved_bullets as ImprovedBullet[]) : [],
    section_feedback:  (d.section_feedback && typeof d.section_feedback === "object")
      ? (d.section_feedback as SectionFeedback)
      : { education: "", skills: "", projects: "", experience: "" },
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────


const scoreColor = (s: number) => {
  if (s >= 80) return { bg: "#0d2818", border: "#166534", text: "#4ade80", bar: "#22c55e" };
  if (s >= 60) return { bg: "#1a1200", border: "#92400e", text: "#fbbf24", bar: "#f59e0b" };
  return { bg: "#1a0808", border: "#7f1d1d", text: "#f87171", bar: "#ef4444" };
};

const ScoreCard = ({ label, score }: { label: string; score: number }) => {
  const c = scoreColor(score);
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: c.text, opacity: 0.8 }}>{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color: c.text }}>{score}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#1f1f1f" }}>
        <div
          className="h-full transition-all duration-700"
          style={{ width: `${score}%`, background: c.bar, boxShadow: `0 0 8px ${c.bar}` }}
        />
      </div>
    </div>
  );
};

const BulletItem = ({
  bullet,
  index,
  onApply,
  applying,
}: {
  bullet: ImprovedBullet;
  index: number;
  onApply: (i: number) => void;
  applying: boolean;
}) => (
  <div className="space-y-3 rounded-xl p-4" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">Original</p>
      <p className="text-sm text-gray-400 line-through decoration-gray-600">{bullet.original}</p>
    </div>
    <div className="rounded-lg p-3" style={{ background: "#0d1a0d", border: "1px solid #166534" }}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider text-green-500">✨ Improved</p>
      <p className="text-sm font-medium text-green-300">{bullet.improved}</p>
    </div>
    <button
      onClick={() => onApply(index)}
      disabled={applying}
      className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all duration-150 disabled:opacity-40"
      style={{
        background: applying ? "#374151" : "linear-gradient(135deg, #e53e3e, #c53030)",
        boxShadow: applying ? "none" : "0 2px 12px rgba(229,62,62,0.3)",
      }}
    >
      {applying ? "Applying…" : "✓ Apply to Builder"}
    </button>
  </div>
);

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onSwitchTab?: (tab: number) => void;
  onAnalysisComplete?: (result: AnalysisResult, jobDescription: string, resumeText: string) => void;
  builderResumeText?: string;
  userId?: string;
}

// ── Main Component ────────────────────────────────────────────────────────────

const ResumeAnalyzer = ({ onSwitchTab, onAnalysisComplete, builderResumeText, userId = "default" }: Props) => {
  const { toast } = useToast();
  const [useCurrentResume, setUseCurrentResume] = useState(!!builderResumeText);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);
  const [copiedBullet, setCopiedBullet] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setPdfFile(f); setUseCurrentResume(false); }
  };

  const handleAnalyze = async () => {
    setError(null);
    if (!jobDescription.trim()) { setError("Please paste the job description."); return; }
    if (!useCurrentResume && !pdfFile) { setError("Please upload a resume PDF."); return; }
    if (useCurrentResume && !builderResumeText?.trim()) {
      setError("Resume Builder is empty — add content first.");
      return;
    }

    setLoading(true);
    try {
      let data: AnalysisResult;
      let extractedText = "";
      if (useCurrentResume && builderResumeText) {
        data = await analyzeResumeJSON(builderResumeText, jobDescription);
      } else if (pdfFile) {
        const r = await analyzeResumePDF(pdfFile, jobDescription);
        data = r.analysis;
        extractedText = r.extractedText;
      } else {
        throw new Error("No resume source selected");
      }
      const safe = normalizeResult(data);
      setResult(safe);
      // Push the resume text into the parent session so downstream agents
      // (interview / jobs / roadmap) actually have something to personalise on.
      const resumeText = (useCurrentResume && builderResumeText) ? builderResumeText : extractedText;
      onAnalysisComplete?.(safe, jobDescription, resumeText);

      // Persist to backend Mem0 (fire-and-forget)
      try {
        const { saveUserProfile } = await import("@/lib/api");
        await saveUserProfile(
          userId,
          resumeText,
          data as unknown as Record<string, unknown>,
          jobDescription.split("\n")[0].slice(0, 80),
        );
      } catch { /* non-fatal */ }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyBullet = async (idx: number) => {
    if (!result) return;
    setApplyingIndex(idx);
    await new Promise((r) => setTimeout(r, 400));
    navigator.clipboard.writeText(result.improved_bullets[idx].improved).catch(() => {});
    setCopiedBullet(idx);
    toast({ title: "✅ Copied!", description: "Paste this into your Resume Builder." });
    setTimeout(() => setCopiedBullet(null), 3000);
    setApplyingIndex(null);
  };

  const radioBase =
    "flex items-center gap-3 rounded-xl p-4 cursor-pointer transition-all duration-150";
  const radioStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "rgba(229,62,62,0.08)" : "#0f0f0f",
    border: `1px solid ${active ? "rgba(229,62,62,0.4)" : "#2a2a2a"}`,
  });

  return (
    <div className="flex flex-col">
    <div className="grid md:grid-cols-2 gap-0 min-h-[620px]" style={{ background: "#0a0a0a" }}>
      {/* ── Left Panel: Input ─────────────────────────────────────────── */}
      <div
        className="overflow-y-auto p-6 flex flex-col gap-5"
        style={{ borderRight: "1px solid #1f1f1f", background: "#0f0f0f" }}
      >
        {/* Header */}
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-800/40 bg-red-950/20 px-3 py-1 text-xs font-semibold text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Powered by Groq LLaMA 3
          </div>
          <h2 className="text-2xl font-bold text-white">
            Resume{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #ff6b6b, #e53e3e)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Analyzer
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Compare your resume against a job description and get AI-powered suggestions.
          </p>
        </div>

        {/* Resume Source */}
        <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-400">Resume Source</h3>
          <div className="space-y-2">
            {/* Option 1: Builder resume */}
            <label className={radioBase} style={radioStyle(useCurrentResume)}>
              <input
                type="radio"
                name="resume-source"
                checked={useCurrentResume}
                onChange={() => { setUseCurrentResume(true); setPdfFile(null); }}
                className="h-4 w-4 accent-red-500"
              />
              <div>
                <p className="font-semibold text-white">Use Current Builder Resume</p>
                <p className="text-xs text-gray-500">Analyze what you've built in the Builder tab</p>
              </div>
            </label>

            {/* Option 2: PDF upload */}
            <label className={radioBase} style={radioStyle(!useCurrentResume)}>
              <input
                type="radio"
                name="resume-source"
                checked={!useCurrentResume}
                onChange={() => setUseCurrentResume(false)}
                className="h-4 w-4 accent-red-500"
              />
              <div>
                <p className="font-semibold text-white">Upload PDF Resume</p>
                <p className="text-xs text-gray-500">Upload an existing resume PDF</p>
              </div>
            </label>

            {!useCurrentResume && (
              <div className="ml-4 mt-2">
                {pdfFile ? (
                  <div
                    className="flex items-center justify-between rounded-xl p-3"
                    style={{ background: "#0d1a17", border: "1px solid #166534" }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-green-300">{pdfFile.name}</p>
                      <p className="text-xs text-green-600">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label
                    className="relative block cursor-pointer rounded-xl p-5 text-center transition-all duration-150"
                    style={{ border: "2px dashed #3a3a3a", background: "#0a0a0a" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(229,62,62,0.5)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a"; }}
                  >
                    <Upload className="mx-auto mb-2 text-gray-500" size={22} />
                    <p className="text-sm font-semibold text-gray-300">Click to upload or drag & drop</p>
                    <p className="text-xs text-gray-600 mt-1">PDF files only</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Job Description */}
        <div className="rounded-xl p-5" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-gray-400">
            Job Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job description here to get the most accurate analysis..."
            className="h-44 w-full resize-none rounded-lg p-3 font-mono text-sm text-gray-200 outline-none transition-all duration-150"
            style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", caretColor: "#e53e3e" }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(229,62,62,0.5)"; e.target.style.boxShadow = "0 0 0 2px rgba(229,62,62,0.1)"; }}
            onBlur={(e) => { e.target.style.borderColor = "#2a2a2a"; e.target.style.boxShadow = "none"; }}
          />
        </div>

        {error && (
          <div className="rounded-lg p-4" style={{ background: "#1a0808", border: "1px solid #7f1d1d" }}>
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !jobDescription.trim()}
          className="w-full rounded-xl px-4 py-4 font-bold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
          style={
            loading || !jobDescription.trim()
              ? { background: "#1f1f1f" }
              : {
                  background: "linear-gradient(135deg, #e53e3e, #c53030)",
                  boxShadow: "0 4px 20px rgba(229,62,62,0.35)",
                }
          }
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full" style={{ border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white" }} />
              Analyzing with Alex AI…
            </span>
          ) : (
            "🔍 Analyze Resume"
          )}
        </button>

        {result && onSwitchTab && (
          <div className="flex gap-2">
            <button
              onClick={() => onSwitchTab(0)}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold border border-border text-muted-foreground hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              🏗️ Back to Builder
            </button>
            <button
              onClick={() => onSwitchTab(2)}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition-colors"
            >
              🎤 Start Interview →
            </button>
          </div>
        )}
      </div>

      {/* ── Right Panel: Results ──────────────────────────────────────── */}
      <div className="overflow-y-auto p-6" style={{ background: "#0a0a0a" }}>
        {result ? (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold text-white">
              Analysis{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #ff6b6b, #e53e3e)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Results
              </span>
            </h2>

            {/* 3 Score Cards */}
            <div className="grid grid-cols-3 gap-3">
              <ScoreCard label="Overall" score={result.overall_score} />
              <ScoreCard label="ATS Score" score={result.ats_score} />
              <ScoreCard label="Match" score={result.match_score} />
            </div>

            {/* Strengths */}
            {result.strengths.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "#0d1a0d", border: "1px solid #166534" }}>
                <h3 className="mb-3 font-bold text-green-400">✓ Strengths</h3>
                <ul className="space-y-1.5">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-green-300">
                      <span className="flex-shrink-0 text-green-500">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weaknesses / Gaps */}
            {result.weaknesses.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "#1a0808", border: "1px solid #7f1d1d" }}>
                <h3 className="mb-3 font-bold text-red-400">⚠ Gaps to Address</h3>
                <ul className="space-y-1.5">
                  {result.weaknesses.map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm text-red-300">
                      <span className="flex-shrink-0 text-red-500">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Keywords */}
            {result.missing_keywords.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "#1a1200", border: "1px solid #92400e" }}>
                <h3 className="mb-3 font-bold text-yellow-400">🔑 Missing Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {result.missing_keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-yellow-300"
                      style={{ background: "#292000", border: "1px solid #78350f" }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Section Feedback */}
            {Object.values(result.section_feedback).some((f) => f && f !== "Section not found in resume." && f !== "No feedback available.") && (
              <div className="space-y-3 rounded-xl p-4" style={{ background: "#0a0f1a", border: "1px solid #1e3a5f" }}>
                <h3 className="font-bold text-blue-400">📋 Section Feedback</h3>
                {Object.entries(result.section_feedback).map(([section, feedback]) => {
                  if (!feedback || feedback === "Section not found in resume." || feedback === "No feedback available.") return null;
                  return (
                    <div key={section} className="text-sm">
                      <p className="mb-1 font-semibold capitalize text-blue-300">{section}</p>
                      <p className="text-gray-400">{feedback}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Improved Bullets */}
            {result.improved_bullets.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-bold text-white">
                  💡 Suggested Improvements{" "}
                  <span className="ml-1 rounded-full bg-red-900/50 px-2 py-0.5 text-sm text-red-300">
                    {result.improved_bullets.length}
                  </span>
                </h3>
                {result.improved_bullets.map((bullet, idx) => (
                  <BulletItem
                    key={idx}
                    bullet={bullet}
                    index={idx}
                    onApply={handleApplyBullet}
                    applying={applyingIndex === idx}
                  />
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <div
              className="mb-4 h-14 w-14 animate-spin rounded-full"
              style={{ border: "3px solid #2a2a2a", borderTopColor: "#e53e3e", boxShadow: "0 0 16px rgba(229,62,62,0.3)" }}
            />
            <p className="font-medium text-gray-300">Analyzing your resume with Alex AI…</p>
            <p className="mt-1 text-sm text-gray-500">This usually takes 10–20 seconds</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <FileText size={48} className="text-gray-700 mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 mb-2">Resume Preview</h3>
            <p className="text-sm text-gray-600 max-w-xs">
              Upload your resume PDF and paste a job description, then click{" "}
              <span className="text-red-400 font-semibold">Analyze Resume</span> to get
              AI-powered insights from Alex.
            </p>
          </div>
        )}
      </div>
    </div>

    {/* ── Navigation CTAs (shown after analysis) ── */}
    {result && (
      <div className="flex flex-wrap items-center gap-3 p-4" style={{ borderTop: "1px solid #1f1f1f", background: "#0a0a0a" }}>
        <button
          onClick={() => onSwitchTab?.(0)}
          className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
          style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#aaa" }}
        >
          ← Back to Builder
        </button>
        {onSwitchTab && (
          <button
            onClick={() => onSwitchTab(2)}
            className="flex-[2] min-w-[200px] flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-sm"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
            }}
          >
            🎤 Proceed to Mock Interview →
          </button>
        )}
      </div>
    )}
  </div>
  );
};

export default ResumeAnalyzer;
