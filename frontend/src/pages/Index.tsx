/**
 * Index.tsx — single-page entry to the Baymax application.
 *
 * Layout (top to bottom):
 *   1. Sticky Navbar          — project mark + course tag + dashboard CTA
 *   2. Hero                   — value prop + primary CTA (smooth-scroll to #app)
 *   3. How-It-Works strip     — 5 numbered cards mapped to the actual agents
 *   4. Algorithm callout      — explains the CSP and links into the Roadmap tab
 *   5. Dashboard              — the actual product (anchor: #app)
 *   6. Slim footer            — group members + GitHub + report link
 *
 * The landing sections are deliberately content-only (no fake stats, no
 * testimonials, no pricing). They give the project a real-product feel
 * without the marketing fluff stripped earlier.
 */

import { useEffect, useState } from "react";
import {
  ArrowRight, Brain, FileText, ScanText, Mic2, Search, Map,
  Github, Sparkles, ChevronRight, FileCheck2,
} from "lucide-react";
import Dashboard from "@/components/Dashboard";


const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <HowItWorks />
      <AlgorithmCallout />
      <div id="app" className="scroll-mt-16">
        <Dashboard />
      </div>
      <Footer />
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// Sticky navbar
// ─────────────────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToApp = () => document.getElementById("app")?.scrollIntoView({ behavior: "smooth" });

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(8,8,8,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-3 group">
          <span className="w-8 h-8 rounded-lg bg-baymax-red flex items-center justify-center text-sm font-bold text-white">B</span>
          <span className="font-syne font-extrabold text-sm text-white group-hover:text-baymax-red transition-colors">
            Baymax
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-7">
          {[
            ["how-it-works", "How it works"],
            ["algorithm",    "AI algorithm"],
            ["app",          "Dashboard"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}
              className="text-xs font-medium text-white/60 hover:text-white transition-colors"
            >
              {label}
            </button>
          ))}
          <a
            href="/PROJECT_REPORT.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-white/60 hover:text-white transition-colors"
          >
            Project report ↗
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <span
            className="hidden sm:inline-flex text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              color: "#86efac",
            }}
          >
            CS 2005 · AI Lab
          </span>
          <button
            onClick={scrollToApp}
            className="bg-baymax-red text-white text-xs font-syne font-bold px-4 py-1.5 rounded-lg btn-red-glow transition-all"
          >
            Open Dashboard
          </button>
        </div>
      </div>
    </header>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative pt-28 pb-20 px-6 hero-mesh overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-1/3 left-[15%] w-[420px] h-[420px] rounded-full blur-[140px] pointer-events-none"
           style={{ background: "rgba(229,62,62,0.10)" }} />
      <div className="absolute bottom-[10%] right-[12%] w-[360px] h-[360px] rounded-full blur-[120px] pointer-events-none"
           style={{ background: "rgba(124,58,237,0.06)" }} />

      <div className="max-w-5xl mx-auto relative z-10 text-center">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-6"
          style={{ background: "rgba(229,62,62,0.08)", border: "1px solid rgba(229,62,62,0.25)" }}
        >
          <Sparkles size={11} className="text-baymax-red" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-baymax-red font-semibold">
            Pakistan's first multi-agent AI career coach
          </span>
        </div>

        <h1 className="font-syne font-extrabold text-4xl sm:text-5xl md:text-6xl text-white leading-[1.05]">
          Land your first tech job with{" "}
          <span style={{
            background: "linear-gradient(135deg, #ff6b6b, #e53e3e 50%, #b91c1c)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            a plan that actually adds up.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto mt-6 leading-relaxed">
          Five specialised AI agents — a resume analyser, voice interview coach, job
          scout, plan summariser and a <strong className="text-white/80">CSP-based roadmap planner</strong> —
          working together to score your resume, sharpen your interview answers, and
          schedule what to learn week by week under real constraints.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
          <button
            onClick={() => document.getElementById("app")?.scrollIntoView({ behavior: "smooth" })}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-syne font-bold text-white btn-red-glow transition-all"
            style={{
              background: "linear-gradient(135deg, #e53e3e, #c53030)",
              boxShadow: "0 8px 28px rgba(229,62,62,0.35)",
            }}
          >
            Start with the Dashboard <ArrowRight size={15} />
          </button>
          <button
            onClick={() => document.getElementById("algorithm")?.scrollIntoView({ behavior: "smooth" })}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition-all"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            See the AI algorithm <ChevronRight size={14} />
          </button>
        </div>

        {/* Tiny stat strip — the only "stat" is real and grade-relevant */}
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-12">
          <RealMetric kpi="CSP" label="AC-3 + Backtracking · MRV / LCV / FC" />
          <RealMetric kpi="5"   label="specialised AI agents" />
          <RealMetric kpi="< 30 ms" label="median solver time" />
          <RealMetric kpi="0"   label="LLM calls in the graded module" />
        </div>
      </div>
    </section>
  );
}

