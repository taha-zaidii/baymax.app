/**
 * ResumeBuilder.tsx — Open-Resume Inspired Form + Live A4 Preview
 *
 * Matches the open-resume form accordion pattern:
 *   Profile, Work Experiences, Projects, Education, Skills
 *
 * AI features:
 *   - ✨ Enhance: rewrites bullets/text via POST /resume/improve
 *   - 🤖 Generate: writes section from scratch via POST /resume/generate-section
 *
 * PDF: window.print() with the A4 preview content
 * Builder state is shared upward so ResumeAnalyzer can "Analyze Current Resume"
 */

import { useState, useCallback } from "react";
import {
  Plus, Trash2, Download, Sparkles, RefreshCw, Loader2,
  ChevronDown, ChevronUp, User, Briefcase, GraduationCap,
  Code2, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkExp {
  id: string;
  company: string;
  jobTitle: string;
  date: string;
  descriptions: string[];
}

interface Project {
  id: string;
  project: string;
  date: string;
  descriptions: string[];
}

interface Education {
  id: string;
  school: string;
  degree: string;
  date: string;
  gpa: string;
  descriptions: string[];
}

interface Profile {
  name: string;
  email: string;
  phone: string;
  location: string;
  url: string;
  summary: string;
}

interface ResumeState {
  profile: Profile;
  workExperiences: WorkExp[];
  projects: Project[];
  educations: Education[];
  skills: { descriptions: string[] };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const API_BASE = "http://localhost:8000";

async function improveSection(text: string, context = ""): Promise<string> {
  const res = await fetch(`${API_BASE}/resume/improve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, context }),
  });
  if (!res.ok) throw new Error("Improve failed");
  const data = await res.json();
  return data.improved || text;
}

async function generateSection(sectionName: string, context: string, jobTitle: string): Promise<string> {
  const res = await fetch(`${API_BASE}/resume/generate-section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section_name: sectionName, context, job_title: jobTitle }),
  });
  if (!res.ok) throw new Error("Generate failed");
  const data = await res.json();
  return data.generated_content || "";
}

/** Convert the resume state into plain text for the analyzer */
export function resumeStateToText(state: ResumeState): string {
  const lines: string[] = [];
  const { profile, workExperiences, educations, skills, projects } = state;

  if (profile.name) lines.push(profile.name);
  if (profile.email) lines.push(profile.email);
  if (profile.phone) lines.push(profile.phone);
  if (profile.location) lines.push(profile.location);
  if (profile.url) lines.push(profile.url);
  if (profile.summary) lines.push(`\nSUMMARY\n${profile.summary}`);

  if (workExperiences.length > 0) {
    lines.push("\nWORK EXPERIENCE");
    workExperiences.forEach((e) => {
      lines.push(`${e.jobTitle} at ${e.company} (${e.date})`);
      e.descriptions.forEach((d) => d && lines.push(`• ${d}`));
    });
  }

  if (educations.length > 0) {
    lines.push("\nEDUCATION");
    educations.forEach((e) => {
      lines.push(`${e.degree} from ${e.school} (${e.date})`);
      if (e.gpa) lines.push(`GPA: ${e.gpa}`);
    });
  }

  if (skills.descriptions.length > 0) {
    lines.push("\nSKILLS");
    lines.push(skills.descriptions.join(", "));
  }

  if (projects.length > 0) {
    lines.push("\nPROJECTS");
    projects.forEach((p) => {
      lines.push(`${p.project} (${p.date})`);
      p.descriptions.forEach((d) => d && lines.push(`• ${d}`));
    });
  }

  return lines.join("\n");
}

// ── Default State ──────────────────────────────────────────────────────────────

const defaultExp = (): WorkExp => ({
  id: uid(), company: "", jobTitle: "", date: "", descriptions: [""],
});
const defaultProj = (): Project => ({
  id: uid(), project: "", date: "", descriptions: [""],
});
const defaultEdu = (): Education => ({
  id: uid(), school: "", degree: "", date: "", gpa: "", descriptions: [],
});

