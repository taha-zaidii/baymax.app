/**
 * RoadmapPlanner.tsx
 * ============================================================================
 * Four tabs:
 *
 *   🧠 CSP Algorithm  — animated solver (graded AI-Lab deliverable)
 *   ✅ Track Progress — interactive week-by-week checklist driven by the
 *                        solution the CSP just produced; checkbox state is
 *                        persisted to localStorage so refreshing keeps it
 *   📋 Plan Summary   — LLM-generated, plain-English version of the plan
 *   📚 Resources      — curated free-first learning resources for skill gaps
 *
 * The CSP visualizer fires `onSolved(result)` whenever the user runs the
 * solver, so this component owns the canonical schedule and can drive the
 * progress UI without re-fetching.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, BookOpen, Brain, CheckCircle2, ExternalLink,
  ListChecks, Loader2, RotateCcw,
} from "lucide-react";
import { generateRoadmapFull, getCertifications } from "@/lib/api";
import type { Certification, CSPResult } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import CSPVisualizer from "./CSPVisualizer";


// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  jobTitle?: string;
  skillsGap?: string[];
  currentSkills?: string[];
  interviewWeakAreas?: string;
  userId?: string;
  onRoadmapGenerated?: () => void;
}

type PanelTab = "csp" | "progress" | "summary" | "resources";


// ─────────────────────────────────────────────────────────────────────────────
// Free-first ordering for learning resources
// ─────────────────────────────────────────────────────────────────────────────

function freeFirstRank(c: Certification): number {
  const cost = (c.cost || "").toLowerCase();
  if (cost.includes("free") && !cost.includes("aid")) return 0;
  if (cost.includes("aid") || cost.includes("financial")) return 1;
  return 2;
}


// ─────────────────────────────────────────────────────────────────────────────
// Markdown subset renderer for the LLM plan
// ─────────────────────────────────────────────────────────────────────────────

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm text-foreground leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## "))
          return <h2 key={i} className="text-base font-bold text-foreground mt-4 mb-1">{line.replace("## ", "")}</h2>;
        if (line.startsWith("### "))
          return <h3 key={i} className="text-sm font-bold text-foreground/90 mt-3 mb-1">{line.replace("### ", "")}</h3>;
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-semibold text-foreground/80 text-xs mt-2">{line.replace(/\*\*/g, "")}</p>;
        if (line.match(/^- \[ \]/))
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <div className="mt-0.5 w-3.5 h-3.5 rounded border border-border shrink-0" />
              <span className="text-foreground/80 text-xs">{line.replace(/^- \[ \] ?/, "")}</span>
            </div>
          );
        if (line.match(/^- \[x\]/i))
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <div className="mt-0.5 w-3.5 h-3.5 rounded border border-green-500 bg-green-500/20 shrink-0 flex items-center justify-center">
                <span className="text-green-400 text-[8px]">✓</span>
              </div>
              <span className="text-foreground/60 text-xs line-through">{line.replace(/^- \[x\] ?/i, "")}</span>
            </div>
          );
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-baymax-red mt-1 text-[8px] shrink-0">●</span>
              <span className="text-foreground/80 text-xs">{line.replace(/^[*-] /, "")}</span>
            </div>
          );
        if (line.startsWith("---")) return <hr key={i} className="border-border my-3" />;
        if (line.startsWith("> "))
          return (
            <blockquote key={i} className="ml-2 pl-3 border-l-2 border-amber-500/40 text-amber-400/80 text-xs italic">
              {line.replace(/^> /, "")}
            </blockquote>
          );
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} className="text-foreground/80 text-xs">{line}</p>;
      })}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Resource card
// ─────────────────────────────────────────────────────────────────────────────