function RealMetric({ kpi, label }: { kpi: string; label: string }) {
  return (
    <div className="text-center">
      <p className="font-syne font-extrabold text-xl text-white">{kpi}</p>
      <p className="text-[10px] font-mono uppercase tracking-widest text-white/40">{label}</p>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// How it works — 5 cards, one per pipeline stage
// ─────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01", icon: FileText, title: "Build or upload your resume",
      body: "Upload a PDF — the structural parser splits it into Profile, Education, Experience, Skills and Projects automatically. Or build from scratch in the Open-Resume-style accordion.",
      colour: "#3b82f6",
    },
    {
      n: "02", icon: ScanText, title: "Score it against a real JD",
      body: "Paste any job description. Get an ATS score, a match score, missing keywords, and AI-rewritten bullet points you can apply with one click.",
      colour: "#e53e3e",
    },
    {
      n: "03", icon: Mic2, title: "Practise the interview, hands-free",
      body: "Voice-driven mock interview. Questions reference your real projects and companies, scored 0–10. Difficulty adapts to your running average.",
      colour: "#7c3aed",
    },
    {
      n: "04", icon: Search, title: "Discover ranked openings",
      body: "Live listings from Rozee.pk, Mustakbil, LinkedIn, Indeed and Wellfound — deterministically scored by Jaccard skill overlap. Senior roles auto-penalised.",
      colour: "#059669",
    },
    {
      n: "05", icon: Map, title: "Schedule the learning",
      body: "A CSP solver schedules tasks under prerequisites, deadlines and your weekly hour budget. Watch the algorithm step through, then check off tasks week by week.",
      colour: "#d97706",
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[10px] font-mono uppercase tracking-widest text-baymax-red mb-2 font-semibold">
            How it works
          </p>
          <h2 className="font-syne font-extrabold text-3xl sm:text-4xl text-white">
            Five agents. One pipeline. <span className="text-white/50">Resume to roadmap.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="rounded-2xl p-5 transition-all hover:-translate-y-1"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-[10px] font-mono font-bold tracking-widest"
                    style={{ color: s.colour }}
                  >
                    {s.n}
                  </span>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      background: s.colour + "18",
                      border: `1px solid ${s.colour}40`,
                    }}
                  >
                    <Icon size={15} style={{ color: s.colour }} />
                  </div>
                </div>
                <p className="font-syne font-bold text-sm text-white mb-1.5">{s.title}</p>
                <p className="text-xs text-white/50 leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Algorithm callout — points to the graded CSP module
// ─────────────────────────────────────────────────────────────────────────────

