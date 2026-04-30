/**
 * Dashboard.tsx — Baymax Multi-Agent Career Pipeline
 *
 * Inspired by Agent4-JobPrep-AI-main sidebar layout.
 * Strict sequential flow:  Builder → Analyzer → Interview → Job Scout → Roadmap
 *
 * Lock rules (from useUserSession):
 *   Tab 0 Builder:  Always open
 *   Tab 1 Analyzer: Always open (PDF upload here)
 *   Tab 2-4:        Require analysis done OR (resume + jobTitle)
 */

import { useState, useEffect } from "react";
import {
  Construction, ScanText, Mic2, Search, Map,
  Sparkles, ChevronRight, CheckCircle2, Lock, ArrowRight,
} from "lucide-react";
import BaymaxMascot from "./BaymaxMascot";
import ResumeBuilder  from "./ResumeBuilder";
import ResumeAnalyzer from "./ResumeAnalyzer";
import InterviewCoach from "./InterviewCoach";
import JobScout       from "./JobScout";
import RoadmapPlanner from "./RoadmapPlanner";
import { useUserSession } from "@/hooks/use-user-session";

// ── Tab meta — Agent names as decided ─────────────────────────────────────────

const TABS = [
  {
    id: 0,
    icon: Construction,
    label: "Resume Builder",
    sublabel: "Build or upload your resume",
    agent: "Cass",
    agentTitle: "AI-Powered Resume Builder",
    color: "#3b82f6",
  },
  {
    id: 1,
    icon: ScanText,
    label: "Resume Analyzer",
    sublabel: "ATS score & keyword analysis",
    agent: "Honey",
    agentTitle: "Resume Analyzer & ATS Scorer",
    color: "#e53e3e",
  },
  {
    id: 2,
    icon: Mic2,
    label: "Mock Interview",
    sublabel: "Personalized voice interview",
    agent: "Hiro",
    agentTitle: "Voice Interview Coach",
    color: "#7c3aed",
  },
  {
    id: 3,
    icon: Search,
    label: "Job Scout",
    sublabel: "LinkedIn · Rozee.pk · Indeed",
    agent: "Fred",
    agentTitle: "Job Scout & Market Intelligence",
    color: "#059669",
  },
  {
    id: 4,
    icon: Map,
    label: "Career Roadmap",
    sublabel: "CSP-scheduled learning plan",
    agent: "Rahul",
    agentTitle: "CSP Career Roadmap Planner (AC-3 + Backtracking)",
    color: "#d97706",
  },
];

