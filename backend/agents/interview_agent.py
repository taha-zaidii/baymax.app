"""
agents/interview_agent.py — Personalised, adaptive technical-interview coach.

Two ideas drive this module:

  1.  *Personalisation comes from explicit features, not from hoping the LLM
      will read the resume well.*  Before every call we pull a small
      structured snapshot out of the candidate's resume text — projects,
      companies, tech keywords — and hand it to the LLM as bullet points it
      MUST reference. This way questions like "in your X project, how did
      you handle Y" actually use real names instead of generic templates.

  2.  *Difficulty adapts to performance.*  Each evaluation feeds back into a
      session-level "difficulty" hint. Low scores → simpler, more
      diagnostic follow-ups. High scores → push deeper into trade-offs and
      system design.

The module exposes the same three public functions as before so the API
layer doesn't need to change:

    start_interview(job_title, resume_summary)             -> dict
    evaluate_answer(...)                                    -> dict
    transcribe_audio(audio_bytes)                           -> str
"""

from __future__ import annotations

import json
import random
import re
from typing import Optional

from groq import Groq

from config import GROQ_API_KEY


# ──────────────────────────────────────────────────────────────────────────────
# LLM client
# ──────────────────────────────────────────────────────────────────────────────

_client = Groq(api_key=GROQ_API_KEY)
_MODEL = "llama-3.3-70b-versatile"


# ──────────────────────────────────────────────────────────────────────────────
# Resume feature extraction (no LLM — deterministic regex)
# ──────────────────────────────────────────────────────────────────────────────

# A short, high-recall set of well-known technologies. The point is not to be
# exhaustive — it's to give the interviewer concrete words to drop into
# follow-up questions.
TECH_KEYWORDS = [
    # Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
    "kotlin", "swift", "ruby", "php", "scala", "r ",
    # Web / mobile
    "react", "next.js", "nextjs", "vue", "angular", "svelte", "node.js", "nodejs",
    "express", "django", "flask", "fastapi", "spring", "rails", "laravel",
    "react native", "flutter", "android", "ios",
    # ML / data
    "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy", "keras",
    "huggingface", "langchain", "openai", "groq", "llm", "transformers",
    "computer vision", "nlp",
    # Infra / cloud
    "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "terraform",
    "redis", "rabbitmq", "kafka", "nginx",
    # DBs
    "postgresql", "postgres", "mysql", "mongodb", "sqlite", "elasticsearch",
    "dynamodb", "firestore",
    # Tools
    "git", "github", "linux", "bash", "ci/cd", "jenkins", "graphql", "rest",
]

# Section heading aliases used to find a "Projects" or "Experience" block.
_SECTION_RE = re.compile(
    r"(?im)^\s*(?:projects?|experience|work\s+experience|employment)\s*[:\-]?\s*$"
)