const DEFAULT: ResumeState = {
  profile: { name: "", email: "", phone: "", location: "", url: "", summary: "" },
  workExperiences: [defaultExp()],
  projects: [defaultProj()],
  educations: [defaultEdu()],
  skills: { descriptions: [""] },
};

// ── Small UI Helpers ──────────────────────────────────────────────────────────

const inp = "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-red-500/60 focus:outline-none transition-colors";
const ta = "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-red-500/60 focus:outline-none transition-colors resize-none";

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">{children}</label>
);

const SectionHeader = ({
  icon, title, open, toggle
}: { icon: React.ReactNode; title: string; open: boolean; toggle: () => void }) => (
  <button
    onClick={toggle}
    className="w-full flex items-center justify-between px-4 py-3 transition-colors text-left"
    style={{ background: "#161616", borderBottom: open ? "1px solid #2a2a2a" : "none" }}
  >
    <span className="flex items-center gap-2 text-sm font-bold text-gray-200">{icon}{title}</span>
    {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
  </button>
);

const AIBtn = ({
  label, loading, onClick, variant = "enhance"
}: { label: string; loading: boolean; onClick: () => void; variant?: "enhance" | "generate" }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
      variant === "generate"
        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
        : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
    }`}
  >
    {loading
      ? <Loader2 size={11} className="animate-spin" />
      : variant === "generate" ? <RefreshCw size={11} /> : <Sparkles size={11} />}
    {label}
  </button>
);

// ── Live Preview HTML Builder ──────────────────────────────────────────────────

function buildHTML(d: ResumeState): string {
  const p = d.profile;
  const name = p.name || "Your Name";
  const contact = [p.email, p.phone, p.location].filter(Boolean).join(" · ");
  const links = [
    p.url ? `<a href="${p.url}" style="color:#e53e3e">${p.url.replace(/https?:\/\//, "")}</a>` : ""
  ].filter(Boolean).join(" · ");

  const section = (title: string, html: string) => !html.trim() ? "" : `
    <div style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#e53e3e">${title}</span>
        <div style="flex:1;height:1px;background:#e53e3e;opacity:0.4"></div>
      </div>
      ${html}
    </div>`;

  const expHTML = d.workExperiences
    .filter((e) => e.company || e.jobTitle)
    .map((e) => `
      <div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between">
          <strong style="font-size:12.5px">${e.jobTitle || "Role"}</strong>
          <span style="font-size:11px;color:#666">${e.date}</span>
        </div>
        <div style="font-size:11.5px;color:#555;margin-bottom:3px">${e.company}</div>
        ${e.descriptions.filter(Boolean).length > 0
          ? `<ul style="margin:0;padding-left:14px;font-size:11.5px;color:#333;line-height:1.6">${
              e.descriptions.filter(Boolean).map((d) => `<li>${d.replace(/^[-•]\s*/, "")}</li>`).join("")
            }</ul>`
          : ""}
      </div>`).join("");

  const eduHTML = d.educations
    .filter((e) => e.school || e.degree)
    .map((e) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between">
          <strong style="font-size:12.5px">${e.degree || "Degree"}</strong>
          <span style="font-size:11px;color:#666">${e.date}</span>
        </div>
        <div style="font-size:11.5px;color:#555">${e.school}${e.gpa ? ` · GPA: ${e.gpa}` : ""}</div>
      </div>`).join("");

  const projHTML = d.projects
    .filter((p) => p.project || p.descriptions.some(Boolean))
    .map((p) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between">
          <strong style="font-size:12.5px">${p.project || "Project"}</strong>
          <span style="font-size:11px;color:#666">${p.date}</span>
        </div>
        ${p.descriptions.filter(Boolean).length > 0
          ? `<ul style="margin:2px 0 0;padding-left:14px;font-size:11.5px;color:#333;line-height:1.6">${
              p.descriptions.filter(Boolean).map((d) => `<li>${d.replace(/^[-•]\s*/, "")}</li>`).join("")
            }</ul>`
          : ""}
      </div>`).join("");

  const skillsHTML = d.skills.descriptions.filter(Boolean).join(", ");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',Times,serif;font-size:12px;color:#1a1a1a;background:white;padding:36px 40px;max-width:794px;margin:auto}
a{color:#e53e3e;text-decoration:none}</style></head>
<body>
  <div style="text-align:center;margin-bottom:14px">
    <h1 style="font-size:22px;font-weight:700;letter-spacing:0.02em">${name}</h1>
    ${contact ? `<div style="font-size:11px;color:#555;margin-top:3px">${contact}</div>` : ""}
    ${links ? `<div style="font-size:11px;margin-top:2px">${links}</div>` : ""}
  </div>
  ${section("Professional Summary", p.summary ? `<p style="font-size:12px;color:#333;line-height:1.55">${p.summary}</p>` : "")}
  ${section("Work Experience", expHTML)}
  ${section("Education", eduHTML)}
  ${section("Skills", skillsHTML ? `<p style="font-size:12px;color:#333;line-height:1.6">${skillsHTML}</p>` : "")}
  ${section("Projects", projHTML)}
</body></html>`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  jobTitle?: string;
  onResumeTextChange?: (text: string) => void;
}

const ResumeBuilder = ({ jobTitle = "", onResumeTextChange }: Props) => {
  const { toast } = useToast();
  const [data, setData] = useState<ResumeState>(DEFAULT);
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [openSections, setOpenSections] = useState({ profile: true, exp: true, edu: false, skills: false, proj: false });

  const toggleSection = (s: keyof typeof openSections) =>
    setOpenSections((p) => ({ ...p, [s]: !p[s] }));

  const update = useCallback(<K extends keyof ResumeState>(key: K, val: ResumeState[K]) => {
    setData((d) => {
      const next = { ...d, [key]: val };
      onResumeTextChange?.(resumeStateToText(next));
      return next;
    });
  }, [onResumeTextChange]);

  const setLoading = (k: string, v: boolean) => setAiLoading((p) => ({ ...p, [k]: v }));

  // ── AI actions ───────────────────────────────────────────────────────────────

  const enhance = async (k: string, text: string, ctx: string, onResult: (v: string) => void) => {
    if (!text.trim()) { toast({ title: "Nothing to enhance", variant: "destructive" }); return; }
    setLoading(k, true);
    try {
      const improved = await improveSection(text, ctx);
      onResult(improved);
      toast({ title: "✨ Enhanced!" });
    } catch { toast({ title: "Enhance failed", variant: "destructive" }); }
    finally { setLoading(k, false); }
  };

  const generate = async (k: string, section: string, ctx: string, onResult: (v: string) => void) => {
    setLoading(k, true);
    try {
      const generated = await generateSection(section, ctx, jobTitle || "Software Engineer");
      onResult(generated);
      toast({ title: "🤖 Generated!" });
    } catch { toast({ title: "Generation failed", variant: "destructive" }); }
    finally { setLoading(k, false); }
  };

  // ── Work Experience CRUD ─────────────────────────────────────────────────────

  const addExp = () => update("workExperiences", [...data.workExperiences, defaultExp()]);
  const removeExp = (id: string) => update("workExperiences", data.workExperiences.filter((e) => e.id !== id));
  const setExp = (id: string, field: keyof WorkExp, val: unknown) =>
    update("workExperiences", data.workExperiences.map((e) => e.id === id ? { ...e, [field]: val } : e));
  const setExpBullet = (id: string, i: number, val: string) =>
    setExp(id, "descriptions", data.workExperiences.find((e) => e.id === id)!.descriptions.map((d, j) => j === i ? val : d));
  const addExpBullet = (id: string) =>
    setExp(id, "descriptions", [...(data.workExperiences.find((e) => e.id === id)?.descriptions || []), ""]);

  // ── Project CRUD ──────────────────────────────────────────────────────────────

  const addProj = () => update("projects", [...data.projects, defaultProj()]);
  const removeProj = (id: string) => update("projects", data.projects.filter((p) => p.id !== id));
  const setProj = (id: string, field: keyof Project, val: unknown) =>
    update("projects", data.projects.map((p) => p.id === id ? { ...p, [field]: val } : p));
  const setProjBullet = (id: string, i: number, val: string) =>
    setProj(id, "descriptions", data.projects.find((p) => p.id === id)!.descriptions.map((d, j) => j === i ? val : d));
  const addProjBullet = (id: string) =>
    setProj(id, "descriptions", [...(data.projects.find((p) => p.id === id)?.descriptions || []), ""]);

  // ── Education CRUD ────────────────────────────────────────────────────────────

  const addEdu = () => update("educations", [...data.educations, defaultEdu()]);
  const removeEdu = (id: string) => update("educations", data.educations.filter((e) => e.id !== id));
  const setEdu = (id: string, field: keyof Education, val: unknown) =>
    update("educations", data.educations.map((e) => e.id === id ? { ...e, [field]: val } : e));

  // ── PDF Download ──────────────────────────────────────────────────────────────

  const downloadPDF = () => {
    const win = window.open("", "_blank");
    if (!win) { toast({ title: "Popup blocked", variant: "destructive" }); return; }
    win.document.write(buildHTML(data));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const previewBody = buildHTML(data).replace(/<!DOCTYPE[\s\S]*?<body[^>]*>/, "").replace(/<\/body>[\s\S]*$/, "");

  return (
    <div
      className="grid md:grid-cols-[440px_1fr] gap-0 rounded-xl overflow-hidden border border-[#1f1f1f]"
      style={{ height: "680px" }}
    >
      {/* ── Editor Panel ──────────────────────────────────────────────── */}
      <div className="overflow-y-auto flex flex-col" style={{ background: "#0f0f0f", borderRight: "1px solid #1f1f1f" }}>

        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]" style={{ background: "#0f0f0f" }}>
          <span className="text-sm font-bold text-gray-200">📝 Resume Editor</span>
          {jobTitle && <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">{jobTitle}</span>}
        </div>

        {/* ── Profile Section ── */}
        <div className="border-b border-[#1f1f1f]">
          <SectionHeader icon={<User size={14} className="text-red-400" />} title="Profile & Contact" open={openSections.profile} toggle={() => toggleSection("profile")} />
          {openSections.profile && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>First Name</Label><input className={inp} placeholder="John" value={data.profile.name.split(" ")[0] || ""} onChange={(e) => update("profile", { ...data.profile, name: `${e.target.value} ${data.profile.name.split(" ").slice(1).join(" ")}`.trim() })} /></div>
                <div><Label>Last Name</Label><input className={inp} placeholder="Doe" value={data.profile.name.split(" ").slice(1).join(" ") || ""} onChange={(e) => update("profile", { ...data.profile, name: `${data.profile.name.split(" ")[0] || ""} ${e.target.value}`.trim() })} /></div>
              </div>
              <div><Label>Email</Label><input className={inp} placeholder="john@example.com" value={data.profile.email} onChange={(e) => update("profile", { ...data.profile, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Phone</Label><input className={inp} placeholder="+92 300 0000000" value={data.profile.phone} onChange={(e) => update("profile", { ...data.profile, phone: e.target.value })} /></div>
                <div><Label>Location</Label><input className={inp} placeholder="Lahore, PK" value={data.profile.location} onChange={(e) => update("profile", { ...data.profile, location: e.target.value })} /></div>
              </div>
              <div><Label>LinkedIn / Portfolio URL</Label><input className={inp} placeholder="linkedin.com/in/johndoe" value={data.profile.url} onChange={(e) => update("profile", { ...data.profile, url: e.target.value })} /></div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Professional Summary</Label>
                  <div className="flex gap-1">
                    <AIBtn label="Enhance" loading={!!aiLoading["summary-e"]} onClick={() => enhance("summary-e", data.profile.summary, `Summary for ${jobTitle || "Software Engineer"}`, (v) => update("profile", { ...data.profile, summary: v }))} />
                    <AIBtn label="Generate" loading={!!aiLoading["summary-g"]} variant="generate" onClick={() => generate("summary-g", "Professional Summary", `Name: ${data.profile.name}, Target role: ${jobTitle || "Software Engineer"}`, (v) => update("profile", { ...data.profile, summary: v }))} />
                  </div>
                </div>
                <textarea className={ta} rows={3} placeholder="Results-driven engineer with 2+ years..." value={data.profile.summary} onChange={(e) => update("profile", { ...data.profile, summary: e.target.value })} />
              </div>
            </div>
          )}
        </div>

        {/* ── Work Experience Section ── */}
        <div className="border-b border-[#1f1f1f]">
          <SectionHeader icon={<Briefcase size={14} className="text-red-400" />} title="Work Experience" open={openSections.exp} toggle={() => toggleSection("exp")} />
          {openSections.exp && (
            <div className="p-4 space-y-4">
              {data.workExperiences.map((exp, idx) => (
                <div key={exp.id} className="rounded-xl p-3 space-y-2.5" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">Position {idx + 1}</span>
                    {data.workExperiences.length > 1 && (
                      <button onClick={() => removeExp(exp.id)} className="text-red-500 hover:text-red-300"><Trash2 size={13} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Company</Label><input className={inp} placeholder="Acme Corp" value={exp.company} onChange={(e) => setExp(exp.id, "company", e.target.value)} /></div>
                    <div><Label>Duration</Label><input className={inp} placeholder="Jun 2022 – Present" value={exp.date} onChange={(e) => setExp(exp.id, "date", e.target.value)} /></div>
                  </div>
                  <div><Label>Job Title</Label><input className={inp} placeholder="Software Engineer" value={exp.jobTitle} onChange={(e) => setExp(exp.id, "jobTitle", e.target.value)} /></div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Bullet Points</Label>
                      <AIBtn
                        label="Enhance"
                        loading={!!aiLoading[`exp-${exp.id}`]}
                        onClick={() => enhance(`exp-${exp.id}`, exp.descriptions.filter(Boolean).join("\n"), `${exp.jobTitle} at ${exp.company}`, (v) => setExp(exp.id, "descriptions", v.split("\n").filter(Boolean)))}
                      />
                    </div>
                    {exp.descriptions.map((d, i) => (
                      <input key={i} className={`${inp} mb-1.5`} placeholder={`• Bullet ${i + 1}`} value={d} onChange={(e) => setExpBullet(exp.id, i, e.target.value)} />
                    ))}
                    <button onClick={() => addExpBullet(exp.id)} className="text-xs text-red-400 hover:text-red-300 font-bold mt-0.5">+ Add bullet</button>
                  </div>
                </div>
              ))}
              <button onClick={addExp} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold"><Plus size={13} /> Add Position</button>
            </div>
          )}
        </div>

        {/* ── Education Section ── */}
        <div className="border-b border-[#1f1f1f]">
          <SectionHeader icon={<GraduationCap size={14} className="text-red-400" />} title="Education" open={openSections.edu} toggle={() => toggleSection("edu")} />
          {openSections.edu && (
            <div className="p-4 space-y-4">
              {data.educations.map((edu, idx) => (
                <div key={edu.id} className="rounded-xl p-3 space-y-2.5" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">Entry {idx + 1}</span>
                    {data.educations.length > 1 && <button onClick={() => removeEdu(edu.id)} className="text-red-500"><Trash2 size={13} /></button>}
                  </div>
                  <div><Label>Institution</Label><input className={inp} placeholder="FAST-NUCES" value={edu.school} onChange={(e) => setEdu(edu.id, "school", e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Degree</Label><input className={inp} placeholder="BS Computer Science" value={edu.degree} onChange={(e) => setEdu(edu.id, "degree", e.target.value)} /></div>
                    <div><Label>Year</Label><input className={inp} placeholder="2024" value={edu.date} onChange={(e) => setEdu(edu.id, "date", e.target.value)} /></div>
                  </div>
                  <div><Label>GPA (optional)</Label><input className={inp} placeholder="3.8 / 4.0" value={edu.gpa} onChange={(e) => setEdu(edu.id, "gpa", e.target.value)} /></div>
                </div>
              ))}
              <button onClick={addEdu} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold"><Plus size={13} /> Add Education</button>
            </div>
          )}
        </div>

        {/* ── Skills Section ── */}
        <div className="border-b border-[#1f1f1f]">
          <SectionHeader icon={<Code2 size={14} className="text-red-400" />} title="Skills" open={openSections.skills} toggle={() => toggleSection("skills")} />
          {openSections.skills && (
            <div className="p-4 space-y-2">
              {data.skills.descriptions.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input className={inp} placeholder={`e.g. Languages: Python, JS, TypeScript`} value={s} onChange={(e) => { const d = [...data.skills.descriptions]; d[i] = e.target.value; update("skills", { descriptions: d }); }} />
                  {data.skills.descriptions.length > 1 && (
                    <button onClick={() => { const d = data.skills.descriptions.filter((_, j) => j !== i); update("skills", { descriptions: d }); }} className="text-red-500"><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => update("skills", { descriptions: [...data.skills.descriptions, ""] })} className="flex items-center gap-1 text-xs text-red-400 font-bold"><Plus size={13} /> Add row</button>
                <AIBtn label="Enhance All" loading={!!aiLoading["skills-e"]} onClick={() => enhance("skills-e", data.skills.descriptions.join(", "), `Skills for ${jobTitle || "Software Engineer"}`, (v) => update("skills", { descriptions: [v] }))} />
              </div>
            </div>
          )}
        </div>

        {/* ── Projects Section ── */}
        <div className="border-b border-[#1f1f1f]">
          <SectionHeader icon={<Layers size={14} className="text-red-400" />} title="Projects" open={openSections.proj} toggle={() => toggleSection("proj")} />
          {openSections.proj && (
            <div className="p-4 space-y-4">
              {data.projects.map((proj, idx) => (
                <div key={proj.id} className="rounded-xl p-3 space-y-2.5" style={{ background: "#111111", border: "1px solid #2a2a2a" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">Project {idx + 1}</span>
                    {data.projects.length > 1 && <button onClick={() => removeProj(proj.id)} className="text-red-500"><Trash2 size={13} /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Project Name</Label><input className={inp} placeholder="Baymax AI" value={proj.project} onChange={(e) => setProj(proj.id, "project", e.target.value)} /></div>
                    <div><Label>Date / Duration</Label><input className={inp} placeholder="Jan – Mar 2025" value={proj.date} onChange={(e) => setProj(proj.id, "date", e.target.value)} /></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Bullet Points</Label>
                      <AIBtn label="Enhance" loading={!!aiLoading[`proj-${proj.id}`]} onClick={() => enhance(`proj-${proj.id}`, proj.descriptions.filter(Boolean).join("\n"), `Project: ${proj.project}`, (v) => setProj(proj.id, "descriptions", v.split("\n").filter(Boolean)))} />
                    </div>
                    {proj.descriptions.map((d, i) => (
                      <input key={i} className={`${inp} mb-1.5`} placeholder={`• What you built / impact`} value={d} onChange={(e) => setProjBullet(proj.id, i, e.target.value)} />
                    ))}
                    <button onClick={() => addProjBullet(proj.id)} className="text-xs text-red-400 hover:text-red-300 font-bold mt-0.5">+ Add bullet</button>
                  </div>
                </div>
              ))}
              <button onClick={addProj} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold"><Plus size={13} /> Add Project</button>
            </div>
          )}
        </div>

        {/* Download */}
        <div className="p-4">
          <button
            onClick={downloadPDF}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: "linear-gradient(135deg, #e53e3e, #c53030)", boxShadow: "0 4px 20px rgba(229,62,62,0.35)" }}
          >
            <Download size={15} /> Download PDF
          </button>
        </div>
      </div>

      {/* ── Live Preview Panel ─────────────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden" style={{ background: "#f0f0f0" }}>
        <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#e0e0e0", borderBottom: "1px solid #ccc" }}>
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Live Preview</span>
          <span className="text-xs text-gray-400">A4 · ATS-Friendly</span>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div
            className="bg-white shadow-xl mx-auto"
            style={{ width: "100%", maxWidth: "694px", minHeight: "900px" }}
            dangerouslySetInnerHTML={{ __html: previewBody }}
          />
        </div>
      </div>
    </div>
  );
};

export default ResumeBuilder;
