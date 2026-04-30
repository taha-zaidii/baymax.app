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
  Code2, Layers, Upload, FileText, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { extractResume, parseResumeStructured } from "@/lib/api";
import type { ParsedResume } from "@/lib/api";

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

import { API_BASE_URL as API_BASE } from "@/lib/api";


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
  const contactParts = [p.email, p.phone, p.location].filter(Boolean);
  const urlPart = p.url ? `<a href="${p.url}" style="color:#000;text-decoration:underline">${p.url.replace(/https?:\/\//, "")}</a>` : "";
  const contactLine = [...contactParts.map(c => `<span>${c}</span>`), urlPart ? `<span>${urlPart}</span>` : ""].filter(Boolean).join('<span style="margin:0 5px;color:#555"> | </span>');

  // Section header: uppercase bold black label + full-width black underline
  const section = (title: string, html: string) => !html.trim() ? "" : `
    <div style="margin-bottom:13px">
      <div style="margin-bottom:4px">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#000">${title}</span>
        <div style="height:1.5px;background:#000;margin-top:2px"></div>
      </div>
      ${html}
    </div>`;

  const expHTML = d.workExperiences
    .filter((e) => e.company || e.jobTitle)
    .map((e) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <strong style="font-size:12px;font-weight:700;color:#000">${e.jobTitle || "Role"}</strong>
          <span style="font-size:10.5px;color:#000;font-style:italic">${e.date}</span>
        </div>
        <div style="font-size:11.5px;color:#000;font-style:italic;margin-bottom:2px">${e.company}</div>
        ${e.descriptions.filter(Boolean).length > 0
          ? `<ul style="margin:3px 0 0;padding-left:16px;font-size:11.5px;color:#000;line-height:1.55">${
              e.descriptions.filter(Boolean).map((d) => `<li style="margin-bottom:1px">${d.replace(/^[-•]\s*/, "")}</li>`).join("")
            }</ul>`
          : ""}
      </div>`).join("");

  const eduHTML = d.educations
    .filter((e) => e.school || e.degree)
    .map((e) => `
      <div style="margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <strong style="font-size:12px;font-weight:700;color:#000">${e.degree || "Degree"}</strong>
          <span style="font-size:10.5px;color:#000;font-style:italic">${e.date}</span>
        </div>
        <div style="font-size:11.5px;color:#000">${e.school}${e.gpa ? `<span style="margin-left:8px;color:#333"> GPA: ${e.gpa}</span>` : ""}</div>
      </div>`).join("");

  const projHTML = d.projects
    .filter((p) => p.project || p.descriptions.some(Boolean))
    .map((p) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <strong style="font-size:12px;font-weight:700;color:#000">${p.project || "Project"}</strong>
          <span style="font-size:10.5px;color:#000;font-style:italic">${p.date}</span>
        </div>
        ${p.descriptions.filter(Boolean).length > 0
          ? `<ul style="margin:3px 0 0;padding-left:16px;font-size:11.5px;color:#000;line-height:1.55">${
              p.descriptions.filter(Boolean).map((d) => `<li style="margin-bottom:1px">${d.replace(/^[-•]\s*/, "")}</li>`).join("")
            }</ul>`
          : ""}
      </div>`).join("");

  const skillsHTML = d.skills.descriptions.filter(Boolean).join(" • ");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif;
    font-size: 12px;
    color: #000;
    background: white;
    padding: 36px 44px;
    max-width: 816px;
    margin: auto;
    line-height: 1.4;
  }
  h1 { color: #000; }
  a { color: #000; }
  ul { list-style-type: disc; }
  li { color: #000; }
</style></head>
<body>

  <!-- Header -->
  <div style="text-align:center;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #000">
    <h1 style="font-size:24px;font-weight:700;letter-spacing:0.04em;color:#000;text-transform:uppercase">${name}</h1>
    ${contactLine ? `<div style="font-size:10.5px;color:#000;margin-top:5px;line-height:1.6">${contactLine}</div>` : ""}
  </div>

  ${section("Summary", p.summary ? `<p style="font-size:11.5px;color:#000;line-height:1.55;text-align:justify">${p.summary}</p>` : "")}
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
  onProceedToAnalysis?: () => void;
}

// Job title keywords (adapted from open-resume's list)
const JOB_TITLE_WORDS = new Set([
  "accountant","administrator","advisor","agent","analyst","apprentice","architect",
  "assistant","associate","auditor","bartender","biologist","bookkeeper","buyer",
  "carpenter","cashier","ceo","clerk","co-op","co-founder","consultant","coordinator",
  "cto","developer","designer","director","driver","editor","electrician","engineer",
  "extern","founder","freelancer","head","intern","janitor","journalist","lead",
  "manager","mechanic","member","nurse","officer","operator","photographer","president",
  "producer","recruiter","representative","researcher","scientist","specialist",
  "supervisor","teacher","technician","trader","trainee","treasurer","tutor",
  "vice","vp","volunteer","webmaster","worker","developer","programmer","devops",
]);

const hasJobTitleWord = (line: string) =>
  line.toLowerCase().split(/\W+/).some((w) => JOB_TITLE_WORDS.has(w));

/**
 * Parse raw resume text into a ResumeState.
 * Handles most common resume formats used in Pakistan and globally.
 * Inspired by open-resume's feature-scoring approach.
 */
function textToResumeState(text: string): { state: ResumeState; isRaw: boolean } {
  // Preserve blank lines as subsection separators
  const rawLines = text.split("\n").map((l) => l.trim());
  const allLines = rawLines.filter(Boolean);

  const state: ResumeState = {
    profile: { name: "", email: "", phone: "", location: "", url: "", summary: "" },
    workExperiences: [],
    projects: [],
    educations: [],
    skills: { descriptions: [] },
  };

  // ── 1. Contact info ───────────────────────────────────────────────────────
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) state.profile.email = emailMatch[0];

  const phoneMatch = text.match(
    /(\+92|0092|0)[\s-]?\d{3}[\s-]?\d{7}|\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/
  );
  if (phoneMatch) state.profile.phone = phoneMatch[0];

  const urlMatch = text.match(
    /https?:\/\/[^\s,)\]]+|linkedin\.com\/in\/[^\s,)\]]+|github\.com\/[^\s,)\]]+/
  );
  if (urlMatch) state.profile.url = urlMatch[0].replace(/[.,;)\]]+$/, "");

  // Name = first short line that isn't contact info
  for (const line of allLines.slice(0, 8)) {
    if (/[@]|linkedin|github|https?:\/\//i.test(line)) continue;
    if (/(\+92|0092|\+1|00[1-9])/.test(line)) continue;
    if (/\d{6,}/.test(line)) continue;            // phone numbers
    if (line.length < 2 || line.length > 70) continue;
    const wc = line.trim().split(/\s+/).length;
    if (wc >= 1 && wc <= 6) { state.profile.name = line; break; }
  }

  // ── 2. Patterns ───────────────────────────────────────────────────────────
  const DATE_RE      = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z']*[\s.,]+\d{2,4}|\b\d{4}\s*[-–—to]+\s*(\d{2,4}|present|current|now)/i;
  const YEAR_RE      = /\b(20|19)\d{2}\b/;
  const BULLET_RE    = /^[•\-*\u2013\u2022\u25CF➤➢▶►→◆■]\s+|^\d+[.)]\s+\S/;
  const PIPE_RE      = /\s*\|\s*/;

  const hasDate = (s: string) => DATE_RE.test(s) || YEAR_RE.test(s);
  const isBullet = (s: string) => BULLET_RE.test(s);
  const cleanBullet = (s: string) => s.replace(/^[•\-*\u2013\u2022\u25CF➤➢▶►→◆■]\s*/, "")
                                      .replace(/^\d+[.)]\s+/, "").trim();

  // ── 3. Section split (preserve blank lines between subsections) ───────────
  const SECTION_HDR = /^(summary|objective|profile|about|experience|work|employment|education|skills|technical|projects|certifications?|courses?|awards?|languages?|interests?|references?)/i;

  const sections: Record<string, string[]> = { intro: [] };
  let curSec = "intro";

  for (const line of rawLines) {
    if (line === "") {
      // Blank lines preserved as separator inside section
      if (sections[curSec]?.length) sections[curSec].push("");
      continue;
    }
    if (SECTION_HDR.test(line) && line.length < 60) {
      // Normalize key: "Work Experience" → "experience", "Technical Skills" → "skills"
      const key = line.toLowerCase()
        .replace(/work\s+|professional\s+|technical\s+|personal\s+|academic\s+/g, "")
        .replace(/[^a-z\s]/g, "").trim().split(/\s+/)[0];
      curSec = key;
      sections[curSec] = sections[curSec] ?? [];
    } else {
      sections[curSec] = sections[curSec] ?? [];
      sections[curSec].push(line);
    }
  }

  // ── 4. Summary ────────────────────────────────────────────────────────────
  const summaryLines = sections["summary"] ?? sections["objective"] ?? sections["profile"] ?? sections["about"] ?? [];
  if (summaryLines.length) {
    state.profile.summary = summaryLines.filter(Boolean).join(" ").slice(0, 700);
  }

  // ── 5. Skills ─────────────────────────────────────────────────────────────
  const skillRaw = [...(sections["skills"] ?? []), ...(sections["technical"] ?? []), ...(sections["certifications"] ?? [])].filter(Boolean);
  if (skillRaw.length) {
    const combined = skillRaw.join(" | ");
    const items = combined.split(/[,|•·\n\/]/)
      .map((s) => s.replace(/^[\s\-*•:]+/, "").replace(/[\s:]+$/, "").trim())
      .filter((s) => s.length > 1 && s.length < 80 && !/^(languages?|frameworks?|tools?|databases?|skills?):?$/i.test(s));
    state.skills.descriptions = [...new Set(items)].slice(0, 14);
  }

  // ── 6. Work Experience ────────────────────────────────────────────────────
  /**
   * Strategy (inspired by open-resume):
   * 1. Split section into blank-line-separated subsections (one subsection = one job)
   * 2. Within each subsection, the first N non-bullet short lines are header info
   * 3. Use feature scoring: date > job-title-word > company (what remains)
   * 4. After header lines, everything is descriptions
   */
  const expLines = sections["experience"] ?? sections["employment"] ?? [];

  if (expLines.length) {
    // Split into paragraphs by blank lines
    const paragraphs: string[][] = [];
    let para: string[] = [];
    for (const l of expLines) {
      if (l === "") {
        if (para.length) { paragraphs.push(para); para = []; }
      } else {
        para.push(l);
      }
    }
    if (para.length) paragraphs.push(para);

    // If no blank lines (single block), split by detecting bullet → non-bullet transitions
    const blocks = paragraphs.length > 1 ? paragraphs : splitExpByBulletTransition(expLines.filter(Boolean), isBullet, hasDate);

    for (const block of blocks) {
      if (!block.length) continue;

      const exp: WorkExp = { id: uid(), company: "", jobTitle: "", date: "", descriptions: [] };
      let headerDone = false;
      const headerLines: string[] = [];

      for (const line of block) {
        if (!headerDone && !isBullet(line) && line.length < 110 && headerLines.length < 4) {
          headerLines.push(line);
        } else {
          headerDone = true;
          const cleaned = cleanBullet(line);
          if (cleaned.length > 2) exp.descriptions.push(cleaned);
        }
      }

      // Score header lines → date / jobTitle / company
      let dateLineIdx = -1;
      let jobTitleIdx = -1;

      for (let i = 0; i < headerLines.length; i++) {
        const h = headerLines[i];
        if (dateLineIdx === -1 && hasDate(h)) dateLineIdx = i;
        if (jobTitleIdx === -1 && hasJobTitleWord(h) && !hasDate(h)) jobTitleIdx = i;
      }

      // Extract date
      if (dateLineIdx !== -1) {
        const dline = headerLines[dateLineIdx];
        const dm = dline.match(/(\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z']*[\s.,]+\d{2,4}|\b\d{4})\s*[-–—to]+\s*(\d{2,4}|present|current|now)/i);
        exp.date = dm ? dm[0] : (dline.match(YEAR_RE) ?? [""])[0];
        // If the date line also has a pipe-separated title/company, parse it
        const remainder = dline.replace(DATE_RE, "").replace(YEAR_RE, "").replace(/[-–—|,\s]+/g, " ").trim();
        if (remainder.length > 2 && PIPE_RE.test(dline)) {
          const parts = dline.split(PIPE_RE).map(s => s.trim()).filter(Boolean);
          // Find the non-date parts
          const nonDate = parts.filter(p => !hasDate(p) && p.length > 1);
          if (nonDate.length >= 2) { exp.jobTitle = nonDate[0]; exp.company = nonDate[1]; }
          else if (nonDate.length === 1) {
            if (hasJobTitleWord(nonDate[0])) exp.jobTitle = nonDate[0];
            else exp.company = nonDate[0];
          }
          // Clear other header lines if we already extracted from the date line
          headerLines.splice(dateLineIdx, 1);
          jobTitleIdx = -1; // reset — we might have already assigned it
        } else {
          headerLines.splice(dateLineIdx, 1);
          if (jobTitleIdx > dateLineIdx) jobTitleIdx--;
        }
      }

      // Assign jobTitle & company from remaining header lines
      if (!exp.jobTitle && !exp.company) {
        const rem = headerLines.filter(h => h.trim().length > 0);

        if (rem.length >= 2) {
          // Determine which is company vs job title
          const firstHasTitle = hasJobTitleWord(rem[0]);
          const secondHasTitle = hasJobTitleWord(rem[1]);
          if (firstHasTitle && !secondHasTitle) {
            exp.jobTitle = rem[0]; exp.company = rem[1];
          } else if (!firstHasTitle && secondHasTitle) {
            exp.company = rem[0]; exp.jobTitle = rem[1];
          } else {
            // Default: first = title, second = company (most common format)
            exp.jobTitle = rem[0]; exp.company = rem[1];
          }
          // Handle inline pipe separators in the company line
          if (exp.company && PIPE_RE.test(exp.company)) {
            exp.company = exp.company.split(PIPE_RE)[0].trim();
          }
        } else if (rem.length === 1) {
          const line = rem[0];
          if (/ at | @ /i.test(line)) {
            const [a, b] = line.split(/ at | @ /i);
            exp.jobTitle = a.trim(); exp.company = b?.trim() ?? "";
          } else if (PIPE_RE.test(line)) {
            const parts = line.split(PIPE_RE).map(s => s.trim()).filter(Boolean);
            exp.jobTitle = parts[0]; exp.company = parts[1] ?? "";
          } else if (hasJobTitleWord(line)) {
            exp.jobTitle = line;
          } else {
            exp.company = line;
          }
        }
      }

      if (exp.jobTitle || exp.company || exp.descriptions.length) {
        state.workExperiences.push(exp);
      }
    }
  }
  if (state.workExperiences.length === 0) state.workExperiences.push(defaultExp());

  // ── 7. Education ──────────────────────────────────────────────────────────
  const eduLines = sections["education"] ?? sections["academic"] ?? [];

  if (eduLines.length) {
    const eduBlocks: string[][] = [];
    let ep: string[] = [];
    for (const l of eduLines) {
      if (l === "") { if (ep.length) { eduBlocks.push(ep); ep = []; } }
      else ep.push(l);
    }
    if (ep.length) eduBlocks.push(ep);
    if (eduBlocks.length === 0) eduBlocks.push(eduLines.filter(Boolean));

    for (const block of eduBlocks) {
      if (!block.length) continue;
      const edu = defaultEdu();

      // Check if it's a pipe-separated single line: "Degree | School | Date | GPA"
      if (block.length === 1 && PIPE_RE.test(block[0])) {
        const parts = block[0].split(PIPE_RE).map(s => s.trim());
        for (const part of parts) {
          if (/gpa|cgpa/i.test(part)) {
            edu.gpa = (part.match(/[\d.]+\/[\d.]+|[\d.]+/) ?? [""])[0];
          } else if (hasDate(part) || YEAR_RE.test(part)) {
            const years = part.match(/\b(20|19)\d{2}\b/g) ?? [];
            edu.date = years.join(" – ");
          } else if (/university|college|institute|FAST|NUST|LUMS|COMSATS|UET|IBA|NED|GIK|GIKI|AKU|BNU|PIEAS/i.test(part)) {
            edu.school = part;
          } else if (!edu.degree && part.length > 3) {
            edu.degree = part;
          }
        }
      } else {
        // Multi-line block
        const dateIdx = block.findIndex(h => hasDate(h));
        if (dateIdx !== -1) {
          const years = block[dateIdx].match(/\b(20|19)\d{2}\b/g) ?? [];
          edu.date = years.join(" – ");
          const gpaLine = block.find(l => /gpa|cgpa/i.test(l));
          if (gpaLine) edu.gpa = (gpaLine.match(/[\d.]+\/[\d.]+|[\d.]+/) ?? [""])[0];
          const nonDate = block.filter((_, i) => i !== dateIdx && !/gpa|cgpa/i.test(block[i]));
          edu.degree = nonDate[0] ?? "";
          edu.school = nonDate[1] ?? "";
          // If the date line also has pipe-separated info
          if (PIPE_RE.test(block[dateIdx])) {
            const parts = block[dateIdx].split(PIPE_RE).map(s => s.trim());
            const noDt = parts.filter(p => !hasDate(p) && !/gpa|cgpa/i.test(p) && p.length > 1);
            if (noDt.length && !edu.degree) edu.degree = noDt[0];
            if (noDt.length > 1 && !edu.school) edu.school = noDt[1];
          }
        } else {
          edu.degree = block[0] ?? "";
          edu.school = block[1] ?? "";
        }
      }

      if (edu.degree || edu.school) state.educations.push(edu);
    }
  }
  if (state.educations.length === 0) state.educations.push(defaultEdu());

  // ── 8. Projects ───────────────────────────────────────────────────────────
  const projLines = sections["projects"] ?? [];
  if (projLines.length) {
    let curP: Project | null = null;
    for (const line of projLines.filter(Boolean)) {
      if (!isBullet(line) && line.length < 100) {
        if (curP) state.projects.push(curP);
        curP = { id: uid(), project: line, date: "", descriptions: [] };
      } else if (curP) {
        const c = cleanBullet(line);
        if (c.length > 2) curP.descriptions.push(c);
      }
    }
    if (curP) state.projects.push(curP);
  }
  if (state.projects.length === 0) state.projects.push(defaultProj());

  // ── 9. Quality check — LENIENT ────────────────────────────────────────────
  // Only fall back to raw mode if we literally couldn't find ANY identifying info.
  // If we found contact info, show the builder (user can fix fields manually).
  const meaningful = !!(state.profile.name || state.profile.email || state.profile.phone);

  return { state, isRaw: !meaningful };
}

// ── Structured-parse → ResumeState mapper ─────────────────────────────────
// The backend hands back already-classified bullet lists per section. The
// builder needs to bucket those bullets back into individual jobs / projects /
// education entries, since each one is rendered as its own card.

function isStateEmpty(s: ResumeState): boolean {
  if (s.profile.name || s.profile.email || s.profile.phone) return false;
  if (s.workExperiences.some(e => e.company || e.jobTitle || e.descriptions.some(Boolean))) return false;
  if (s.educations.some(e => e.school || e.degree)) return false;
  if (s.projects.some(p => p.project || p.descriptions.some(Boolean))) return false;
  if (s.skills.descriptions.filter(Boolean).length) return false;
  return true;
}

function parsedResumeToState(parsed: ParsedResume): ResumeState {
  const profile: Profile = {
    name: parsed.profile?.name ?? "",
    email: parsed.profile?.email ?? "",
    phone: parsed.profile?.phone ?? "",
    location: "",
    url: parsed.profile?.linkedin || parsed.profile?.github || "",
    summary: parsed.summary ?? "",
  };

  // Group consecutive bullet entries under the previous header line. A "header"
  // is a short-ish line with no leading bullet character — typically the role
  // or company line. The first sub-line that contains a date sequence becomes
  // the entry's date.
  const groupBullets = <T,>(
    bullets: string[],
    factory: (header: string, date: string, body: string[]) => T,
  ): T[] => {
    const out: T[] = [];
    let header = "";
    let date = "";
    let body: string[] = [];
    const flush = () => {
      if (header || body.length) out.push(factory(header, date, body));
      header = ""; date = ""; body = [];
    };
    const dateRe = /\b(20|19)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
    for (const raw of bullets) {
      const line = raw.trim();
      if (!line) continue;
      const looksLikeHeader = line.length < 110 && !line.startsWith("- ") && !/^•/.test(line);
      if (looksLikeHeader && (header || body.length)) {
        flush();
        header = line;
      } else if (!header) {
        header = line;
      } else {
        body.push(line);
      }
      // Sniff a date anywhere in the line and remember the first one.
      if (!date) {
        const m = line.match(/\b(20|19)\d{2}\b\s*[-–—to]+\s*(20|19)?\d{2,4}|\b(20|19)\d{2}\b/);
        if (m) date = m[0];
      }
      if (line.length > 110 && header && !body.length) {
        // Long first line is more likely a description than a header.
        body.push(line);
      }
      // Treat lines that are clearly a date label as the entry's date too.
      if (dateRe.test(line) && line.length < 30 && !date) date = line;
    }
    flush();
    return out;
  };

  const workExperiences: WorkExp[] = groupBullets(
    parsed.experience ?? [],
    (header, date, body) => {
      // Header is often "Role, Company (Date)" — split on the first comma.
      const [roleOrCompany, ...rest] = header.split(/[,|]/);
      const exp = defaultExp();
      exp.jobTitle = (roleOrCompany || "").trim();
      exp.company = rest.join(",").replace(/\(.*?\)/, "").trim();
      exp.date = date;
      exp.descriptions = body.length ? body : [""];
      return exp;
    },
  );

  const educations: Education[] = groupBullets(
    parsed.education ?? [],
    (header, date, body) => {
      const edu = defaultEdu();
      const parts = header.split(/[,|]/).map(s => s.trim()).filter(Boolean);
      edu.degree = parts[0] || header;
      edu.school = parts.slice(1).join(", ");
      edu.date = date;
      // Pull GPA out of body if present.
      const gpaLine = body.find(b => /gpa|cgpa/i.test(b));
      if (gpaLine) edu.gpa = (gpaLine.match(/[\d.]+\/[\d.]+|[\d.]+/) ?? [""])[0];
      edu.descriptions = body.filter(b => b !== gpaLine);
      return edu;
    },
  );

  const projects: Project[] = groupBullets(
    parsed.projects ?? [],
    (header, date, body) => {
      const proj = defaultProj();
      proj.project = header;
      proj.date = date;
      proj.descriptions = body.length ? body : [""];
      return proj;
    },
  );

  return {
    profile,
    workExperiences: workExperiences.length ? workExperiences : [defaultExp()],
    educations:      educations.length      ? educations      : [defaultEdu()],
    projects:        projects.length        ? projects        : [defaultProj()],
    skills:          { descriptions: (parsed.skills ?? []).filter(Boolean).slice(0, 30) },
  };
}


/** Fallback: split a flat experience block by detecting bullet→non-bullet transitions */
function splitExpByBulletTransition(
  lines: string[],
  isBullet: (s: string) => boolean,
  hasDate: (s: string) => boolean,
): string[][] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  let inBullets = false;

  for (const line of lines) {
    const bullet = isBullet(line);
    if (inBullets && !bullet && line.length < 100) {
      // Transition out of bullets → new job starts
      if (cur.length) blocks.push(cur);
      cur = [line];
      inBullets = false;
    } else {
      cur.push(line);
      if (bullet) inBullets = true;
      else if (hasDate(line)) inBullets = false;
    }
  }
  if (cur.length) blocks.push(cur);
  return blocks.length ? blocks : [lines];
}




