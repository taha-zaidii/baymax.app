/**
 * ResumeBuilder.tsx — AI-Powered Resume Builder with Live Preview
 *
 * Split-panel layout:
 *  Left  40%  — Section accordion editor with AI Enhance / Generate buttons
 *  Right 60%  — Live A4 HTML/CSS preview that updates as you type
 *
 * Features inspired by open-resume:
 *  - Real-time preview rendering
 *  - Per-section AI enhancement
 *  - Professional summary AI generation
 *  - PDF download via window.print()
 */

import { useState, useRef } from "react";
import {
  Sparkles,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { improveResumeSection, generateResumeSection } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkEntry {
  id: string;
  company: string;
  role: string;
  duration: string;
  bullets: string;
}
interface EduEntry {
  id: string;
  institution: string;
  degree: string;
  year: string;
  gpa: string;
}
interface ProjectEntry {
  id: string;
  name: string;
  tech: string;
  description: string;
}

interface ResumeData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
  summary: string;
  skills: string;
  experience: WorkEntry[];
  education: EduEntry[];
  projects: ProjectEntry[];
}

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_DATA: ResumeData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedin: "",
  github: "",
  location: "",
  summary: "",
  skills: "",
  experience: [{ id: uid(), company: "", role: "", duration: "", bullets: "" }],
  education: [{ id: uid(), institution: "", degree: "", year: "", gpa: "" }],
  projects: [{ id: uid(), name: "", tech: "", description: "" }],
};

// ── Section Accordion Wrapper ────────────────────────────────────────────────

const Accordion = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary hover:bg-secondary/80 transition-colors text-left"
      >
        <span className="text-sm font-bold text-foreground">{title}</span>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-3">{children}</div>}
    </div>
  );
};

// ── Input helpers ────────────────────────────────────────────────────────────

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
    {children}
  </label>
);

const inp =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-baymax-red focus:outline-none transition-colors";

const ta =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-baymax-red focus:outline-none transition-colors resize-none";

// ── AI Enhance Button ────────────────────────────────────────────────────────