def extract_resume_features(resume_text: str) -> dict:
    """
    Pull a small set of features off the resume that the interviewer can
    reference. Returns:

        {
          "tech":     [str, ...]   most-common tech keywords (deduped, capped 8)
          "projects": [str, ...]   short project titles  (max 4)
          "companies":[str, ...]   employer-like phrases (max 4)
          "summary":  str          first ~280 chars (used as context)
        }

    All extraction is rule-based and runs in microseconds — no LLM call.
    """
    if not resume_text or not resume_text.strip():
        return {"tech": [], "projects": [], "companies": [], "summary": ""}

    blob = resume_text
    lower = blob.lower()

    # ── Tech stack (word-boundary regex to avoid Java↔JavaScript collisions) ─
    tech: list[str] = []
    seen: set[str] = set()
    for kw in TECH_KEYWORDS:
        # Escape the keyword and use word boundaries that respect non-word
        # punctuation (so "node.js" and "c++" still match).
        pattern = re.escape(kw.strip())
        if re.search(rf"(?<![A-Za-z0-9]){pattern}(?![A-Za-z0-9])", lower):
            normalised = kw.strip()
            if normalised not in seen:
                seen.add(normalised)
                # Title-case for display unless the keyword is naturally lowered.
                tech.append(normalised if any(c in normalised for c in "+#.")
                            else normalised.title())
        if len(tech) >= 8:
            break

    # Tokens that look like section headings — never count these as project names.
    HEADING_BLOCKLIST = {
        "skills", "education", "experience", "summary", "objective", "projects",
        "certifications", "awards", "languages", "interests", "tech stack",
        "technical skills", "work experience", "professional experience",
    }

    # ── Projects (lines under a "Projects" heading, short ones only) ───────
    projects: list[str] = []
    if _SECTION_RE.search(blob):
        in_proj = False
        for line in blob.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            # If we hit ANY section heading, bail out of the projects block.
            if stripped.lower() in HEADING_BLOCKLIST:
                in_proj = "project" in stripped.lower()
                continue
            heading = _SECTION_RE.match(stripped)
            if heading:
                in_proj = "project" in stripped.lower()
                continue
            if not in_proj:
                continue
            if stripped.startswith(("-", "•", "*", "·")):
                continue   # bullet — skip, we want titles
            if 4 < len(stripped) < 80:
                # Strip trailing date / dash strings.
                clean = re.sub(r"\s*[—–\-]\s*\(?\d{4}.*$", "", stripped).strip()
                if clean and clean.lower() not in HEADING_BLOCKLIST and clean not in projects:
                    projects.append(clean)
            if len(projects) >= 4:
                break

    # ── Companies (lines that contain "at <Company>" / "<Company> Inc/Ltd") ─
    companies: list[str] = []
    company_re = re.compile(
        r"(?:\bat\s+)([A-Z][A-Za-z0-9&.\-]{2,30}(?:\s+[A-Z][A-Za-z0-9&.\-]{2,30})?)"
        r"|"
        r"\b([A-Z][A-Za-z0-9&.\-]{2,30}(?:\s+(?:Inc|Ltd|LLC|Pvt|Limited|Corp|Co\.))+)"
    )
    for m in company_re.finditer(blob):
        name = (m.group(1) or m.group(2) or "").strip(", ")
        if name and name not in companies and 2 < len(name) < 45:
            companies.append(name)
        if len(companies) >= 4:
            break

    # Plain English summary blob (first non-empty 280 chars after the name).
    summary = re.sub(r"\s+", " ", blob).strip()[:280]

    return {
        "tech": tech,
        "projects": projects,
        "companies": companies,
        "summary": summary,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Prompt scaffolding
# ──────────────────────────────────────────────────────────────────────────────

_SYSTEM = """You are Sam — a senior engineering manager interviewing a
candidate at a Pakistani tech company. Talk like a human: warm, curious,
direct. Ask ONE question per turn and keep it under three sentences.

Personalisation rules:
- A list of the candidate's projects, companies and tech is given to you on
  every turn. EVERY question MUST reference at least one of those items by
  name, unless the candidate hasn't given you any.
- Never start with "Tell me about yourself".
- Mix ~50% technical (tied to their tech), ~30% behavioural (tied to a real
  project or company), ~20% lightweight system-design.
- Adapt difficulty to their `score` so far:
    score < 5 → ask a clarifying or scoped-down version of the same topic.
    score 5–7 → move on to the next topic at the same level.
    score > 7 → push deeper: trade-offs, scaling, "what would you do
                differently".

Safety:
- Never request real personal data (full address, ID, financial info).
- If the candidate seems stressed, briefly acknowledge it and offer to
  rephrase the question.

Always reply with VALID JSON only — no markdown fences, no commentary
outside the JSON.
"""

# Different opening templates so consecutive sessions feel different.
_OPENERS = [
    "Walk me through {project} — what was the hardest decision you had to make?",
    "If you had to debug a production issue in {tech} at {company}, where would you start?",
    "In {project}, what trade-off did you regret picking and why?",
    "Take {tech} — what's a misconception people have about it that you've had to correct?",
    "Tell me about a time you shipped something and the metrics didn't go your way. What did you do?",
]


def _build_personalisation_block(features: dict) -> str:
    """Format the resume snapshot as a bulleted block for the LLM."""
    if not (features["tech"] or features["projects"] or features["companies"]):
        return "No resume context — the candidate did not provide one."
    lines = []
    if features["projects"]:
        lines.append("PROJECTS: " + " | ".join(features["projects"]))
    if features["companies"]:
        lines.append("COMPANIES / EMPLOYERS: " + " | ".join(features["companies"]))
    if features["tech"]:
        lines.append("TECH KEYWORDS: " + ", ".join(features["tech"]))
    return "\n".join(lines)


def _safe_parse_json(content: str) -> Optional[dict]:
    """Pull JSON out of an LLM response that may include code fences / prose."""
    if not content:
        return None
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", cleaned)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


def _pick_opener(features: dict, job_title: str) -> str:
    """Choose an opener template and substitute in real names from the resume."""
    template = random.choice(_OPENERS)
    project = features["projects"][0] if features["projects"] else "your most recent project"
    tech = features["tech"][0] if features["tech"] else job_title
    company = features["companies"][0] if features["companies"] else "your last role"
    return template.format(project=project, tech=tech, company=company)


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def start_interview(job_title: str, resume_summary: str) -> dict:
    """Open a session — extracts features, then asks the first personalised question."""
    features = extract_resume_features(resume_summary)
    personalisation = _build_personalisation_block(features)
    opener_hint = _pick_opener(features, job_title)

    user_msg = (
        f"Job title the candidate is applying for: {job_title}\n\n"
        f"CANDIDATE SNAPSHOT (extracted from their resume):\n{personalisation}\n\n"
        f"Suggested opener (you may rephrase but stay specific): {opener_hint}\n\n"
        "Open the interview now. Reply ONLY with this JSON:\n"
        '{"type": "first_question", "question": "<your opening question>"}'
    )

    response = _client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.85,
        max_tokens=300,
    )
    content = response.choices[0].message.content or ""
    parsed = _safe_parse_json(content)
    if parsed and parsed.get("question"):
        return parsed
    # Last-ditch fallback: use the opener directly so the session still proceeds.
    return {"type": "first_question", "question": opener_hint}


