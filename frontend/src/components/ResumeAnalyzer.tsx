import { useState, useRef } from "react";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Copy,
  TrendingUp,
  Zap,
  FileText,
  Target,
  Award,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  analyzeResumeStructured,
  type ResumeAnalysisStructured,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSwitchTab: (tab: number) => void;
  onAnalysisComplete?: (jobTitle: string, resumeSummary: string) => void;
}

// ── Animated Score Ring ──────────────────────────────────────────────────────
const ScoreRing = ({
  score,
  label,
  color,
  size = 80,
  visible,
}: {
  score: number;
  label: string;
  color: string;
  size?: number;
  visible: boolean;
}) => {
  const r = (size / 2) * 0.8;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#1e1e1e"
            strokeWidth="5"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={visible ? offset : circ}
            style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-extrabold leading-none"
            style={{ color, fontSize: size * 0.22 }}
          >
            {visible ? score : 0}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center leading-tight max-w-[72px]">
        {label}
      </span>
    </div>
  );
};

// ── Verdict Badge ────────────────────────────────────────────────────────────
const VerdictBadge = ({ verdict }: { verdict: string }) => {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    Excellent: { bg: "bg-green-500/15 border-green-500/30", text: "text-green-400", dot: "bg-green-400" },
    Good: { bg: "bg-yellow-500/15 border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-400" },
    "Needs Improvement": { bg: "bg-red-500/15 border-red-500/30", text: "text-red-400", dot: "bg-red-400" },
  };
  const s = map[verdict] ?? map["Good"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {verdict}
    </span>
  );
};