const AIButton = ({
  label,
  loading,
  onClick,
  variant = "enhance",
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
  variant?: "enhance" | "generate";
}) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
      variant === "generate"
        ? "bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
        : "bg-baymax-red/10 border border-baymax-red/30 text-baymax-red hover:bg-baymax-red/20"
    }`}
  >
    {loading ? (
      <Loader2 size={12} className="animate-spin" />
    ) : variant === "generate" ? (
      <RefreshCw size={12} />
    ) : (
      <Sparkles size={12} />
    )}
    {label}
  </button>
);

// ── Live Preview HTML ────────────────────────────────────────────────────────

const buildPreviewHTML = (d: ResumeData): string => {
  const fullName = `${d.firstName} ${d.lastName}`.trim() || "Your Name";

  const contactParts = [d.email, d.phone, d.location].filter(Boolean).join(" • ");
  const linkParts = [
    d.linkedin ? `<a href="${d.linkedin}" style="color:#1a73e8">LinkedIn</a>` : "",
    d.github ? `<a href="${d.github}" style="color:#1a73e8">GitHub</a>` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  const expHTML = d.experience
    .filter((e) => e.company || e.role)
    .map(
      (e) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong style="font-size:13px">${e.role || "Role"}</strong>
        <span style="font-size:11px;color:#555">${e.duration}</span>
      </div>
      <div style="font-size:12px;color:#444;margin-bottom:4px">${e.company}</div>
      ${
        e.bullets
          ? `<ul style="margin:0;padding-left:16px;font-size:12px;color:#333;line-height:1.6">
          ${e.bullets
            .split("\n")
            .filter(Boolean)
            .map((b) => `<li>${b.replace(/^[-•]\s*/, "")}</li>`)
            .join("")}
        </ul>`
          : ""
      }
    </div>`
    )
    .join("");

  const eduHTML = d.education
    .filter((e) => e.institution || e.degree)
    .map(
      (e) => `
    <div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong style="font-size:13px">${e.degree || "Degree"}</strong>
        <span style="font-size:11px;color:#555">${e.year}</span>
      </div>
      <div style="font-size:12px;color:#444">${e.institution}${e.gpa ? ` — GPA: ${e.gpa}` : ""}</div>
    </div>`
    )
    .join("");

  const projHTML = d.projects
    .filter((p) => p.name || p.description)
    .map(
      (p) => `
    <div style="margin-bottom:8px">
      <strong style="font-size:13px">${p.name}${p.tech ? ` <span style="font-weight:normal;color:#555;font-size:11px">— ${p.tech}</span>` : ""}</strong>
      <div style="font-size:12px;color:#333;margin-top:2px">${p.description}</div>
    </div>`
    )
    .join("");

  const section = (title: string, content: string) =>
    content.trim()
      ? `<div style="margin-bottom:14px">
          <div style="border-bottom:1.5px solid #E8272B;margin-bottom:6px;padding-bottom:2px">
            <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#E8272B">${title}</span>
          </div>
          ${content}
        </div>`
      : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; font-size: 13px; color: #1a1a1a; background: white; }
    a { color: #1a73e8; text-decoration: none; }
  </style>
  </head><body style="padding:32px 36px;max-width:794px;margin:0 auto">
    <div style="text-align:center;margin-bottom:16px">
      <h1 style="font-size:22px;font-weight:700;letter-spacing:0.03em;color:#111">${fullName}</h1>
      ${contactParts ? `<div style="font-size:11.5px;color:#444;margin-top:4px">${contactParts}</div>` : ""}
      ${linkParts ? `<div style="font-size:11.5px;margin-top:2px">${linkParts}</div>` : ""}
    </div>
    ${section("Professional Summary", d.summary ? `<p style="font-size:12.5px;color:#333;line-height:1.55">${d.summary}</p>` : "")}
    ${section("Experience", expHTML)}
    ${section("Education", eduHTML)}
    ${section("Skills", d.skills ? `<p style="font-size:12px;color:#333;line-height:1.6">${d.skills}</p>` : "")}
    ${section("Projects", projHTML)}
  </body></html>`;
};

// ── Main Component ───────────────────────────────────────────────────────────

interface Props {
  jobTitle?: string;
}

const ResumeBuilder = ({ jobTitle = "" }: Props) => {
  const { toast } = useToast();
  const [data, setData] = useState<ResumeData>(DEFAULT_DATA);
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const previewRef = useRef<HTMLIFrameElement>(null);

  const set = (key: keyof ResumeData, value: unknown) =>
    setData((d) => ({ ...d, [key]: value }));

  // ── AI helpers ─────────────────────────────────────────────────────────────

  const setLoading = (key: string, v: boolean) =>
    setAiLoading((p) => ({ ...p, [key]: v }));

  const enhance = async (
    loadKey: string,
    sectionName: string,
    content: string,
    onResult: (v: string) => void
  ) => {
    if (!content.trim()) {
      toast({ title: "Nothing to enhance", description: "Add some content first", variant: "destructive" });
      return;
    }
    setLoading(loadKey, true);
    try {
      const { improved_content } = await improveResumeSection(sectionName, content, jobTitle || "Software Engineer");
      onResult(improved_content);
      toast({ title: "✨ Enhanced!", description: "AI improved your content" });
    } catch (e) {
      toast({ title: "Enhancement failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(loadKey, false);
    }
  };

  const generate = async (
    loadKey: string,
    sectionName: string,
    context: string,
    onResult: (v: string) => void
  ) => {
    setLoading(loadKey, true);
    try {
      const { generated_content } = await generateResumeSection(sectionName, context, jobTitle || "Software Engineer");
      onResult(generated_content);
      toast({ title: "🤖 Generated!", description: "AI wrote your content" });
    } catch (e) {
      toast({ title: "Generation failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(loadKey, false);
    }
  };

  // ── Work experience helpers ────────────────────────────────────────────────

  const addExp = () =>
    set("experience", [...data.experience, { id: uid(), company: "", role: "", duration: "", bullets: "" }]);
  const removeExp = (id: string) =>
    set("experience", data.experience.filter((e) => e.id !== id));
  const updateExp = (id: string, field: keyof WorkEntry, val: string) =>
    set(
      "experience",
      data.experience.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    );

  // ── Education helpers ──────────────────────────────────────────────────────

  const addEdu = () =>
    set("education", [...data.education, { id: uid(), institution: "", degree: "", year: "", gpa: "" }]);
  const removeEdu = (id: string) =>
    set("education", data.education.filter((e) => e.id !== id));
  const updateEdu = (id: string, field: keyof EduEntry, val: string) =>
    set(
      "education",
      data.education.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    );

  // ── Project helpers ────────────────────────────────────────────────────────

  const addProj = () =>
    set("projects", [...data.projects, { id: uid(), name: "", tech: "", description: "" }]);
  const removeProj = (id: string) =>
    set("projects", data.projects.filter((p) => p.id !== id));
  const updateProj = (id: string, field: keyof ProjectEntry, val: string) =>
    set(
      "projects",
      data.projects.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );

  // ── PDF Download ───────────────────────────────────────────────────────────

  const downloadPDF = () => {
    const html = buildPreviewHTML(data);
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow popups for PDF download", variant: "destructive" });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const previewHTML = buildPreviewHTML(data);

  return (
    <div className="grid md:grid-cols-[420px_1fr] gap-0 h-[680px] rounded-xl overflow-hidden border border-border">
      {/* ── Editor Panel ─────────────────────────────────────────────────── */}
      <div className="overflow-y-auto bg-[#0a0a0a] border-r border-border p-4 space-y-3">
        <div className="flex items-center justify-between sticky top-0 bg-[#0a0a0a] py-1 z-10 pb-3 border-b border-border mb-1">
          <p className="text-sm font-bold text-foreground">📝 Resume Editor</p>
          {jobTitle && (
            <span className="text-xs text-baymax-red bg-baymax-red/10 px-2 py-0.5 rounded-full">
              {jobTitle}
            </span>
          )}
        </div>

        {/* Contact Info */}
        <Accordion title="📇 Contact Information" defaultOpen={true}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>First Name</Label>
              <input className={inp} placeholder="John" value={data.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </div>
            <div>
              <Label>Last Name</Label>
              <input className={inp} placeholder="Doe" value={data.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <input className={inp} placeholder="john@example.com" value={data.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Phone</Label>
              <input className={inp} placeholder="+92 300 0000000" value={data.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <Label>Location</Label>
              <input className={inp} placeholder="Lahore, PK" value={data.location} onChange={(e) => set("location", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>LinkedIn URL</Label>
            <input className={inp} placeholder="linkedin.com/in/johndoe" value={data.linkedin} onChange={(e) => set("linkedin", e.target.value)} />
          </div>
          <div>
            <Label>GitHub URL</Label>
            <input className={inp} placeholder="github.com/johndoe" value={data.github} onChange={(e) => set("github", e.target.value)} />
          </div>
        </Accordion>

        {/* Professional Summary */}
        <Accordion title="📋 Professional Summary" defaultOpen={true}>
          <div className="flex gap-2 mb-2">
            <AIButton
              label="✨ Enhance"
              loading={!!aiLoading["summary-enhance"]}
              onClick={() =>
                enhance("summary-enhance", "Professional Summary", data.summary, (v) => set("summary", v))
              }
            />
            <AIButton
              label="🤖 Generate"
              loading={!!aiLoading["summary-generate"]}
              variant="generate"
              onClick={() =>
                generate(
                  "summary-generate",
                  "Professional Summary",
                  `Name: ${data.firstName} ${data.lastName}, Target role: ${jobTitle || "Software Engineer"}`,
                  (v) => set("summary", v)
                )
              }
            />
          </div>
          <textarea
            className={ta}
            rows={4}
            placeholder="Write 2-3 sentences about your experience, skills, and what you bring to the target role..."
            value={data.summary}
            onChange={(e) => set("summary", e.target.value)}
          />
        </Accordion>

        {/* Work Experience */}
        <Accordion title="💼 Work Experience" defaultOpen={true}>
          {data.experience.map((exp, idx) => (
            <div key={exp.id} className="space-y-2 pb-3 border-b border-border last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Position {idx + 1}</span>
                {data.experience.length > 1 && (
                  <button onClick={() => removeExp(exp.id)} className="text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Company</Label>
                  <input className={inp} placeholder="Acme Corp" value={exp.company} onChange={(e) => updateExp(exp.id, "company", e.target.value)} />
                </div>
                <div>
                  <Label>Duration</Label>
                  <input className={inp} placeholder="Jun 2022 – Present" value={exp.duration} onChange={(e) => updateExp(exp.id, "duration", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Role / Title</Label>
                <input className={inp} placeholder="Software Engineer" value={exp.role} onChange={(e) => updateExp(exp.id, "role", e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Bullet Points (one per line)</Label>
                  <AIButton
                    label="✨ Enhance"
                    loading={!!aiLoading[`exp-enhance-${exp.id}`]}
                    onClick={() =>
                      enhance(`exp-enhance-${exp.id}`, `Work Experience at ${exp.company}`, exp.bullets, (v) =>
                        updateExp(exp.id, "bullets", v)
                      )
                    }
                  />
                </div>
                <textarea
                  className={ta}
                  rows={3}
                  placeholder="- Built REST APIs serving 10k+ users&#10;- Reduced load time by 40% via caching&#10;- Led team of 3 engineers..."
                  value={exp.bullets}
                  onChange={(e) => updateExp(exp.id, "bullets", e.target.value)}
                />
              </div>
            </div>
          ))}
          <button
            onClick={addExp}
            className="flex items-center gap-1.5 text-xs text-baymax-red hover:text-baymax-red-light transition-colors font-bold mt-1"
          >
            <Plus size={13} /> Add Position
          </button>
        </Accordion>

        {/* Education */}
        <Accordion title="🎓 Education">
          {data.education.map((edu, idx) => (
            <div key={edu.id} className="space-y-2 pb-3 border-b border-border last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Entry {idx + 1}</span>
                {data.education.length > 1 && (
                  <button onClick={() => removeEdu(edu.id)} className="text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div>
                <Label>Institution</Label>
                <input className={inp} placeholder="FAST-NUCES" value={edu.institution} onChange={(e) => updateEdu(edu.id, "institution", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Degree</Label>
                  <input className={inp} placeholder="BS Computer Science" value={edu.degree} onChange={(e) => updateEdu(edu.id, "degree", e.target.value)} />
                </div>
                <div>
                  <Label>Graduation Year</Label>
                  <input className={inp} placeholder="2024" value={edu.year} onChange={(e) => updateEdu(edu.id, "year", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>GPA (optional)</Label>
                <input className={inp} placeholder="3.8 / 4.0" value={edu.gpa} onChange={(e) => updateEdu(edu.id, "gpa", e.target.value)} />
              </div>
            </div>
          ))}
          <button
            onClick={addEdu}
            className="flex items-center gap-1.5 text-xs text-baymax-red hover:text-baymax-red-light transition-colors font-bold mt-1"
          >
            <Plus size={13} /> Add Education
          </button>
        </Accordion>

        {/* Skills */}
        <Accordion title="⚡ Skills">
          <div className="flex items-center justify-between mb-1">
            <Label>Skills (comma-separated or by category)</Label>
            <AIButton
              label="✨ Enhance"
              loading={!!aiLoading["skills-enhance"]}
              onClick={() =>
                enhance("skills-enhance", "Skills", data.skills, (v) => set("skills", v))
              }
            />
          </div>
          <textarea
            className={ta}
            rows={3}
            placeholder="Languages: Python, JavaScript, TypeScript&#10;Frameworks: React, FastAPI, Node.js&#10;Tools: Docker, Git, AWS"
            value={data.skills}
            onChange={(e) => set("skills", e.target.value)}
          />
        </Accordion>

        {/* Projects */}
        <Accordion title="🚀 Projects">
          {data.projects.map((proj, idx) => (
            <div key={proj.id} className="space-y-2 pb-3 border-b border-border last:border-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">Project {idx + 1}</span>
                {data.projects.length > 1 && (
                  <button onClick={() => removeProj(proj.id)} className="text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Project Name</Label>
                  <input className={inp} placeholder="Baymax AI" value={proj.name} onChange={(e) => updateProj(proj.id, "name", e.target.value)} />
                </div>
                <div>
                  <Label>Tech Stack</Label>
                  <input className={inp} placeholder="React, Python, LLM" value={proj.tech} onChange={(e) => updateProj(proj.id, "tech", e.target.value)} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Description</Label>
                  <AIButton
                    label="✨ Enhance"
                    loading={!!aiLoading[`proj-enhance-${proj.id}`]}
                    onClick={() =>
                      enhance(`proj-enhance-${proj.id}`, `Project: ${proj.name}`, proj.description, (v) =>
                        updateProj(proj.id, "description", v)
                      )
                    }
                  />
                </div>
                <textarea
                  className={ta}
                  rows={2}
                  placeholder="Built a full-stack AI career assistant that..."
                  value={proj.description}
                  onChange={(e) => updateProj(proj.id, "description", e.target.value)}
                />
              </div>
            </div>
          ))}
          <button
            onClick={addProj}
            className="flex items-center gap-1.5 text-xs text-baymax-red hover:text-baymax-red-light transition-colors font-bold mt-1"
          >
            <Plus size={13} /> Add Project
          </button>
        </Accordion>

        {/* Download */}
        <button
          onClick={downloadPDF}
          className="w-full bg-baymax-red text-foreground font-syne font-bold py-3 rounded-lg btn-red-glow transition-all flex items-center justify-center gap-2"
        >
          <Download size={16} /> Download as PDF
        </button>
      </div>

      {/* ── Live Preview Panel ────────────────────────────────────────────── */}
      <div className="bg-[#f0f0f0] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#e0e0e0] border-b border-gray-300">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Live Preview</span>
          <span className="text-xs text-gray-400">A4 · ATS-Friendly</span>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <div
            className="bg-white shadow-lg mx-auto"
            style={{
              width: "100%",
              maxWidth: "720px",
              minHeight: "960px",
              fontFamily: "Georgia, serif",
            }}
            dangerouslySetInnerHTML={{ __html: previewHTML.replace(/<!DOCTYPE html>.*?<body[^>]*>/s, "").replace(/<\/body>.*$/s, "") }}
          />
        </div>
      </div>
    </div>
  );
};

export default ResumeBuilder;