def evaluate_answer(
    job_title: str,
    conversation_history: list,
    latest_answer: str,
    question_num: int,
    total_questions: int = 6,
    resume_summary: str = "",
) -> dict:
    """
    Score the latest answer, then produce the next personalised question.
    Difficulty ramps with the running score average.
    """
    features = extract_resume_features(resume_summary)
    personalisation = _build_personalisation_block(features)

    # Average score of any prior assistant evaluations in the history.
    prior_scores: list[int] = []
    for turn in conversation_history:
        content = str(turn.get("content", ""))
        m = re.search(r'"score"\s*:\s*(\d+)', content)
        if m:
            try:
                prior_scores.append(int(m.group(1)))
            except ValueError:
                pass
    running = sum(prior_scores) / len(prior_scores) if prior_scores else 6.0
    if running < 5:
        difficulty_hint = "Drop one level — ask a simpler, scoped-down question on the same topic."
    elif running > 7.5:
        difficulty_hint = "Push harder — ask about trade-offs, scaling, or what they'd change in hindsight."
    else:
        difficulty_hint = "Stay at this level and move to the next topic."

    messages: list = [{"role": "system", "content": _SYSTEM}]
    messages.extend(conversation_history)

    is_last = question_num >= total_questions
    if is_last:
        instruction = (
            "This was the FINAL question. Give honest closing feedback, a final score (0–10), "
            "and set follow_up_or_next to the literal string \"DONE\"."
        )
    else:
        instruction = (
            f"Score the answer 0–10 honestly. {difficulty_hint} "
            f"Generate the NEXT personalised question that references the candidate's "
            f"projects/companies/tech listed below."
        )

    user_payload = (
        f"Candidate's latest answer:\n\"\"\"{latest_answer}\"\"\"\n\n"
        f"Question {question_num} of {total_questions}.\n"
        f"Running average score so far: {running:.1f}\n\n"
        f"CANDIDATE SNAPSHOT:\n{personalisation}\n\n"
        f"{instruction}\n\n"
        "Reply ONLY with this JSON:\n"
        '{"type": "feedback_and_next", "feedback": "<2-3 sentence specific feedback>", '
        '"score": <0-10 integer>, "follow_up_or_next": "<your next question or DONE>"}'
    )
    messages.append({"role": "user", "content": user_payload})

    response = _client.chat.completions.create(
        model=_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=400,
    )
    content = response.choices[0].message.content or ""
    parsed = _safe_parse_json(content)
    if parsed:
        # Keep the score within 0..10 even if the model goes outside the range.
        try:
            score = max(0, min(10, int(parsed.get("score", 7))))
        except (TypeError, ValueError):
            score = 7
        parsed["score"] = score
        parsed.setdefault("type", "feedback_and_next")
        parsed.setdefault("feedback", "Solid answer. Let's keep going.")
        parsed.setdefault("follow_up_or_next", "DONE" if is_last else "Tell me about a recent technical trade-off you made.")
        return parsed
    # Fallback if the model didn't produce JSON.
    return {
        "type": "feedback_and_next",
        "feedback": (content or "Good answer — keep going.")[:300],
        "score": 7,
        "follow_up_or_next": "DONE" if is_last else "Tell me about a recent technical trade-off you made.",
    }


def transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe a recorded audio answer using Groq Whisper."""
    transcription = _client.audio.transcriptions.create(
        file=("audio.wav", audio_bytes, "audio/wav"),
        model="whisper-large-v3",
        language="en",
    )
    return transcription.text
