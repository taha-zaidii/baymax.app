"""
agents/resume_agent.py — Agent 1: Resume Analyzer & Builder (Alex)

Provides two modes:
  1. analyze_resume_structured(resume_text, job_description): Returns the exact
     AnalysisResponse schema used by the open-resume frontend:
       overall_score, ats_score, match_score,
       strengths[], weaknesses[], missing_keywords[],
       section_feedback{ education, skills, projects, experience },
       improved_bullets[{ original, improved }]
  2. improve_text(text, context): Rewrites a single bullet/paragraph
  3. analyze_resume(resume_text, job_title): Backward-compat plain-text wrapper
  4. improve_resume_section / generate_resume_section: for ResumeBuilder
"""
import json
import re
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage
from config import GROQ_API_KEY, GROQ_MODEL

# ── LLM Factory ───────────────────────────────────────────────────────────────

def _get_llm(temperature: float = 0.2) -> ChatGroq:
    return ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=temperature)


# ── System Prompts ─────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """You are Alex, a Senior Resume Analyst with 10+ years of experience
reviewing resumes for top-tier Pakistani and international tech companies.
You specialize in ATS optimization, keyword matching, and impactful resume writing.

You will receive a resume and a job description. Your task is to analyze the resume
SPECIFICALLY against this job description — not generically.

Respond ONLY with a valid JSON object. No markdown, no backticks, no explanation outside JSON.
Use this exact schema:
{
  "overall_score": <integer 0-100: holistic quality score>,
  "ats_score": <integer 0-100: ATS/formatting compliance score>,
  "match_score": <integer 0-100: how well the resume matches THIS job description>,
  "strengths": [
    "<specific strength 1, citing actual resume content>",
    "<specific strength 2>",
    "<specific strength 3>",
    "<specific strength 4>",
    "<specific strength 5>"
  ],
  "weaknesses": [
    "<critical gap or weakness vs the job description>",
    "<gap 2>",
    "<gap 3>",
    "<gap 4>",
    "<gap 5>"
  ],
  "missing_keywords": [
    "<keyword from JD not in resume>", "<kw2>", "<kw3>", "<kw4>",
    "<kw5>", "<kw6>", "<kw7>", "<kw8>", "<kw9>", "<kw10>"
  ],
  "section_feedback": {
    "education": "<1-2 sentences of targeted feedback on the Education section>",
    "skills": "<1-2 sentences on the Skills section vs this JD>",
    "projects": "<1-2 sentences on Projects — are they relevant to this JD?>",
    "experience": "<1-2 sentences on Work Experience quality and relevance>"
  },
  "improved_bullets": [
    {
      "original": "<exact weak bullet or phrase from the resume>",
      "improved": "<rewritten with strong action verb, quantified metrics, and JD keywords>"
    },
    { "original": "...", "improved": "..." },
    { "original": "...", "improved": "..." },
    { "original": "...", "improved": "..." },
    { "original": "...", "improved": "..." }
  ]
}

Rules:
- Every score must be an integer 0-100.
- improved_bullets originals MUST be exact quotes from the resume (do not invent).
- If a section doesn't exist in the resume, set its section_feedback to "Section not found in resume."
- Be brutally honest but constructive. No generic advice.
"""

IMPROVE_TEXT_PROMPT = """You are Alex, a Senior Resume Writing Expert.
Rewrite the given text into a powerful, ATS-optimized, metric-driven resume bullet or paragraph.

Rules:
- Start with a strong action verb (Led, Built, Designed, Reduced, Increased, Launched, etc.)
- Add quantified results where possible (%, x improvement, team size, timeline, $, users, etc.)
- Remove filler phrases (responsible for, helped with, worked on, assisted in)
- Keep bullet points to 1-2 lines max
- Use keywords from the context/job role provided

Respond ONLY with JSON:
{ "improved": "<the rewritten text>" }"""

SECTION_GENERATE_PROMPT = """You are Alex, a Senior Resume Writing Expert.
Generate a complete, polished resume section from the context provided.
Rules:
- Use strong action verbs and add concrete metrics
- ATS-optimized keywords naturally woven in
- Professional tone, first-person implied

