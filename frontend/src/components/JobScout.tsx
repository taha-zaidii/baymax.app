/**
 * JobScout.tsx — Visual job-listings panel.
 *
 * Backend now returns a deterministic, structured list of JobItem objects
 * (see find_jobs() in agents/job_search_agent.py). This component renders
 * those as proper interactive cards with:
 *
 *   - per-card match-percentage ring
 *   - skill-overlap chips
 *   - location / level / source badges
 *   - bookmark → persists to localStorage per user_id
 *   - apply button → opens the exact source URL
 *   - sort by match / level / source, plus "Saved only" toggle
 *   - top-of-list summary (raw hits → kept after spam → shown), top skill gap,
 *     application tip
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowRight, Bookmark, BookmarkCheck, Briefcase,
  CheckCircle2, ExternalLink, Loader2, MapPin, Search, Sparkles, X,
} from "lucide-react";

import { searchJobsWithSkills } from "@/lib/api";
import type { JobItem, JobsResponse } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";


// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  jobTitle?: string;
  skillsSummary?: string;
  skillsList?: string[];
  userId?: string;
  onJobSearched?: (jobTitle: string) => void;
  onSwitchTab?: (tab: number) => void;
}


// ─────────────────────────────────────────────────────────────────────────────
// Lightweight visual helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Stable colour for a company badge based on its name. */
function badgeColor(seed: string): { bg: string; text: string; border: string } {
  const palette = [
    { bg: "rgba(59,130,246,0.12)",  text: "#93c5fd", border: "rgba(59,130,246,0.35)" },
    { bg: "rgba(34,197,94,0.12)",   text: "#86efac", border: "rgba(34,197,94,0.35)" },
    { bg: "rgba(168,85,247,0.12)",  text: "#d8b4fe", border: "rgba(168,85,247,0.35)" },
    { bg: "rgba(249,115,22,0.12)",  text: "#fed7aa", border: "rgba(249,115,22,0.35)" },
    { bg: "rgba(236,72,153,0.12)",  text: "#f9a8d4", border: "rgba(236,72,153,0.35)" },
    { bg: "rgba(20,184,166,0.12)",  text: "#5eead4", border: "rgba(20,184,166,0.35)" },
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

/** Initials for the company avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Match colour (green ≥75, amber 40-74, red <40). */
function matchColor(pct: number): string {
  if (pct >= 75) return "#22c55e";
  if (pct >= 40) return "#f59e0b";
  return "#ef4444";
}


// ─────────────────────────────────────────────────────────────────────────────
// Match ring — small circular progress indicator (SVG)
// ─────────────────────────────────────────────────────────────────────────────

function MatchRing({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  const color = matchColor(pct);
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="4" fill="none" />
        <circle
          cx="24" cy="24" r={r}
          stroke={color} strokeWidth="4" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold font-mono" style={{ color }}>
        {pct}%
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Job card
// ─────────────────────────────────────────────────────────────────────────────

function JobCard({
  job,
  saved,
  onToggleSave,
  candidateSkills,
}: {
  job: JobItem;
  saved: boolean;
  onToggleSave: () => void;
  candidateSkills: string[];
}) {
  const c = badgeColor(job.company);
  const isRemote = job.location.toLowerCase().includes("remote");
  const lowerSkills = useMemo(() => new Set(candidateSkills.map(s => s.toLowerCase())), [candidateSkills]);

  return (
    <div
      className="rounded-2xl p-5 transition-all hover:scale-[1.005] group"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
        >
          {initials(job.company)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-syne font-bold text-foreground truncate">{job.role}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground/80">{job.company}</span>
                <span className="text-muted-foreground/60"> · {job.source}</span>
              </p>
            </div>
            <MatchRing pct={job.match_pct} />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: isRemote ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                color:      isRemote ? "#86efac" : "#a3a3a3",
                border:     `1px solid ${isRemote ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <MapPin size={10} />
              {job.location}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(229,62,62,0.08)",
                color: "#fca5a5",
                border: "1px solid rgba(229,62,62,0.25)",
              }}
            >
              <Briefcase size={10} />
              {job.level}
            </span>
            {job.salary && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(234,179,8,0.08)",
                  color: "#fcd34d",
                  border: "1px solid rgba(234,179,8,0.25)",
                }}
              >
                💰 {job.salary}
              </span>
            )}
          </div>

          {/* Snippet */}
          <p className="text-xs text-foreground/70 mt-3 line-clamp-2 leading-relaxed">
            {job.snippet || "No description provided in the listing."}
          </p>

          {/* Skill overlap chips */}
          {job.skills_matched.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mr-1 font-mono">
                Skills match:
              </span>
              {job.skills_matched.map((s) => {
                const isYour = lowerSkills.has(s.toLowerCase());
                return (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                    style={{
                      background: isYour ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                      color: isYour ? "#86efac" : "#d4d4d4",
                      border: `1px solid ${isYour ? "rgba(34,197,94,0.30)" : "rgba(255,255,255,0.10)"}`,
                    }}
                  >
                    {isYour && <CheckCircle2 size={9} />}
                    {s}
                  </span>
                );
              })}
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-2 mt-4">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #e53e3e, #c53030)",
                boxShadow: "0 2px 12px rgba(229,62,62,0.25)",
              }}
            >
              Apply on {job.source} <ExternalLink size={11} />
            </a>
            <button
              onClick={onToggleSave}
              title={saved ? "Remove from saved" : "Save for later"}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: saved ? "rgba(234,179,8,0.10)" : "rgba(255,255,255,0.03)",
                color: saved ? "#fcd34d" : "#a3a3a3",
                border: `1px solid ${saved ? "rgba(234,179,8,0.4)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type SortKey = "match" | "level" | "source";

const LEVEL_ORDER: Record<string, number> = {
  "Internship": 0, "Trainee": 1, "Graduate": 2, "Entry Level": 3,
  "Associate": 4, "Junior": 5,
};

const JobScout = ({
  jobTitle: initialJobTitle = "",
  skillsSummary = "",
  skillsList = [],
  userId = "default",
  onJobSearched,
  onSwitchTab,
}: Props) => {
  const { toast } = useToast();
  const [jobTitle, setJobTitle] = useState(initialJobTitle || "Software Engineer");
  const [response, setResponse] = useState<JobsResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [sortBy, setSortBy]         = useState<SortKey>("match");
  const [savedOnly, setSavedOnly]   = useState(false);
  const [savedIds, setSavedIds]     = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`baymax-saved-jobs-${userId}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  // Persist saves
  useEffect(() => {
    try { localStorage.setItem(`baymax-saved-jobs-${userId}`, JSON.stringify([...savedIds])); }
    catch { /* ignore quota */ }
  }, [savedIds, userId]);

  // Auto-search once we have a job title + skills (e.g. coming from Analyzer)
  useEffect(() => {
    if (initialJobTitle && skillsList.length > 0 && !response) {
      handleSearch(initialJobTitle, skillsList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobTitle]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSearch = async (titleOverride?: string, skillsOverride?: string[]) => {
    const title = titleOverride ?? jobTitle;
    const skills = skillsOverride ?? skillsList;
    if (!title.trim()) {
      toast({ title: "Job title required", description: "Enter a role to search for.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await searchJobsWithSkills(title, skillsSummary, skills, userId);
      setResponse(result);
      onJobSearched?.(title);
    } catch (err) {
      setError((err as Error).message);
      toast({ title: "Job search failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = (id: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Sorted / filtered list ─────────────────────────────────────────────────
  const visibleJobs = useMemo(() => {
    const base = response?.jobs ?? [];
    const filtered = savedOnly ? base.filter(j => savedIds.has(j.id)) : base;
    const sorted = [...filtered];
    if (sortBy === "match") {
      sorted.sort((a, b) => b.match_pct - a.match_pct);
    } else if (sortBy === "level") {
      sorted.sort((a, b) => (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99));
    } else {
      sorted.sort((a, b) => a.source.localeCompare(b.source));
    }
    return sorted;
  }, [response, savedOnly, savedIds, sortBy]);

  const meta = response?.query_meta;
  const savedCount = savedIds.size;
  const visibleCount = visibleJobs.length;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* Personalisation banner */}
      {skillsList.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)" }}
        >
          <Sparkles size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-blue-300 font-semibold text-xs mb-1">
              Personalised search · ranked by skill overlap with your resume
            </p>
            <p className="text-blue-400/80 text-xs leading-relaxed truncate">
              {skillsList.slice(0, 10).join(" · ")}
              {skillsList.length > 10 && ` · +${skillsList.length - 10} more`}
            </p>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[240px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Junior Software Engineer"
            className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground focus:border-baymax-red focus:outline-none transition-colors"
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          />
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="bg-baymax-red text-foreground font-syne font-bold px-5 py-2.5 rounded-lg btn-red-glow transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> Searching…</>
          ) : (
            <>Find Jobs <ArrowRight size={14} /></>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* ── Results section ── */}
      {response && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryTile label="Listings shown" value={String(visibleCount)} />
            <SummaryTile label="Filtered (spam removed)" value={`${meta?.kept_after_spam ?? 0} of ${meta?.raw_hits ?? 0}`} />
            <SummaryTile label="Top skill gap"     value={response.top_skill_gap || "—"} accent="#fcd34d" />
            <SummaryTile label="Saved by you"      value={String(savedCount)} accent="#fcd34d" />
          </div>

          {/* Tip line */}
          {response.application_tip && (
            <div
              className="px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac" }}
            >
              💡 <strong>Application tip:</strong> {response.application_tip}
            </div>
          )}

          {/* Sort + saved toggle */}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-mono uppercase tracking-widest">sort:</span>
              {(["match", "level", "source"] as SortKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSortBy(k)}
                  className={`px-3 py-1 rounded-full transition-all ${
                    sortBy === k
                      ? "bg-baymax-red text-white"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k === "match" ? "Best match" : k === "level" ? "Level" : "Source"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSavedOnly(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all ${
                savedOnly
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-secondary text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {savedOnly ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
              {savedOnly ? `Showing saved (${savedCount})` : "Show saved only"}
              {savedOnly && <X size={12} className="ml-1" />}
            </button>
          </div>

          {/* Cards */}
          <div className="grid lg:grid-cols-2 gap-3">
            {visibleJobs.map((j) => (
              <JobCard
                key={j.id}
                job={j}
                saved={savedIds.has(j.id)}
                onToggleSave={() => toggleSave(j.id)}
                candidateSkills={skillsList}
              />
            ))}
          </div>

          {/* Empty state when filter is on */}
          {visibleJobs.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              {savedOnly
                ? "You haven't saved any jobs yet. Bookmark interesting roles to keep them here."
                : "No matching listings — try broadening the role title or adding more skills to your resume."}
            </div>
          )}

          {/* Move on to roadmap */}
          {visibleJobs.length > 0 && onSwitchTab && (
            <button
              onClick={() => onSwitchTab(4)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-sm mt-2"
              style={{
                background: "linear-gradient(135deg, #059669, #047857)",
                boxShadow: "0 4px 18px rgba(5,150,105,0.3)",
              }}
            >
              Plan how to land one of these → <ArrowRight size={16} />
            </button>
          )}
        </>
      )}

      {/* Empty pre-search state */}
      {!response && !loading && (
        <div
          className="text-center py-16 rounded-xl"
          style={{ border: "1px dashed rgba(255,255,255,0.08)" }}
        >
          <Search size={36} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-foreground/80 mb-1">Find live, ranked openings.</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Search Rozee.pk, Mustakbil, LinkedIn, Indeed and Wellfound — listings scored
            by overlap with your resume's skills, then ranked. Senior roles are
            automatically penalised for entry-level candidates.
          </p>
        </div>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// Summary tile
// ─────────────────────────────────────────────────────────────────────────────

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p
        className="font-mono text-base font-bold mt-0.5 truncate"
        style={{ color: accent || "#fafafa" }}
      >
        {value}
      </p>
    </div>
  );
}


export default JobScout;