// ── Lock tooltip ───────────────────────────────────────────────────────────────
const lockReasons: Record<number, string> = {
  2: "Complete resume analysis first",
  3: "Complete resume analysis first",
  4: "Complete resume analysis first",
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState(0);
  const {
    session,
    setSession,
    applyAnalysisResult,
    applyInterviewResult,
    isTabUnlocked,
  } = useUserSession();

  // Completion flags
  const done = [
    session.finalResumeText.trim().length > 50,
    session.analysisResult !== null,
    session.interviewCompleted,
    session.lastJobSearch.trim().length > 0,
    session.roadmapGenerated,
  ];

  const unlocked = TABS.map((t) => isTabUnlocked(t.id));

  const goTab = (i: number) => {
    if (unlocked[i]) setActiveTab(i);
  };

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleResumeReady = (text: string) =>
    setSession({ finalResumeText: text, resumeSource: "builder" });

  const handleAnalysisDone = (
    result: Parameters<typeof applyAnalysisResult>[0],
    jobDescription: string,
    resumeText: string,
  ) => {
    applyAnalysisResult(result, jobDescription, resumeText);
  };

  const handleInterviewDone = (avg: number, weak: string[]) =>
    applyInterviewResult(avg, weak);

  const handleJobSearched = (title: string) =>
    setSession({ lastJobSearch: title });

  const handleRoadmapDone = () =>
    setSession({ roadmapGenerated: true });

  // Agent label for header
  const activeAgent = TABS[activeTab]?.agent ?? "Baymax";
  const activeColor = TABS[activeTab]?.color ?? "#e53e3e";

  // Progress %
  const completedCount = done.filter(Boolean).length;
  const progressPct = Math.round((completedCount / TABS.length) * 100);

  return (
    <section id="dashboard" className="py-24 relative min-h-screen" style={{ background: "#050505" }}>
      {/* Ambient glow */}
      <div
        className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none"
        style={{ background: "rgba(229,62,62,0.04)" }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "rgba(124,58,237,0.03)" }}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        <div
          className="flex flex-col lg:flex-row rounded-[32px] overflow-hidden min-h-[820px]"
          style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          }}
        >
          {/* ─── SIDEBAR ──────────────────────────────────────────────────── */}
          <aside
            className="lg:w-72 shrink-0 flex flex-col gap-8 p-6 lg:p-8"
            style={{ borderRight: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.25)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <BaymaxMascot size={48} showWave={false} showTooltip={false} />
              <div>
                <p className="font-syne font-extrabold text-sm text-white leading-none">Baymax.app</p>
                <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mt-0.5">AI Career Suite</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] font-mono text-green-400 uppercase tracking-wider">Live</span>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[10px] font-mono text-white/20 uppercase tracking-widest mb-2">
                <span>Pipeline Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct >= 80 ? "#22c55e" : progressPct >= 40 ? "#f59e0b" : "#e53e3e",
                    boxShadow: `0 0 8px currentColor`,
                  }}
                />
              </div>
            </div>

            {/* Nav */}
            <nav className="flex flex-col gap-1.5">
              {TABS.map((tab) => {
                const isActive   = activeTab === tab.id;
                const isDone     = done[tab.id];
                const isUnlocked = unlocked[tab.id];
                const Icon       = tab.icon;

                return (
                  <button
                    key={tab.id}
                    onClick={() => goTab(tab.id)}
                    disabled={!isUnlocked}
                    title={!isUnlocked ? lockReasons[tab.id] : tab.label}
                    className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-300 ${
                      isActive
                        ? "shadow-lg"
                        : isUnlocked
                        ? "hover:bg-white/5"
                        : "opacity-40 cursor-not-allowed"
                    }`}
                    style={isActive ? { background: tab.color + "18", border: `1px solid ${tab.color}30` } : { border: "1px solid transparent" }}
                  >
                    {/* Step indicator */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                      style={{
                        background: isActive ? tab.color + "25" : isDone ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${isActive ? tab.color + "50" : isDone ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {isDone && !isActive ? (
                        <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                      ) : !isUnlocked ? (
                        <Lock size={12} className="text-white/20" />
                      ) : (
                        <Icon size={14} style={{ color: isActive ? tab.color : "rgba(255,255,255,0.4)" }} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-syne font-bold leading-none truncate"
                        style={{ color: isActive ? tab.color : isDone ? "#22c55e" : "rgba(255,255,255,0.6)" }}
                      >
                        {tab.label}
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5 truncate">{tab.sublabel}</p>
                    </div>

                    {isActive && (
                      <ChevronRight size={12} style={{ color: tab.color }} className="shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Hint card */}
            {!unlocked[2] && (
              <div
                className="mt-auto rounded-2xl p-4"
                style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}
              >
                <p className="text-[10px] font-mono text-amber-400/60 uppercase tracking-widest mb-1">Next Step</p>
                <p className="text-xs text-white/50 leading-relaxed">
                  {session.finalResumeText.trim().length > 50
                    ? "Head to Analyzer — paste a job description to unlock the full pipeline."
                    : "Build your resume or upload a PDF in the Builder to get started."}
                </p>
                <button
                  onClick={() => goTab(session.finalResumeText.trim().length > 50 ? 1 : 0)}
                  className="mt-3 flex items-center gap-1 text-[10px] text-amber-400 font-semibold hover:underline"
                >
                  Go there <ArrowRight size={10} />
                </button>
              </div>
            )}

            {/* Agent online badge */}
            <div
              className="mt-auto rounded-2xl p-4 flex items-center gap-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
            >
              <Sparkles size={14} className="text-baymax-red shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Active Agent</p>
                <p className="text-xs font-syne font-bold text-white">{activeAgent}</p>
                <p className="text-[10px] text-white/30 truncate">{TABS[activeTab].agentTitle}</p>
              </div>
              <div className="ml-auto text-[10px] font-mono text-white/20 uppercase">
                Groq
              </div>
            </div>
          </aside>

          {/* ─── MAIN STAGE ───────────────────────────────────────────────── */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Stage header */}
            <div
              className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-0.5" style={{ color: activeColor + "99" }}>
                  Step {activeTab + 1} of {TABS.length} · {TABS[activeTab].agent}
                </div>
                <h2 className="font-syne font-extrabold text-xl text-white">{TABS[activeTab].label}</h2>
              </div>

              {/* Breadcrumb dots */}
              <div className="flex items-center gap-1.5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => goTab(t.id)}
                    disabled={!unlocked[t.id]}
                    className="transition-all duration-300"
                    title={t.label}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        width: activeTab === t.id ? 24 : 8,
                        height: 8,
                        background: activeTab === t.id
                          ? t.color
                          : done[t.id]
                          ? "#22c55e"
                          : unlocked[t.id]
                          ? "rgba(255,255,255,0.15)"
                          : "rgba(255,255,255,0.05)",
                        boxShadow: activeTab === t.id ? `0 0 8px ${t.color}` : undefined,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Panel content */}
            <div key={activeTab} className="flex-1 overflow-y-auto p-6 md:p-8" style={{ animation: "staggerFadeIn 0.3s ease-out" }}>
              {activeTab === 0 && (
                <ResumeBuilder
                  jobTitle={session.targetJobTitle}
                  onResumeTextChange={handleResumeReady}
                  onProceedToAnalysis={() => goTab(1)}
                />
              )}
              {activeTab === 1 && (
                <ResumeAnalyzer
                  onSwitchTab={goTab}
                  onAnalysisComplete={handleAnalysisDone}
                  builderResumeText={session.finalResumeText}
                  userId={session.userId}
                />
              )}
              {activeTab === 2 && (
                <InterviewCoach
                  onSwitchTab={goTab}
                  jobTitle={session.targetJobTitle}
                  resumeSummary={session.finalResumeText.slice(0, 1500)}
                  userId={session.userId}
                  onInterviewDone={handleInterviewDone}
                />
              )}
              {activeTab === 3 && (
                <JobScout
                  jobTitle={session.targetJobTitle}
                  skillsSummary={session.skillsList.join(", ")}
                  skillsList={session.skillsList}
                  userId={session.userId}
                  onJobSearched={handleJobSearched}
                  onSwitchTab={goTab}
                />
              )}
              {activeTab === 4 && (
                <RoadmapPlanner
                  jobTitle={session.targetJobTitle}
                  skillsGap={session.skillsGap}
                  currentSkills={session.currentSkills}
                  interviewWeakAreas={session.interviewWeakAreas}
                  userId={session.userId}
                  onRoadmapGenerated={handleRoadmapDone}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}