function ResourceCard({ c }: { c: Certification }) {
  const platformColors: Record<string, string> = {
    YouTube: "#ef4444", Coursera: "#0056d2", Kaggle: "#20beff", "fast.ai": "#ff5733",
    Google: "#4285f4", freeCodeCamp: "#0a0a23", LeetCode: "#ffa116", NeetCode: "#3b82f6",
    GitHub: "#6e7681",
  };
  const color = platformColors[c.issuer] || "#6b7280";
  const isFree = (c.cost || "").toLowerCase().includes("free") && !(c.cost || "").toLowerCase().includes("aid");
  const hasAid = (c.cost || "").toLowerCase().includes("aid");

  return (
    <a
      href={c.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-xl p-3 transition-all hover:scale-[1.01] group"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
        style={{ background: color + "30", border: `1px solid ${color}40`, color }}
      >
        {c.issuer.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground text-xs font-semibold leading-tight line-clamp-2 group-hover:text-baymax-red transition-colors">
          {c.name}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{c.duration}</span>
          {isFree && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: "#0d2818", color: "#4ade80", border: "1px solid #166534" }}
            >
              🆓 Free
            </span>
          )}
          {hasAid && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: "#1e1b4b", color: "#a5b4fc", border: "1px solid #3730a3" }}
            >
              💳 Free w/ Aid
            </span>
          )}
          {!isFree && !hasAid && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: "#1f1f1f", color: "#a3a3a3", border: "1px solid #2a2a2a" }}
            >
              💰 Paid
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">— {c.addresses}</span>
        </div>
      </div>
      <ExternalLink size={12} className="text-muted-foreground shrink-0 mt-0.5 group-hover:text-baymax-red" />
    </a>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Progress tracker — driven by the CSP result
// ─────────────────────────────────────────────────────────────────────────────

function progressKey(userId: string, jobTitle: string) {
  return `baymax-progress-${userId}-${jobTitle.toLowerCase().replace(/\s+/g, "-")}`;
}