// ── Improvement Card ─────────────────────────────────────────────────────────
const ImprovementCard = ({
  section,
  before,
  after,
  why,
}: {
  section: string;
  before: string;
  after: string;
  why: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {section}
        </span>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-sm text-muted-foreground line-through opacity-70">{before}</p>
          <p className="text-sm text-foreground flex items-start gap-2">
            <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={14} />
            {after}
          </p>
          <p className="text-xs text-muted-foreground italic border-l-2 border-baymax-red/40 pl-2 mt-1">
            {why}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────
const ResumeAnalyzer = ({ onSwitchTab, onAnalysisComplete }: Props) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [experience, setExperience] = useState("0-1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResumeAnalysisStructured | null>(null);
  const [visible, setVisible] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid file", description: "Please upload a PDF", variant: "destructive" });
      return;
    }
    setFile(f);
    setResult(null);
    setVisible(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const runAnalysis = async () => {
    if (!file) {
      toast({ title: "No file", description: "Upload a PDF resume first", variant: "destructive" });
      return;
    }
    if (!jobTitle.trim()) {
      toast({ title: "Job title required", description: "Enter your target role", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setVisible(false);
    try {
      const data = await analyzeResumeStructured(file, jobTitle, experience);
      setResult(data);
      setTimeout(() => setVisible(true), 50); // allow paint before animating rings
      onAnalysisComplete?.(jobTitle, data.rewritten_summary + "\n\nSkills to address: " + data.skill_gaps.join(", "));
      toast({ title: "Analysis complete ✅", description: `Overall score: ${data.overall_score}/100` });
    } catch (err) {
      toast({ title: "Analysis failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Summary copied to clipboard" });
  };

  const metrics = result
    ? [
        { label: "Overall", score: result.overall_score, color: "#E8272B", icon: Award },
        { label: "ATS Compatibility", score: result.ats_score, color: "#3b82f6", icon: Target },
        { label: "Keyword Match", score: result.keyword_match_score, color: "#a855f7", icon: Zap },
        { label: "Impact Score", score: result.impact_score, color: "#f59e0b", icon: TrendingUp },
        { label: "Formatting", score: result.formatting_score, color: "#10b981", icon: FileText },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Upload + Config */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragging
              ? "border-baymax-red bg-baymax-red/5"
              : "border-border hover:border-baymax-red/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle className="text-green-400" size={20} />
              <span className="text-foreground text-sm">{file.name}</span>
              <span className="text-muted-foreground text-xs">({(file.size / 1024).toFixed(0)} KB)</span>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                className="text-baymax-red hover:text-baymax-red-light"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-3 text-muted-foreground" size={32} />
              <p className="text-foreground text-sm">Drop your resume PDF here</p>
              <p className="text-baymax-red text-xs mt-1">or click to browse</p>
            </>
          )}
        </div>

        {/* Config fields */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Target role, e.g. Software Engineer"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-baymax-red focus:outline-none transition-colors"
          />
          <select
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-sm text-foreground focus:border-baymax-red focus:outline-none transition-colors"
          >
            <option value="0-1">0–1 years experience</option>
            <option value="1-3">1–3 years</option>
            <option value="3-5">3–5 years</option>
            <option value="5+">5+ years</option>
          </select>
          <button
            onClick={runAnalysis}
            disabled={!file || loading}
            className="w-full bg-baymax-red text-foreground font-syne font-bold py-3 rounded-lg btn-red-glow transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                Alex is analyzing your resume…
              </span>
            ) : (
              "Analyze with Baymax →"
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6" style={{ animation: "staggerFadeIn 0.4s ease-out forwards" }}>

          {/* Verdict + Scores */}
          <div className="glass-card rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-syne font-bold text-foreground text-base">Resume Score</h3>
              <VerdictBadge verdict={result.verdict} />
            </div>
            <div className="flex flex-wrap gap-6 justify-around">
              {metrics.map((m) => (
                <ScoreRing
                  key={m.label}
                  score={m.score}
                  label={m.label}
                  color={m.color}
                  size={80}
                  visible={visible}
                />
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-green-400">✅ Keywords Found</p>
              <div className="flex flex-wrap gap-1.5">
                {result.keywords_found.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs px-2.5 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-300"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-baymax-red-light">❌ Missing Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {result.keywords_missing.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs px-2.5 py-1 rounded-full border border-baymax-red/30 bg-baymax-red/10 text-baymax-red-light"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Strengths + Gaps */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-foreground mb-3">💪 Top Strengths</p>
              {result.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-green-400 mt-0.5 shrink-0">→</span>
                  {s}
                </div>
              ))}
            </div>
            <div className="glass-card rounded-xl p-4 space-y-2">
              <p className="text-sm font-bold text-foreground mb-3">🎯 Skill Gaps</p>
              {result.skill_gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-baymax-red mt-0.5 shrink-0">→</span>
                  {g}
                </div>
              ))}
            </div>
          </div>

          {/* Improvements */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-foreground">✏️ AI-Powered Bullet Improvements</p>
            {result.improvements.map((imp, i) => (
              <ImprovementCard key={i} {...imp} />
            ))}
          </div>

          {/* Rewritten Summary */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">✨ Rewritten Professional Summary</p>
              <button
                onClick={() => copyToClipboard(result.rewritten_summary)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-baymax-red transition-colors"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <button
              onClick={() => setSummaryOpen((p) => !p)}
              className="text-left w-full"
            >
              <p
                className={`text-sm text-foreground/90 leading-relaxed transition-all ${
                  !summaryOpen ? "line-clamp-2" : ""
                }`}
              >
                {result.rewritten_summary}
              </p>
              {!summaryOpen && (
                <span className="text-xs text-baymax-red mt-1 inline-block">Read more ↓</span>
              )}
            </button>
          </div>

          {/* Recommendation */}
          <div className="glass-card rounded-xl p-4 border border-baymax-red/20 space-y-2">
            <p className="text-sm font-bold text-baymax-red-light">🔑 Key Recommendation</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.recommendation}</p>
          </div>

          {/* CTA Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSwitchTab(1)}
              className="w-full border border-baymax-red text-baymax-red font-syne font-bold py-3 rounded-lg hover:bg-baymax-red/10 transition-all text-sm"
            >
              🎤 Practice Interview →
            </button>
            <button
              onClick={() => onSwitchTab(4)}
              className="w-full bg-baymax-red/10 border border-baymax-red/30 text-baymax-red font-syne font-bold py-3 rounded-lg hover:bg-baymax-red/20 transition-all text-sm"
            >
              🏗️ Build Resume →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeAnalyzer;