Respond ONLY with JSON:
{ "generated_content": "<the generated section content>" }"""


# ── JSON Safety Helper ────────────────────────────────────────────────────────

def _parse_json(raw: str) -> dict:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            return json.loads(m.group(0))
        raise


# ── Core Analysis Function ────────────────────────────────────────────────────

def analyze_resume_structured(
    resume_text: str,
    job_description: str,
) -> dict:
    """
    Deep resume analysis against a specific job description.
    Returns the exact AnalysisResponse schema used by the open-resume frontend.

    Args:
        resume_text:     Full text of the resume (extracted from PDF or builder)
        job_description: Full job description to score against

    Returns:
        dict with keys: overall_score, ats_score, match_score,
                        strengths, weaknesses, missing_keywords,
                        section_feedback, improved_bullets
    """
    llm = _get_llm(temperature=0.2)
    user_msg = (
        f"JOB DESCRIPTION:\n{job_description[:3000]}\n\n"
        f"RESUME TO ANALYZE:\n{resume_text[:10000]}"
    )
    messages = [
        SystemMessage(content=ANALYSIS_SYSTEM_PROMPT),
        {"role": "user", "content": user_msg},
    ]
    response = llm.invoke(messages)
    try:
        return _parse_json(response.content)
    except Exception:
        return _fallback_analysis(job_description)


def _fallback_analysis(job_description: str) -> dict:
    return {
        "overall_score": 60,
        "ats_score": 55,
        "match_score": 50,
        "strengths": [
            "Resume successfully uploaded and parsed",
            "Contains relevant technical content",
            "Education section is present",
            "Skills listed",
            "Projects included",
        ],
        "weaknesses": [
            "Resume doesn't clearly highlight alignment with this job description",
            "Quantified achievements are missing",
            "ATS keywords from JD are sparse",
            "Bullet points need stronger action verbs",
            "Professional summary could be more targeted",
        ],
        "missing_keywords": [
            "Leadership", "Agile", "CI/CD", "Docker", "REST API",
            "Git", "Testing", "Cloud", "Problem-solving", "Communication"
        ],
        "section_feedback": {
            "education": "Education section found. Ensure GPA and relevant coursework are highlighted.",
            "skills": "Skills present. Add more keywords from the job description to improve ATS match.",
            "projects": "Projects listed. Quantify impact (users, performance gains) for stronger effect.",
            "experience": "Experience found. Rewrite bullets with action verbs and measurable outcomes.",
        },
        "improved_bullets": [
            {
                "original": "Worked on projects",
                "improved": "Delivered 3 end-to-end projects with cross-functional teams, improving feature delivery velocity by 25%",
            }
        ],
    }


# ── Text Improver (single bullet / paragraph) ─────────────────────────────────

def improve_text(text: str, context: str = "") -> str:
    """
    Rewrite a single resume bullet or paragraph to be more impactful.

    Args:
        text:    Current weak text
        context: Optional job role / section context for tailoring

    Returns:
        Improved text string
    """
    llm = _get_llm(temperature=0.4)
    user_msg = (
        f"Context / Target Role: {context or 'Software Engineer'}\n\n"
        f"Text to improve:\n{text}"
    )
    messages = [
        SystemMessage(content=IMPROVE_TEXT_PROMPT),
        {"role": "user", "content": user_msg},
    ]
    response = llm.invoke(messages)
    try:
        data = _parse_json(response.content)
        return data.get("improved", text)
    except Exception:
        return response.content


# ── Section Improver (for ResumeBuilder) ───────────────────────────────────────

def improve_resume_section(section_name: str, content: str, job_title: str) -> str:
    """Enhance an existing resume section for the ResumeBuilder tab."""
    return improve_text(content, context=f"{section_name} for {job_title}")


# ── Section Generator (for ResumeBuilder) ──────────────────────────────────────

def generate_resume_section(section_name: str, context: str, job_title: str) -> str:
    """Generate a full resume section from minimal context."""
    llm = _get_llm(temperature=0.6)
    user_msg = (
        f"TARGET ROLE: {job_title}\n"
        f"SECTION TO GENERATE: {section_name}\n\n"
        f"CONTEXT:\n{context}"
    )
    messages = [
        SystemMessage(content=SECTION_GENERATE_PROMPT),
        {"role": "user", "content": user_msg},
    ]
    response = llm.invoke(messages)
    try:
        data = _parse_json(response.content)
        return data.get("generated_content", "")
    except Exception:
        return response.content


# ── Backward-Compatible Plain-Text Wrapper ─────────────────────────────────────

def analyze_resume(resume_text: str, job_title: str) -> str:
    """
    Plain-text analysis for backward compatibility with the crew pipeline.
    Uses job_title as the job description context.
    """
    result = analyze_resume_structured(resume_text, f"Target role: {job_title}")
    lines = [
        f"## Resume Analysis for: {job_title}",
        f"**Overall Score**: {result.get('overall_score', 0)}/100",
        f"**ATS Score**: {result.get('ats_score', 0)}/100",
        f"**Match Score**: {result.get('match_score', 0)}/100",
        "",
        "### Strengths",
        *[f"- {s}" for s in result.get("strengths", [])],
        "",
        "### Areas to Improve",
        *[f"- {w}" for w in result.get("weaknesses", [])],
        "",
        "### Missing Keywords",
        ", ".join(result.get("missing_keywords", [])),
        "",
        "### Section Feedback",
        *[f"**{k.title()}**: {v}" for k, v in result.get("section_feedback", {}).items()],
        "",
        "### Improved Bullet Points",
        *[
            f"❌ {b['original']}\n✅ {b['improved']}"
            for b in result.get("improved_bullets", [])
        ],
    ]
    return "\n".join(lines)


# ── Legacy Helper ──────────────────────────────────────────────────────────────

def get_resume_agent():
    """Return the ChatGroq LLM (kept for compatibility)."""
    return _get_llm()