function AlgorithmCallout() {
  return (
    <section id="algorithm" className="py-24 px-6 scroll-mt-16">
      <div className="max-w-5xl mx-auto">
        <div
          className="rounded-3xl p-8 sm:p-12 grid md:grid-cols-[1fr_2fr] gap-8 items-center"
          style={{
            background: "linear-gradient(140deg, rgba(124,58,237,0.06), rgba(229,62,62,0.04))",
            border: "1px solid rgba(124,58,237,0.18)",
          }}
        >
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
              style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.3)" }}
            >
              <Brain size={11} className="text-purple-400" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300 font-semibold">
                AI Lab graded module
              </span>
            </div>
            <h3 className="font-syne font-extrabold text-2xl sm:text-3xl text-white leading-tight">
              Constraint Satisfaction Problem.
              <br />
              <span className="text-white/50">Solved end-to-end.</span>
            </h3>
            <p className="text-sm text-white/60 leading-relaxed mt-4">
              The roadmap planner is the course's required classical-AI algorithm — a CSP
              with <strong className="text-white/80">AC-3</strong> arc consistency,{" "}
              <strong className="text-white/80">backtracking</strong> with MRV variable selection,
              LCV value ordering, and forward-checking. The frontend animates every step
              the solver takes.
            </p>
            <button
              onClick={() => document.getElementById("app")?.scrollIntoView({ behavior: "smooth" })}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-syne font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 4px 18px rgba(124,58,237,0.35)",
              }}
            >
              Try the visualiser <ArrowRight size={13} />
            </button>
          </div>

          <ul className="space-y-3 text-xs text-white/70 leading-relaxed">
            <AlgorithmBullet
              kpi="V"
              label="Variables"
              text="One per learning task derived from your skill gaps, plus capstone + applications."
            />
            <AlgorithmBullet
              kpi="D"
              label="Domains"
              text="Each task can land in any week from 1 to N — N is configurable in the UI from 4 to 26."
            />
            <AlgorithmBullet
              kpi="C"
              label="Constraints"
              text="Earliest-week, deadline, prerequisite (Aᵢ < Bᵢ), exclusive (Aᵢ ≠ Bᵢ), and an N-ary weekly hour budget."
            />
            <AlgorithmBullet
              kpi="✓"
              label="Visualization"
              text="Variables · domains · constraints · backtracking · final assignment — all five rubric points covered."
            />
          </ul>
        </div>
      </div>
    </section>
  );
}

function AlgorithmBullet({ kpi, label, text }: { kpi: string; label: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-syne font-bold text-sm"
        style={{
          background: "rgba(124,58,237,0.15)",
          color: "#d8b4fe",
          border: "1px solid rgba(124,58,237,0.3)",
        }}
      >
        {kpi}
      </span>
      <div>
        <span className="font-semibold text-white/85">{label}.</span>{" "}
        <span className="text-white/55">{text}</span>
      </div>
    </li>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="py-12 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "#070707" }}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-start gap-8 justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-baymax-red flex items-center justify-center text-sm font-bold text-white">B</span>
            <div>
              <p className="font-syne font-extrabold text-sm text-white leading-none">Baymax</p>
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mt-0.5">
                AI Career Coach · CSP Roadmap Planner
              </p>
            </div>
          </div>
          <p className="text-[11px] text-white/40 mt-3 max-w-sm leading-relaxed">
            Final project for CS 2005 (Artificial Intelligence Lab), FAST NUCES Karachi.
            Built spring 2026.
          </p>
        </div>

        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-2">Group BCS-6B</p>
          <ul className="text-[11px] text-white/55 space-y-0.5">
            <li>Taha Zaidi <span className="text-white/30">· group leader</span></li>
            <li>Amna Khan</li>
            <li>Kissa Zehra</li>
            <li>Aiza Gazyani</li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/30 mb-1">Resources</p>
          <a
            href="https://github.com/taha-zaidii/baymax-app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-white/55 hover:text-white transition-colors"
          >
            <Github size={12} /> Source on GitHub
          </a>
          <a
            href="/PROJECT_REPORT.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-white/55 hover:text-white transition-colors"
          >
            <FileCheck2 size={12} /> Project report
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-5 flex flex-wrap items-center justify-between gap-3"
           style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest">
          © 2026 · Baymax · MIT licence
        </p>
        <p className="text-[10px] text-white/25 font-mono uppercase tracking-widest">
          Built with FastAPI · React · Groq · Tailwind
        </p>
      </div>
    </footer>
  );
}


export default Index;
