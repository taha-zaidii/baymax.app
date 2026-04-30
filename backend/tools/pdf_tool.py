"""
tools/pdf_tool.py — PDF text extraction + lightweight resume structuring.

Provides two public functions:

    extract_text_from_pdf(path)           -> str
        Plain-text extraction. Tries pypdf first, falls back to PyPDF2.

    extract_structured_resume(path|text)  -> dict
        Heuristic structuring of a resume into {profile, education, experience,
        skills, projects, summary}. The structuring is deliberately
        rule-based — no LLM call — so it is deterministic, free, and instant.
        Coverage is best-effort: we try to recognise the most common section
        headings, and on anything we can't classify we leave the raw lines
        under the previous section. The Resume Builder UI consumes the
        result and shows whatever section was found; users can still edit.
"""

from __future__ import annotations

import os
import re
from typing import Optional


# ──────────────────────────────────────────────────────────────────────────────
# Plain-text extraction (existing public API — kept for backward compat)
# ──────────────────────────────────────────────────────────────────────────────

def extract_text_from_pdf(path: str) -> str:
    """
    Extract all text from a PDF file. Returns a single string with each page
    separated by a newline. Empty string is returned if both backends fail to
    extract any text (an exception is only raised when neither library is
    installed at all).
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"PDF not found: {path}")

    # Modern backend first
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        if text:
            return text
    except ImportError:
        pass
    except Exception:
        pass

    # Legacy backend
    try:
        import PyPDF2
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        if text:
            return text
    except ImportError:
        pass
    except Exception:
        pass

    raise RuntimeError(
        "Could not extract text from PDF. "
        "Ensure pypdf or PyPDF2 is installed and the file is not encrypted."
    )


# ──────────────────────────────────────────────────────────────────────────────
# Heuristic structuring
# ──────────────────────────────────────────────────────────────────────────────
#
# The structurer accepts either a PDF path or raw extracted text. It walks
# line-by-line, classifying each line as either a section heading or content
# belonging to the most recently-opened section. Headings are recognised by
# matching common resume section names (case-insensitive, with or without
# colons / dashes). Anything that doesn't match a heading is appended to the
# current section.
#
# We deliberately keep the heading aliases tight. An over-generous matcher
# would reclassify content lines as headings (e.g. a project bullet "Skills:
# Python, JS" would be treated as a Skills heading). Better to under-match
# and leave content under "summary" than to scramble sections.

# The string keys here are the *canonical* section names returned in the dict.
# The values are the regex alternatives that should map onto that key.
SECTION_ALIASES: dict[str, list[str]] = {
    "summary":    [r"summary", r"professional\s+summary", r"profile", r"objective", r"about\s+me"],
    "education":  [r"education", r"academic\s+background", r"qualifications"],
    "experience": [
        r"experience", r"work\s+experience", r"professional\s+experience",
        r"employment", r"employment\s+history", r"work\s+history",
    ],
    "skills":     [
        r"skills", r"technical\s+skills", r"core\s+skills", r"technologies",
        r"tech\s+stack", r"core\s+competencies",
    ],
    "projects":   [r"projects", r"personal\s+projects", r"academic\s+projects", r"key\s+projects"],
    "certifications": [r"certifications?", r"certificates?"],
    "awards":     [r"awards?", r"honors", r"achievements"],
    "languages":  [r"languages?"],
}

# Pre-compile a single regex per section so heading lookups are cheap.
_SECTION_RE: dict[str, re.Pattern] = {
    name: re.compile(
        # Optional leading bullet/whitespace, the section keyword(s), then
        # an optional colon/dash and end of line. Works on lines like
        #    "EDUCATION", "Education:", "## Experience", "—  Skills  —"
        rf"^[\s\W_]*(?:{'|'.join(aliases)})[\s\W_]*$",
        re.IGNORECASE,
    )
    for name, aliases in SECTION_ALIASES.items()
}

# Recogniser for emails and phone numbers (used to populate `profile`).
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(
    r"(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?){2,4}\d{2,4}"
)
_URL_RE = re.compile(r"https?://[^\s)]+|www\.[^\s)]+|(?:linkedin|github)\.com/[^\s)]+")


def _classify_heading(line: str) -> Optional[str]:
    """Return canonical section name if `line` matches one, else None."""
    stripped = line.strip()
    # Headings are typically short — long lines almost always contain content.
    if not stripped or len(stripped) > 50:
        return None
    for name, regex in _SECTION_RE.items():
        if regex.match(stripped):
            return name
    return None


def _extract_profile(first_lines: list[str]) -> dict:
    """
    From the top of the resume, pluck the candidate's name (typically the
    first non-empty line), email, phone and any social URLs.
    """
    name = ""
    for line in first_lines:
        s = line.strip()
        if not s:
            continue
        # Reject lines that look like contact info — those are not the name.
        if _EMAIL_RE.search(s) or _URL_RE.search(s) or _PHONE_RE.search(s):
            continue
        # Reasonable name length, mostly alphabetic
        if 2 <= len(s) <= 60 and sum(c.isalpha() or c.isspace() for c in s) >= len(s) * 0.7:
            name = s
            break

    blob = "\n".join(first_lines)
    email = (_EMAIL_RE.search(blob) or [None])[0] if _EMAIL_RE.search(blob) else ""
    phone_match = _PHONE_RE.search(blob.replace(email, ""))
    # Heuristic: phone should contain at least 7 digits — filters out years
    # (e.g. "2024 – 2026") that the regex would otherwise grab.
    phone = ""
    if phone_match:
        cand = phone_match.group(0).strip()
        if sum(c.isdigit() for c in cand) >= 7:
            phone = cand
    urls = _URL_RE.findall(blob)
    linkedin = next((u for u in urls if "linkedin" in u.lower()), "")
    github = next((u for u in urls if "github" in u.lower()), "")
    return {
        "name": name,
        "email": email,
        "phone": phone,
        "linkedin": linkedin,
        "github": github,
    }


def _split_skills(skills_text: str) -> list[str]:
    """
    Skills sections are written in many ways: comma-lists, pipe-lists,
    bullet-lists, or even paragraphs. This splits on the most common
    separators and trims to a clean deduped list, capped at 40 entries.
    """
    if not skills_text:
        return []
    # Replace bullet markers and category prefixes ("Languages:", "Tools:")
    cleaned = re.sub(r"^[\s\W_]+", "", skills_text, flags=re.MULTILINE)
    cleaned = re.sub(r"\b\w+\s*:\s*", "", cleaned)  # drop "Languages:" labels
    parts = re.split(r"[,•·\|/\n]+", cleaned)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        s = p.strip(" .;-—–")
        if not s or len(s) > 50:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= 40:
            break
    return out


def _split_bullets(text: str) -> list[str]:
    """Split a multi-line section body into discrete bullet entries."""
    if not text:
        return []
    out: list[str] = []
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            continue
        # Strip common bullet markers
        s = re.sub(r"^[•\-•●▪◦*►▸—–]\s*", "", s)
        if s:
            out.append(s)
    return out


def extract_structured_resume(path_or_text: str) -> dict:
    """
    Parse a PDF (path) *or* raw resume text into a structured payload:

        {
          profile: { name, email, phone, linkedin, github },
          summary: str,
          education: [str, ...],
          experience: [str, ...],
          skills: [str, ...],
          projects: [str, ...],
          certifications: [str, ...],
          raw_text: str,
        }

    The lists are bullet-level entries — the Resume Builder is responsible
    for further structuring (per-role dates etc.) when the user edits.
    """
    # Resolve input → raw text
    text: str
    if os.path.exists(path_or_text):
        text = extract_text_from_pdf(path_or_text)
    else:
        text = path_or_text or ""

    if not text.strip():
        return {
            "profile": {"name": "", "email": "", "phone": "", "linkedin": "", "github": ""},
            "summary": "",
            "education": [],
            "experience": [],
            "skills": [],
            "projects": [],
            "certifications": [],
            "raw_text": text,
        }

    lines = text.splitlines()

    # ── 1. Profile from the first ~10 lines ────────────────────────────────
    profile = _extract_profile(lines[:12])

    # ── 2. Walk the body, classifying each line as heading or content ──────
    sections: dict[str, list[str]] = {name: [] for name in SECTION_ALIASES}
    sections["__preamble__"] = []   # everything before the first heading
    current = "__preamble__"

    for line in lines:
        heading = _classify_heading(line)
        if heading:
            current = heading
            continue
        sections[current].append(line)

    # ── 3. Cook each section into the public shape ────────────────────────
    summary_text = "\n".join(sections["summary"]).strip()
    if not summary_text and sections["__preamble__"]:
        # If no explicit Summary section, treat the preamble (after profile
        # lines) as the summary so the Builder shows something useful.
        candidate_summary = "\n".join(sections["__preamble__"][3:]).strip()
        # Keep it short — preambles often include the contact block.
        summary_text = candidate_summary[:600]

    return {
        "profile": profile,
        "summary": summary_text,
        "education":      _split_bullets("\n".join(sections["education"])),
        "experience":     _split_bullets("\n".join(sections["experience"])),
        "skills":         _split_skills("\n".join(sections["skills"])),
        "projects":       _split_bullets("\n".join(sections["projects"])),
        "certifications": _split_bullets("\n".join(sections["certifications"])),
        "raw_text":       text,
    }
