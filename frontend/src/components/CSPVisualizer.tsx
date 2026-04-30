/**
 * CSPVisualizer.tsx
 * ============================================================================
 * Step-through visualization of the CSP solver running on the backend.
 *
 * Fulfils the CS 2005 "visual representation of algorithm" requirement for
 * Constraint Satisfaction Problems:
 *
 *     ✓ Variables           — task cards on the left
 *     ✓ Domains             — week chips inside each task card; pruned
 *                             values fade and strike through as AC-3 runs
 *     ✓ Constraints         — explicit list with the active constraint
 *                             highlighted during AC-3
 *     ✓ Backtracking        — current variable + value highlighted, conflict
 *                             reasons shown, undo events animate
 *     ✓ Assignments         — final 12-week calendar fills in as the search
 *                             commits to values
 *
 * Implementation notes
 * --------------------
 * The component asks the backend for the full trace once, then steps through
 * it locally. Each trace event already carries a snapshot of `domains` and
 * `assignment`, so rendering at any step is just "look up event[i] and draw
 * what it says." This keeps the visualization deterministic and lets the user
 * scrub forwards / backwards.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw, Loader2,
  AlertCircle, Zap, Brain, CheckCircle2, XCircle,
} from "lucide-react";
import { runCspRoadmap } from "@/lib/api";
import type { CSPResult, CSPTraceEvent, CSPTask } from "@/lib/api";


// ── Static helpers ──────────────────────────────────────────────────────────

/** Pretty colour pulled from the trace event type so the UI looks alive. */
const EVENT_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  init:             { bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.35)", text: "#93c5fd", label: "INIT" },
  unary_prune:      { bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.35)", text: "#a5b4fc", label: "UNARY" },
  unary_dead_end:   { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5", label: "DEAD END" },
  ac3_start:        { bg: "rgba(20,184,166,0.10)", border: "rgba(20,184,166,0.35)", text: "#5eead4", label: "AC-3" },
  ac3_arc:          { bg: "rgba(20,184,166,0.10)", border: "rgba(20,184,166,0.35)", text: "#5eead4", label: "AC-3 ARC" },
  ac3_revised:      { bg: "rgba(34,211,238,0.10)", border: "rgba(34,211,238,0.35)", text: "#67e8f9", label: "AC-3 PRUNE" },
  ac3_done:         { bg: "rgba(20,184,166,0.10)", border: "rgba(20,184,166,0.35)", text: "#5eead4", label: "AC-3 ✓" },
  ac3_dead_end:     { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5", label: "DEAD END" },
  bt_select_var:    { bg: "rgba(234,179,8,0.10)",  border: "rgba(234,179,8,0.35)",  text: "#fde68a", label: "MRV PICK" },
  bt_try_value:     { bg: "rgba(249,115,22,0.10)", border: "rgba(249,115,22,0.35)", text: "#fed7aa", label: "TRY" },
  bt_inconsistent:  { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5", label: "CONFLICT" },
  bt_assign:        { bg: "rgba(34,197,94,0.10)",  border: "rgba(34,197,94,0.35)",  text: "#86efac", label: "ASSIGN" },
  bt_unassign:      { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5", label: "BACKTRACK" },
  bt_dead_end:      { bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.35)",  text: "#fca5a5", label: "BACKTRACK ↑" },
  bt_complete:      { bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.5)",   text: "#86efac", label: "SOLVED" },
  bt_failed:        { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.5)",   text: "#fca5a5", label: "FAILED" },
};

const DEFAULT_STYLE = { bg: "rgba(115,115,115,0.10)", border: "rgba(115,115,115,0.35)", text: "#a3a3a3", label: "STEP" };
const styleFor = (type: string) => EVENT_STYLE[type] ?? DEFAULT_STYLE;


// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  initialSkills?: string[];
  /** Fires every time a solver run completes — lets the parent share the
   *  resulting schedule with sibling tabs (e.g. Track Progress). */
  onSolved?: (result: CSPResult) => void;
}


// ============================================================================
// Component
// ============================================================================

const CSPVisualizer = ({ initialSkills = [], onSolved }: Props) => {
  // ── User-controlled CSP parameters ────────────────────────────────────────
  const [skillsInput, setSkillsInput] = useState(
    initialSkills.length
      ? initialSkills.slice(0, 8).join(", ")
      : "python, dsa, docker, react, system design, machine learning, interview"
  );
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [weeklyBudget, setWeeklyBudget] = useState(15);

  // ── Solver result + playback state ────────────────────────────────────────
  const [result, setResult] = useState<CSPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);  // ms per step
  const playTimer = useRef<number | null>(null);

  // Sync skills coming from upstream agents (resume analyzer) once.
  useEffect(() => {
    if (initialSkills.length > 0) {
      setSkillsInput(initialSkills.slice(0, 8).join(", "));
    }
  }, [initialSkills]);

  // ── Auto-advance when "playing" ───────────────────────────────────────────
  useEffect(() => {
    if (!playing || !result) return;
    if (currentStep >= result.trace.length - 1) {
      setPlaying(false);
      return;
    }
    playTimer.current = window.setTimeout(() => {
      setCurrentStep((s) => Math.min(s + 1, result.trace.length - 1));
    }, speed);
    return () => {
      if (playTimer.current) window.clearTimeout(playTimer.current);
    };
  }, [playing, currentStep, result, speed]);

  // ── Run the solver ────────────────────────────────────────────────────────
  const runSolver = async () => {
    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (skills.length === 0) {
      setError("Add at least one skill so the CSP has variables to schedule.");
      return;
    }
    setLoading(true);
    setError(null);
    setPlaying(false);
    try {
      const res = await runCspRoadmap(skills, totalWeeks, weeklyBudget);
      setResult(res);
      setCurrentStep(0);
      onSolved?.(res);
    } catch (err) {
      setError((err as Error).message || "Failed to run CSP solver");
    } finally {
      setLoading(false);
    }
  };

  // ── Derived state for the active step ─────────────────────────────────────
  const activeEvent: CSPTraceEvent | null = result ? result.trace[currentStep] ?? null : null;
  const activeStyle = activeEvent ? styleFor(activeEvent.type) : DEFAULT_STYLE;

  const tasksById: Record<string, CSPTask> = useMemo(() => {
    if (!result) return {};
    const out: Record<string, CSPTask> = {};
    for (const t of result.tasks) out[t.id] = t;
    return out;
  }, [result]);

  // Derive: what is the latest committed assignment up to currentStep?
  const liveAssignment: Record<string, number> = activeEvent?.assignment ?? {};
  const liveDomains: Record<string, number[]> = activeEvent?.domains ?? {};

  // For highlighting: which variable / arc / value is the active step about?
  const focusedVar = activeEvent?.variable;
  const focusedArc = activeEvent?.arc as [string, string] | undefined;
  const focusedValue = activeEvent?.value;

  // Group assignment by week for the calendar view.
  const calendarByWeek = useMemo(() => {
    const map: Record<number, string[]> = {};
    if (!result) return map;
    for (let w = 1; w <= result.constraints.total_weeks; w++) map[w] = [];
    for (const [id, week] of Object.entries(liveAssignment)) {
      if (!map[week]) map[week] = [];
      map[week].push(id);
    }
    return map;
  }, [liveAssignment, result]);

  // ── Step controls ─────────────────────────────────────────────────────────
  const totalSteps = result?.trace.length ?? 0;
  const stepBack    = () => setCurrentStep((s) => Math.max(0, s - 1));
  const stepForward = () => setCurrentStep((s) => Math.min(totalSteps - 1, s + 1));
  const reset       = () => { setCurrentStep(0); setPlaying(false); };
  const playToggle  = () => {
    if (currentStep >= totalSteps - 1) setCurrentStep(0);
    setPlaying((p) => !p);
  };
  const jumpToEnd   = () => { setCurrentStep(totalSteps - 1); setPlaying(false); };

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ───────── Headline + algorithm explainer ───────── */}
      <div
        className="rounded-xl p-4"
        style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.25)" }}
      >
        <div className="flex items-start gap-3">
          <Brain size={18} className="text-purple-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-syne font-bold text-sm text-foreground">
              Constraint Satisfaction Problem — AC-3 + Backtracking with MRV
            </h4>
            <p className="text-xs text-purple-300/80 mt-1 leading-relaxed">
              The schedule below is built by a classical AI algorithm — not an LLM.
              <span className="block mt-1">
                <strong>Variables:</strong> learning tasks &nbsp;·&nbsp;
                <strong>Domains:</strong> weeks 1–{totalWeeks} &nbsp;·&nbsp;
                <strong>Constraints:</strong> prerequisites, exclusives, weekly-hour budget.
              </span>
              <span className="block mt-1 text-purple-300/60">
                Pipeline: unary node consistency → AC-3 arc consistency → backtracking
                search with MRV, LCV and forward-checking.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ───────── Solver inputs ───────── */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.06)" }}>
        <label className="text-xs font-semibold text-foreground/80">Skill Gaps (comma-separated)</label>
        <input
          type="text"
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
          placeholder="python, dsa, docker, react, system design, machine learning, interview"
          className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:border-baymax-red focus:outline-none transition-colors"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-foreground/80">Total Weeks (4–26)</label>
            <input
              type="number"
              min={4}
              max={26}
              value={totalWeeks}
              onChange={(e) => setTotalWeeks(Math.max(4, Math.min(26, Number(e.target.value) || 12)))}
              className="w-full mt-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-baymax-red focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground/80">Weekly Hour Budget (4–60)</label>
            <input
              type="number"
              min={4}
              max={60}
              value={weeklyBudget}
              onChange={(e) => setWeeklyBudget(Math.max(4, Math.min(60, Number(e.target.value) || 15)))}
              className="w-full mt-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-baymax-red focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={runSolver}
          disabled={loading}
          className="w-full bg-baymax-red text-foreground font-syne font-bold px-5 py-2.5 rounded-lg btn-red-glow transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> Solving CSP...</>
          ) : (
            <><Zap size={14} /> Run CSP Solver</>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={14} />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}
      </div>

      {/* ───────── Visualization (only after a solve) ───────── */}
      {result && (
        <>
          {/* Stats bar + outcome banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="AC-3 Arc Checks"  value={result.stats.ac3_arc_checks} />
            <StatCard label="Values Pruned"    value={result.stats.ac3_values_pruned} />
            <StatCard label="Assignments"      value={result.stats.bt_assignments} />
            <StatCard label="Backtracks"       value={result.stats.bt_backtracks} />
          </div>

          <div
            className="flex items-center gap-2 p-3 rounded-lg text-xs"
            style={{
              background: result.success ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${result.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              color: result.success ? "#86efac" : "#fca5a5",
            }}
          >
            {result.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            <span className="font-semibold">
              {result.success
                ? `Solver found a complete assignment for ${result.tasks.length} task(s) across ${result.constraints.total_weeks} weeks.`
                : `Solver could not find a feasible schedule (${result.reason}). Try widening the budget or weeks.`}
            </span>
          </div>

          {/* Step controls */}
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl" style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={reset}        className="ctrl-btn"><RotateCcw size={14} /></button>
            <button onClick={stepBack}     className="ctrl-btn"><SkipBack size={14} /></button>
            <button onClick={playToggle}   className="ctrl-btn-primary">
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={stepForward}  className="ctrl-btn"><SkipForward size={14} /></button>
            <button onClick={jumpToEnd}    className="ctrl-btn text-[10px] px-2 font-semibold">END</button>

            <div className="flex-1 min-w-[120px] h-1.5 bg-secondary rounded-full overflow-hidden mx-2">
              <div
                className="h-full bg-baymax-red transition-all"
                style={{ width: `${totalSteps > 1 ? ((currentStep + 1) / totalSteps) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
              step {currentStep + 1} / {totalSteps}
            </span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="bg-secondary border border-border rounded px-2 py-1 text-[10px] text-foreground"
            >
              <option value={1500}>0.5×</option>
              <option value={700}>1×</option>
              <option value={350}>2×</option>
              <option value={150}>4×</option>
            </select>
          </div>

          {/* Current event banner */}
          {activeEvent && (
            <div
              className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: activeStyle.bg, border: `1px solid ${activeStyle.border}` }}
            >
              <span
                className="font-mono text-[10px] font-bold px-2 py-1 rounded shrink-0"
                style={{ background: activeStyle.border, color: activeStyle.text }}
              >
                {activeStyle.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-relaxed" style={{ color: activeStyle.text }}>
                  {activeEvent.description}
                </p>
                {activeEvent.reason && (
                  <p className="text-[11px] text-red-300/80 mt-1">↳ {activeEvent.reason}</p>
                )}
              </div>
            </div>
          )}

          {/* Main grid: Variables · Constraints · Calendar */}
          <div className="grid lg:grid-cols-3 gap-4">

            {/* ── Variables panel ── */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h4 className="font-syne font-bold text-xs text-foreground mb-2">
                Variables &amp; Domains <span className="text-muted-foreground font-normal">(weeks each task can take)</span>
              </h4>
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {result.tasks.map((t) => (
                  <VariableCard
                    key={t.id}
                    task={t}
                    domain={liveDomains[t.id] ?? []}
                    fullRange={result.constraints.total_weeks}
                    assigned={liveAssignment[t.id]}
                    isFocused={focusedVar === t.id || (focusedArc && (focusedArc[0] === t.id || focusedArc[1] === t.id))}
                    triedValue={focusedVar === t.id ? focusedValue : undefined}
                    eventType={activeEvent?.type ?? ""}
                  />
                ))}
              </div>
            </div>

            {/* ── Constraints panel ── */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h4 className="font-syne font-bold text-xs text-foreground mb-2">
                Constraints <span className="text-muted-foreground font-normal">({result.constraints.prerequisites.length + result.constraints.exclusives.length} binary + 1 global)</span>
              </h4>
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {result.constraints.prerequisites.map(([a, b], i) => (
                  <ConstraintRow
                    key={`p${i}`}
                    label={`${tasksById[a]?.label ?? a} → ${tasksById[b]?.label ?? b}`}
                    detail="prerequisite (week A < week B)"
                    isFocused={!!focusedArc && ((focusedArc[0] === a && focusedArc[1] === b) || (focusedArc[0] === b && focusedArc[1] === a))}
                    color="rgba(99,102,241,0.4)"
                  />
                ))}
                {result.constraints.exclusives.map(([a, b], i) => (
                  <ConstraintRow
                    key={`e${i}`}
                    label={`${tasksById[a]?.label ?? a} ⊥ ${tasksById[b]?.label ?? b}`}
                    detail="exclusive (different weeks)"
                    isFocused={!!focusedArc && ((focusedArc[0] === a && focusedArc[1] === b) || (focusedArc[0] === b && focusedArc[1] === a))}
                    color="rgba(20,184,166,0.4)"
                  />
                ))}
                <ConstraintRow
                  label={`Weekly hours ≤ ${result.constraints.weekly_hour_budget}h`}
                  detail="global workload constraint"
                  color="rgba(234,179,8,0.4)"
                />
              </div>
            </div>

            {/* ── Calendar panel ── */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h4 className="font-syne font-bold text-xs text-foreground mb-2">
                Schedule <span className="text-muted-foreground font-normal">(assignments commit here as the search progresses)</span>
              </h4>
              <div className="space-y-1.5 max-h-[440px] overflow-y-auto pr-1">
                {Array.from({ length: result.constraints.total_weeks }, (_, i) => i + 1).map((w) => {
                  const ids = calendarByWeek[w] ?? [];
                  const hours = ids.reduce((a, id) => a + (tasksById[id]?.hours ?? 0), 0);
                  const pct = (hours / result.constraints.weekly_hour_budget) * 100;
                  return (
                    <div
                      key={w}
                      className="rounded-lg p-2"
                      style={{
                        background: ids.length > 0 ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.02)",
                        border: ids.length > 0 ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-muted-foreground">Week {w}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{hours}h / {result.constraints.weekly_hour_budget}h</span>
                      </div>
                      {ids.length > 0 && (
                        <>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {ids.map((id) => (
                              <span
                                key={id}
                                className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{
                                  background: "rgba(34,197,94,0.15)",
                                  color: "#86efac",
                                  border: "1px solid rgba(34,197,94,0.3)",
                                }}
                              >
                                {tasksById[id]?.label ?? id}
                              </span>
                            ))}
                          </div>
                          <div className="h-1 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                background: pct > 100 ? "#ef4444" : pct > 80 ? "#f59e0b" : "#22c55e",
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Algorithm legend */}
          <details className="rounded-xl text-xs" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.04)" }}>
            <summary className="px-4 py-3 cursor-pointer text-foreground font-semibold">
              How the algorithm works
            </summary>
            <div className="px-4 pb-4 text-muted-foreground space-y-2 leading-relaxed">
              <p>
                <strong className="text-foreground">1. Node consistency.</strong> Each task has unary
                constraints: an earliest-week (foundations come first, advanced topics later) and an
                optional deadline. Values violating these are pruned before AC-3 even starts.
              </p>
              <p>
                <strong className="text-foreground">2. AC-3.</strong> Every binary constraint becomes
                two directed arcs in a queue. Each arc <code>(X<sub>i</sub>, X<sub>j</sub>)</code> is
                checked: any value in <code>D(X<sub>i</sub>)</code> with no supporting partner in
                <code> D(X<sub>j</sub>)</code> is removed. When a domain shrinks, every arc pointing back
                into <code>X<sub>i</sub></code> is re-enqueued. Loop terminates when arc-consistent or a
                domain wipes out.
              </p>
              <p>
                <strong className="text-foreground">3. Backtracking.</strong> Pick the next variable
                with the <em>Minimum Remaining Values</em> (smallest domain) — this fails fast when the
                problem is over-constrained. Order its values by <em>Least Constraining Value</em>.
                Forward-check after each assignment so future variables shrink immediately. On
                conflict, undo the assignment and try the next value; if none work, backtrack
                further up the tree.
              </p>
              <p>
                <strong className="text-foreground">4. Workload.</strong> The weekly-hour budget is an
                <em> n</em>-ary global constraint, so it is checked on every assignment rather than
                via AC-3.
              </p>
            </div>
          </details>
        </>
      )}

      {/* shared CSS for the control buttons (uses tailwind via className concat) */}
      <style>{`
        .ctrl-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: #d4d4d4; transition: all 150ms ease;
        }
        .ctrl-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .ctrl-btn-primary {
          display: inline-flex; align-items: center; justify-content: center;
          width: 36px; height: 32px; border-radius: 8px;
          background: #E8272B; color: #fff; border: 1px solid #E8272B;
          transition: all 150ms ease;
        }
        .ctrl-btn-primary:hover { box-shadow: 0 0 0 1px #E8272B, 0 0 12px rgba(232,39,43,0.4); }
      `}</style>
    </div>
  );
};


// ============================================================================
// Subcomponents
// ============================================================================

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="font-mono text-xl font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}


/** A single variable card — task label, hours, current domain as week chips. */
function VariableCard({
  task, domain, fullRange, assigned, isFocused, triedValue, eventType,
}: {
  task: CSPTask;
  domain: number[];
  fullRange: number;
  assigned?: number;
  isFocused?: boolean;
  triedValue?: number;
  eventType: string;
}) {
  const inDomain = new Set(domain);
  const allWeeks = Array.from({ length: fullRange }, (_, i) => i + 1);

  // Which event is active right now affects per-week styling
  const isAssigning = eventType === "bt_assign";
  const isTrying    = eventType === "bt_try_value";
  const isConflict  = eventType === "bt_inconsistent";

  return (
    <div
      className="rounded-lg p-2.5 transition-all"
      style={{
        background: isFocused ? "rgba(232,39,43,0.06)" : "rgba(255,255,255,0.02)",
        border: isFocused ? "1px solid rgba(232,39,43,0.4)" : "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{task.label}</p>
          <p className="text-[10px] text-muted-foreground">
            {task.hours}h/wk · {task.category}
          </p>
        </div>
        {assigned !== undefined && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
            style={{ background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.4)" }}
          >
            W{assigned}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {allWeeks.map((w) => {
          const isInDomain = inDomain.has(w);
          const isAssigned = assigned === w;
          const isTried = triedValue === w && isFocused;

          let style: React.CSSProperties;
          if (isAssigned) {
            style = { background: "rgba(34,197,94,0.25)", color: "#86efac", border: "1px solid #22c55e" };
          } else if (isTried && isAssigning) {
            style = { background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.5)" };
          } else if (isTried && isConflict) {
            style = { background: "rgba(239,68,68,0.18)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.6)" };
          } else if (isTried && isTrying) {
            style = { background: "rgba(249,115,22,0.18)", color: "#fed7aa", border: "1px solid rgba(249,115,22,0.6)" };
          } else if (isInDomain) {
            style = { background: "rgba(255,255,255,0.04)", color: "#d4d4d4", border: "1px solid rgba(255,255,255,0.08)" };
          } else {
            style = { background: "transparent", color: "#52525b", border: "1px solid rgba(255,255,255,0.04)", textDecoration: "line-through" };
          }

          return (
            <span
              key={w}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded transition-all"
              style={style}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
}


/** A single constraint row in the constraints panel. */
function ConstraintRow({
  label, detail, isFocused, color,
}: { label: string; detail: string; isFocused?: boolean; color: string }) {
  return (
    <div
      className="rounded-lg p-2 transition-all"
      style={{
        background: isFocused ? "rgba(232,39,43,0.06)" : "rgba(255,255,255,0.02)",
        border: isFocused
          ? "1px solid rgba(232,39,43,0.5)"
          : `1px solid ${color}`,
      }}
    >
      <p className="text-[11px] text-foreground/90 leading-tight">{label}</p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{detail}</p>
    </div>
  );
}


export default CSPVisualizer;