function ProgressTracker({
  result,
  userId,
  jobTitle,
}: {
  result: CSPResult | null;
  userId: string;
  jobTitle: string;
}) {
  // Persistent tick state — keyed per (user, job title) so different role
  // searches don't share progress.
  const [done, setDone] = useState<Set<string>>(() => {
    if (!result) return new Set();
    try {
      const raw = localStorage.getItem(progressKey(userId, jobTitle));
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  // Re-load saved state when the user/jobTitle key changes (e.g. solving for a
  // different role).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(progressKey(userId, jobTitle));
      setDone(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setDone(new Set()); }
  }, [userId, jobTitle]);

  // Persist on every change.
  useEffect(() => {
    try { localStorage.setItem(progressKey(userId, jobTitle), JSON.stringify([...done])); }
    catch { /* ignore quota */ }
  }, [done, userId, jobTitle]);

  const tasksByWeek = useMemo(() => {
    const byWeek: Record<number, Array<{ id: string; label: string; hours: number; category: string }>> = {};
    if (!result?.success) return byWeek;
    for (const t of result.tasks) {
      const w = result.assignment[t.id];
      if (!w) continue;
      (byWeek[w] = byWeek[w] ?? []).push({ id: t.id, label: t.label, hours: t.hours, category: t.category });
    }
    return byWeek;
  }, [result]);

  if (!result) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <ListChecks size={36} className="mx-auto text-muted-foreground/50 mb-3" />
        <p className="mb-3">No plan to track yet — run the CSP solver in the previous tab first.</p>
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <AlertCircle size={36} className="mx-auto text-amber-500/60 mb-3" />
        <p className="mb-3">The last solver run did not produce a feasible schedule (<code className="text-amber-400/80 text-xs">{result.reason}</code>).</p>
        <p className="text-xs text-muted-foreground/70">Widen the planning horizon or weekly budget in the CSP Algorithm tab and try again.</p>
      </div>
    );
  }

  const totalTasks = result.tasks.length;
  const completed = result.tasks.filter(t => done.has(t.id)).length;
  const pct = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;
  const totalWeeks = result.constraints.total_weeks;
  const budget = result.constraints.weekly_hour_budget;

  const toggle = (id: string) => {
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const reset = () => setDone(new Set());

  // ── Category palette (matches the typeColors of the old static checklist
  //    so visual identity is preserved). ───────────────────────────────────
  const categoryStyle: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    skill:       { bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.25)",  text: "#93c5fd", icon: "🎯" },
    project:     { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.25)",   text: "#86efac", icon: "🛠️" },
    application: { bg: "rgba(229,62,62,0.08)",   border: "rgba(229,62,62,0.3)",    text: "#fca5a5", icon: "📨" },
  };

  return (
    <div className="space-y-4">
      {/* Top: progress bar + reset */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Plan progress</span>
            <span className="text-xs font-mono text-foreground/80">
              {completed} / {totalTasks} ·
              <span className="ml-1 font-bold" style={{ color: pct >= 80 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#e53e3e" }}>
                {pct}%
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct >= 80 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#e53e3e",
                boxShadow: "0 0 8px currentColor",
              }}
            />
          </div>
        </div>
        <button
          onClick={reset}
          disabled={completed === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#d4d4d4",
          }}
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      {/* Week-by-week list */}
      <div className="grid sm:grid-cols-2 gap-3">
        {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => {
          const tasks = tasksByWeek[w] ?? [];
          const weekHours = tasks.reduce((a, t) => a + t.hours, 0);
          const weekDone = tasks.every(t => done.has(t.id)) && tasks.length > 0;
          return (
            <div
              key={w}
              className="rounded-xl p-4 transition-all"
              style={{
                background: tasks.length > 0
                  ? (weekDone ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)")
                  : "rgba(255,255,255,0.01)",
                border: weekDone
                  ? "1px solid rgba(34,197,94,0.3)"
                  : tasks.length > 0
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{
                      background: weekDone ? "rgba(34,197,94,0.15)" : "rgba(229,62,62,0.10)",
                      color:      weekDone ? "#86efac" : "#fca5a5",
                      border:     `1px solid ${weekDone ? "rgba(34,197,94,0.3)" : "rgba(229,62,62,0.3)"}`,
                    }}
                  >
                    Week {w}
                  </span>
                  {weekDone && <CheckCircle2 size={14} className="text-green-400" />}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {weekHours}h / {budget}h
                </span>
              </div>

              {tasks.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/50 italic">— no tasks scheduled —</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => {
                    const isDone = done.has(t.id);
                    const style = categoryStyle[t.category] ?? categoryStyle.skill;
                    return (
                      <label
                        key={t.id}
                        className="flex items-start gap-2.5 cursor-pointer group"
                      >
                        <button
                          type="button"
                          onClick={() => toggle(t.id)}
                          className="mt-0.5 w-4 h-4 rounded shrink-0 flex items-center justify-center transition-all"
                          style={{
                            background: isDone ? "rgba(34,197,94,0.20)" : "transparent",
                            border: isDone ? "1.5px solid #22c55e" : "1.5px solid rgba(255,255,255,0.2)",
                          }}
                          aria-pressed={isDone}
                        >
                          {isDone && <CheckCircle2 size={11} className="text-green-400" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span
                            className={`text-xs leading-snug transition-all ${
                              isDone ? "line-through text-muted-foreground/60" : "text-foreground/85"
                            }`}
                          >
                            {t.label}
                          </span>
                          <span
                            className="ml-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{
                              background: style.bg,
                              border: `1px solid ${style.border}`,
                              color: style.text,
                            }}
                          >
                            {style.icon} {t.category} · {t.hours}h
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// Main component
// ═════════════════════════════════════════════════════════════════════════════

const RoadmapPlanner = ({
  jobTitle: initialJobTitle = "",
  skillsGap = [],
  currentSkills = [],
  interviewWeakAreas = "",
  userId = "default",
  onRoadmapGenerated,
}: Props) => {
  const { toast } = useToast();
  const [jobTitle, setJobTitle] = useState(initialJobTitle || "Software Engineer");
  const [activeTab, setActiveTab] = useState<PanelTab>("csp");

  // Most recent CSP solution — populated by CSPVisualizer's onSolved callback.
  const [cspResult, setCspResult] = useState<CSPResult | null>(null);

  // Plan summary (LLM markdown) state
  const [planMarkdown, setPlanMarkdown] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Resources state
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);

  useEffect(() => {
    if (initialJobTitle) setJobTitle(initialJobTitle);
  }, [initialJobTitle]);

  const handleCspSolved = (res: CSPResult) => {
    setCspResult(res);
    if (res.success) onRoadmapGenerated?.();
  };

  // Generate plan summary + fetch resources in parallel
  const generatePlanSummary = async () => {
    if (!jobTitle.trim()) {
      toast({ title: "Job title required", description: "Enter your target role first.", variant: "destructive" });
      return;
    }
    setPlanLoading(true);
    setPlanError(null);
    setCertsLoading(true);
    try {
      const [planResult, certResult] = await Promise.allSettled([
        generateRoadmapFull(jobTitle, skillsGap.join(", "), currentSkills.join(", "), interviewWeakAreas),
        getCertifications(jobTitle, skillsGap, currentSkills),
      ]);

      if (planResult.status === "fulfilled") {
        setPlanMarkdown(planResult.value.roadmap);
        onRoadmapGenerated?.();
      } else {
        setPlanError((planResult.reason as Error)?.message || "Failed to generate plan");
      }

      if (certResult.status === "fulfilled") {
        const sorted = [...certResult.value.certifications].sort(
          (a, b) => freeFirstRank(a) - freeFirstRank(b),
        );
        setCertifications(sorted);
      }
    } finally {
      setPlanLoading(false);
      setCertsLoading(false);
    }
  };

  // Tab definitions — Track Progress shows a small badge with completion count
  // when there's a CSP solution to track.
  const progressBadge = cspResult?.success
    ? `${cspResult.tasks.length}`
    : undefined;

  const tabs: Array<{ id: PanelTab; label: string; Icon: typeof Brain; badge?: string }> = [
    { id: "csp",       label: "CSP Algorithm",  Icon: Brain },
    { id: "progress",  label: "Track Progress", Icon: CheckCircle2, badge: progressBadge },
    { id: "summary",   label: "Plan Summary",   Icon: ListChecks },
    { id: "resources", label: "Resources",      Icon: BookOpen },
  ];

  return (
    <div className="space-y-5">
      {/* Context banner */}
      {(skillsGap.length > 0 || interviewWeakAreas) && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}
        >
          <span className="text-purple-400 text-base shrink-0">🎯</span>
          <div className="flex-1 min-w-0">
            <p className="text-purple-300 font-semibold text-xs mb-1">
              Personalised plan — built from your resume &amp; interview data
            </p>
            {skillsGap.length > 0 && (
              <p className="text-purple-400/80 text-xs">
                <span className="font-semibold">Skill gaps: </span>
                {skillsGap.slice(0, 6).join(" · ")}
                {skillsGap.length > 6 && ` +${skillsGap.length - 6} more`}
              </p>
            )}
            {interviewWeakAreas && (
              <p className="text-purple-400/80 text-xs mt-0.5">
                <span className="font-semibold">Interview weak areas: </span>
                {interviewWeakAreas}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Job title input + Plan-summary action */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. ML Engineer"
          className="bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:border-baymax-red focus:outline-none transition-colors flex-1 min-w-[200px]"
        />
        <button
          onClick={generatePlanSummary}
          disabled={planLoading || certsLoading}
          className="bg-baymax-red text-foreground font-syne font-bold px-5 py-2.5 rounded-lg btn-red-glow transition-all disabled:opacity-50 text-sm flex items-center gap-2"
        >
          {planLoading ? (
            <><Loader2 size={14} className="animate-spin" /> Generating…</>
          ) : "📋 Generate Plan Summary"}
        </button>
      </div>

      {planError && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
          <p className="text-sm text-red-300">{planError}</p>
        </div>
      )}

      {/* Tabbed panels */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0a0a0a" }}>
          {tabs.map(({ id, label, Icon, badge }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all ${
                activeTab === id
                  ? "text-foreground border-b-2 border-baymax-red"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
              {badge && (
                <span className="bg-baymax-red text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5" style={{ background: "#0c0c0c" }}>
          {activeTab === "csp" && (
            <CSPVisualizer initialSkills={skillsGap} onSolved={handleCspSolved} />
          )}

          {activeTab === "progress" && (
            <ProgressTracker result={cspResult} userId={userId} jobTitle={jobTitle} />
          )}

          {activeTab === "summary" && (
            planMarkdown ? (
              <div>
                <h4 className="font-syne font-bold text-base text-foreground mb-4">
                  📋 Plan Summary — {jobTitle}
                </h4>
                <MarkdownBlock text={planMarkdown} />
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <ListChecks size={36} className="mx-auto text-muted-foreground/50 mb-3" />
                <p className="mb-3">No plan summary yet — click <strong>Generate Plan Summary</strong> above.</p>
                <p className="text-xs text-muted-foreground/70">
                  The summary is a plain-English companion to the schedule
                  produced by the CSP solver.
                </p>
              </div>
            )
          )}

          {activeTab === "resources" && (
            <div className="space-y-3">
              {certsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 size={14} className="animate-spin" />
                  Finding free-first resources for your skill gaps...
                </div>
              ) : certifications.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-syne font-bold text-sm text-foreground">
                      🎓 Learning Resources
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      sorted free → aid → paid
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Curated for the skills the CSP solver flagged. Every link is verified — no hallucinated URLs.
                  </p>
                  <div className="grid gap-2 mt-3">
                    {certifications.map((cert, i) => (
                      <ResourceCard key={i} c={cert} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <BookOpen size={36} className="mx-auto text-muted-foreground/50 mb-3" />
                  <p className="mb-3">No resources loaded yet.</p>
                  <p className="text-xs text-muted-foreground/70">
                    Click <strong>Generate Plan Summary</strong> above to also fetch
                    free learning resources mapped to your skill gaps.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoadmapPlanner;