const ResumeBuilder = ({ jobTitle = "", onResumeTextChange, onProceedToAnalysis }: Props) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"build" | "upload">("build");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [rawResumeText, setRawResumeText] = useState("");
  const [isRawMode, setIsRawMode] = useState(false);
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

  // ── PDF Upload & Parse ──────────────────────────────────────────────────────
  // Strategy:
  //   1. Try the backend's structural parser first (heuristic, deterministic,
  //      already split into profile/summary/sections).
  //   2. If that fails or returns thin output, fall back to /extract-resume +
  //      the in-component textToResumeState() heuristics.
  //   3. If both fail to find any structure, drop into the raw-text editor.

  const handlePdfUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      let mappedState: ResumeState | null = null;
      let rawText = "";

      try {
        const res = await parseResumeStructured(file);
        rawText = res.extracted_text || "";
        mappedState = parsedResumeToState(res.parsed);
      } catch {
        // Backend structured parse failed — fall through to plain extraction.
      }

      // If the structured parse was empty, fall back to the heuristic JS parser.
      if (!mappedState || isStateEmpty(mappedState)) {
        const fallback = await extractResume(file);
        rawText = fallback.extracted_text || rawText;
        const { state, isRaw } = textToResumeState(rawText);
        if (isRaw) {
          setRawResumeText(rawText);
          setIsRawMode(true);
          onResumeTextChange?.(rawText);
          toast({ title: "📄 Parsed (raw mode)", description: "Format unclear — editing raw text." });
          setMode("build");
          return;
        }
        mappedState = state;
      }

      setData(mappedState);
      onResumeTextChange?.(resumeStateToText(mappedState));
      setIsRawMode(false);
      toast({ title: "✅ Resume parsed!", description: "Review and edit any fields below." });
      setMode("build");
    } catch (e) {
      toast({ title: "Upload failed", description: String(e), variant: "destructive" });
    } finally {
      setUploadLoading(false);
    }
  };

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

  // ── Upload Mode UI ──────────────────────────────────────────────────────────

  if (mode === "upload") {
    return (
      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setMode("build")} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-secondary border border-border text-muted-foreground hover:border-baymax-red transition-colors">
            <FileText size={14} /> Build from scratch
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-baymax-red text-white">
            <Upload size={14} /> Upload &amp; Edit
          </button>
        </div>

        <div
          className="rounded-xl flex flex-col items-center justify-center gap-4 py-16 cursor-pointer transition-all"
          style={{ border: "2px dashed #3a3a3a", background: "#0a0a0a" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f?.name.endsWith(".pdf")) handlePdfUpload(f);
          }}
        >
          {uploadLoading ? (
            <>
              <Loader2 size={36} className="animate-spin text-baymax-red" />
              <p className="text-sm text-gray-400">Parsing your resume…</p>
            </>
          ) : (
            <>
              <Upload size={36} className="text-gray-500" />
              <p className="text-sm font-semibold text-gray-300">Drag & drop your PDF here</p>
              <p className="text-xs text-gray-600">or</p>
              <label className="px-5 py-2.5 rounded-lg text-sm font-bold text-white cursor-pointer transition-all"
                style={{ background: "linear-gradient(135deg,#e53e3e,#c53030)", boxShadow: "0 4px 20px rgba(229,62,62,0.35)" }}>
                Browse PDF
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePdfUpload(f);
                }} />
              </label>
              <p className="text-xs text-gray-600">We'll parse it and pre-fill the editor</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Mode Toggle ── */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("build")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
            mode === "build"
              ? "bg-baymax-red text-white border-baymax-red"
              : "bg-secondary border-border text-muted-foreground hover:border-baymax-red"
          }`}
        >
          <FileText size={14} /> Build from Scratch
        </button>
        <button
          onClick={() => setMode("upload")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
            mode !== "build"
              ? "bg-baymax-red text-white border-baymax-red"
              : "bg-secondary border-border text-muted-foreground hover:border-baymax-red"
          }`}
        >
          <Upload size={14} /> Upload &amp; Edit
        </button>
      </div>

      {/* Raw text fallback (after PDF parse fails structure detection) */}
      {isRawMode && (
        <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #92400e" }}>
          <p className="text-xs font-bold text-amber-400 mb-2">⚠️ Raw text mode — PDF structure was unclear. Edit directly:</p>
          <textarea
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-red-500/60 focus:outline-none resize-none"
            rows={12}
            value={rawResumeText}
            onChange={(e) => { setRawResumeText(e.target.value); onResumeTextChange?.(e.target.value); }}
            placeholder="Paste or edit your resume here…"
          />
          <button
            className="mt-2 text-xs text-baymax-red hover:underline"
            onClick={() => { const { state } = textToResumeState(rawResumeText); setData(state); setIsRawMode(false); onResumeTextChange?.(resumeStateToText(state)); }}
          >
            Try structured mode →
          </button>
        </div>
      )}

      {/* Editor + Preview grid — hidden in raw mode */}
      {!isRawMode && (
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
      )} {/* end !isRawMode */}

      {/* ── Proceed to Analysis CTA ── */}
      {onProceedToAnalysis && (
        <button
          onClick={onProceedToAnalysis}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-sm mt-2"
          style={{
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            boxShadow: "0 4px 20px rgba(37,99,235,0.35)",
          }}
        >
          Proceed to Analysis <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
};

export default ResumeBuilder;

