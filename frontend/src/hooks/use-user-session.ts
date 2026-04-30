/**
 * use-user-session.ts — Central session store for all Baymax agents
 *
 * Every agent reads from and writes to this single source of truth.
 * State is persisted to localStorage on every update so it survives
 * page refreshes. Each unique browser gets its own UUID user_id.
 *
 * Sequential unlock rules:
 *  - Tab 0 (Builder):    Always accessible
 *  - Tab 1 (Analyzer):   Unlocked once resume exists (finalResumeText set)
 *  - Tab 2 (Interview):  Unlocked if resume OR targetJobTitle is set
 *  - Tab 3 (Job Scout):  Unlocked if resume OR targetJobTitle is set
 *  - Tab 4 (Roadmap):    Unlocked if resume OR targetJobTitle is set
 */

import { useState, useCallback, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  overall_score: number;
  ats_score: number;
  match_score: number;
  strengths: string[];
  weaknesses: string[];
  missing_keywords: string[];
  section_feedback: {
    education: string;
    skills: string;
    projects: string;
    experience: string;
  };
  improved_bullets: { original: string; improved: string }[];
}

export interface UserSession {
  userId: string;

  // ── Stage 1: Resume Builder ──────────────────────────────────────────────
  finalResumeText: string;      // plain text of current resume
  resumeSource: "builder" | "upload" | null;

  // ── Stage 2: Resume Analyzer ─────────────────────────────────────────────
  analysisResult: AnalysisResult | null;
  targetJobTitle: string;        // extracted from first line of JD
  jobDescription: string;        // full pasted JD
  skillsList: string[];          // extracted from analysis missing_keywords + strengths
  skillsGap: string[];           // missing_keywords from analysis
  currentSkills: string[];       // strengths keywords extracted from analysis

  // ── Stage 3: Interview Coach ─────────────────────────────────────────────
  interviewCompleted: boolean;
  interviewAvgScore: number;
  interviewWeakAreas: string;    // comma-sep areas that scored < 6

  // ── Stage 4: Job Scout ───────────────────────────────────────────────────
  lastJobSearch: string;

  // ── Stage 5: Roadmap ─────────────────────────────────────────────────────
  roadmapGenerated: boolean;
}

const STORAGE_KEY = "baymax_session_v2";

// ─── Defaults ─────────────────────────────────────────────────────────────────

function generateUserId(): string {
  return "bx-" + Math.random().toString(36).slice(2, 11) + "-" + Date.now().toString(36);
}

const DEFAULT_SESSION: Omit<UserSession, "userId"> = {
  finalResumeText: "",
  resumeSource: null,
  analysisResult: null,
  targetJobTitle: "",
  jobDescription: "",
  skillsList: [],
  skillsGap: [],
  currentSkills: [],
  interviewCompleted: false,
  interviewAvgScore: 0,
  interviewWeakAreas: "",
  lastJobSearch: "",
  roadmapGenerated: false,
};

// ─── Persist ──────────────────────────────────────────────────────────────────

function loadSession(): UserSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults to handle new fields added in future versions
      return { ...DEFAULT_SESSION, ...parsed };
    }
  } catch {
    /* ignore corrupted storage */
  }
  const userId = generateUserId();
  return { userId, ...DEFAULT_SESSION };
}

function saveSession(session: UserSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore storage quota errors */
  }
}

// ─── Unlock Logic ─────────────────────────────────────────────────────────────

/**
 * Sequential unlock rules — strict, no loopholes:
 *
 * Tab 0 (Builder):   Always open — starting point
 * Tab 1 (Analyzer):  Always open — user can upload PDF directly here
 * Tab 2 (Interview): Requires analysis done OR (resume + job title both set)
 * Tab 3 (Job Scout): Same as Interview
 * Tab 4 (Roadmap):   Same as Interview
 */
export function isTabUnlocked(tabIndex: number, session: UserSession): boolean {
  const hasResume   = session.finalResumeText.trim().length > 50;
  const hasAnalysis = session.analysisResult !== null;
  const hasJobTitle = session.targetJobTitle.trim().length > 1;

  // Tabs 2-4: need a completed analysis OR at minimum resume+jobTitle
  const canProceed = hasAnalysis || (hasResume && hasJobTitle);

  switch (tabIndex) {
    case 0: return true;         // Builder — always
    case 1: return true;         // Analyzer — always (can upload here)
    case 2:
    case 3:
    case 4: return canProceed;   // need analysis OR resume+jobTitle
    default: return false;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserSession() {
  const [session, setSessionState] = useState<UserSession>(loadSession);

  // Persist to localStorage whenever session changes
  useEffect(() => {
    saveSession(session);
  }, [session]);

  const setSession = useCallback(
    (updater: Partial<UserSession> | ((prev: UserSession) => Partial<UserSession>)) => {
      setSessionState((prev) => {
        const patch = typeof updater === "function" ? updater(prev) : updater;
        return { ...prev, ...patch };
      });
    },
    []
  );

  /** Wipe session but keep userId */
  const resetSession = useCallback(() => {
    setSessionState((prev) => ({ userId: prev.userId, ...DEFAULT_SESSION }));
  }, []);

  /**
   * Call after analysis completes — extracts skillsList, skillsGap,
   * currentSkills, and targetJobTitle from the raw analysis result.
   */
  const applyAnalysisResult = useCallback(
    (result: AnalysisResult, jobDescription: string, resumeText: string) => {
      const firstLine = jobDescription.split("\n")[0].trim();
      const targetJobTitle = firstLine.length > 2 ? firstLine.slice(0, 80) : "Software Engineer";

      // Build skills arrays from analysis
      const skillsGap = result.missing_keywords ?? [];
      // Derive current skills from strengths (rough keyword extraction)
      const currentSkills = (result.strengths ?? [])
        .flatMap((s) => s.match(/\b[A-Z][a-zA-Z+#]+\b/g) ?? [])
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 15);

      // Patch the session with everything we got from the analysis. Crucially we
      // only overwrite finalResumeText when the analyzer actually has new text
      // for it — otherwise an empty string from the PDF-upload code path would
      // wipe the builder's content to undefined and crash every later .trim()
      // call (this was the cause of the post-analyze black-screen).
      const patch: Partial<UserSession> = {
        analysisResult: result,
        targetJobTitle,
        jobDescription,
        skillsGap,
        currentSkills,
        skillsList: [...new Set([...skillsGap, ...currentSkills])],
      };
      if (resumeText && resumeText.trim().length > 0) {
        patch.finalResumeText = resumeText;
      }
      setSession(patch);
    },
    [setSession]
  );

  /**
   * Call when an interview session ends.
   * Derives weak areas from turns that scored below 6.
   */
  const applyInterviewResult = useCallback(
    (avgScore: number, weakAreasList: string[]) => {
      setSession({
        interviewCompleted: true,
        interviewAvgScore: avgScore,
        interviewWeakAreas: weakAreasList.join(", "),
      });
    },
    [setSession]
  );

  return {
    session,
    setSession,
    resetSession,
    applyAnalysisResult,
    applyInterviewResult,
    isTabUnlocked: (i: number) => isTabUnlocked(i, session),
  };
}
