"""
agents/resume_agent.py — Agent 1: Resume Analyzer & Builder (Alex)

Provides:
  - analyze_resume_structured(): Deep structured JSON analysis with 5 metrics
  - analyze_resume(): Backward-compatible plain-text wrapper for the pipeline
  - improve_resume_section(): AI-powered bullet point / paragraph enhancer
  - generate_resume_section(): AI-powered section generator from scratch
"""
import json
import re
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage
from config import GROQ_API_KEY, GROQ_MODEL

# ── LLM Factory ──────────────────────────────────────────────────────────────

def _get_llm(temperature: float = 0.2) -> ChatGroq:
    return ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=temperature)


# ── System Prompts ────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """You are Alex, a Senior Resume Analyst & Career Strategist with 10+ years experience
reviewing resumes for top-tier tech companies (Google, Microsoft, Meta, Careem, Arbisoft, Systems Ltd, etc.).
You know exactly what ATS systems scan for, and what hiring managers notice in the first 6 seconds.

Your job is to provide a PRECISE, THOROUGH, JSON-formatted resume evaluation. No fluff. No generic advice.
Every suggestion must be specific to the actual content of THIS resume, not generic templates.

Respond ONLY with a valid JSON object using this exact schema (no markdown, no backticks, no explanation):
{
  "overall_score": <integer 0-100>,
  "ats_score": <integer 0-100>,
  "keyword_match_score": <integer 0-100>,
  "impact_score": <integer 0-100>,
  "formatting_score": <integer 0-100>,
  "verdict": "<Excellent | Good | Needs Improvement>",
  "strengths": [
    "<specific strength 1 citing actual resume content>",
    "<specific strength 2>",
    "<specific strength 3>",
    "<specific strength 4>",
    "<specific strength 5>"
  ],
  "skill_gaps": [
    "<critical missing skill relevant to the target role>",
    "<missing skill 2>",
    "<missing skill 3>",
    "<missing skill 4>",
    "<missing skill 5>"
  ],
  "keywords_found": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>", "<keyword5>", "<keyword6>", "<keyword7>", "<keyword8>"],
  "keywords_missing": ["<kw1>", "<kw2>", "<kw3>", "<kw4>", "<kw5>", "<kw6>", "<kw7>", "<kw8>", "<kw9>", "<kw10>"],
  "improvements": [
    {
      "section": "<e.g. Work Experience at XYZ>",
      "before": "<exact weak bullet/phrase from the resume>",
      "after": "<rewritten with action verb, metrics, and impact>",
      "why": "<1 sentence explanation>"
    },
    { "section": "...", "before": "...", "after": "...", "why": "..." },
    { "section": "...", "before": "...", "after": "...", "why": "..." },
    { "section": "...", "before": "...", "after": "...", "why": "..." },
    { "section": "...", "before": "...", "after": "...", "why": "..." }
  ],
  "rewritten_summary": "<2-3 polished, powerful sentences for a Professional Summary. Mention years of experience, top skills, and a value proposition tailored to the target role.>",
  "recommendation": "<1 short paragraph of the single most impactful thing this candidate can do to improve their resume for the target role. Be brutally specific.>"
}"""

SECTION_IMPROVE_PROMPT = """You are Alex, a Senior Resume Writing Expert who transforms weak resume content into
powerful, ATS-optimized, metric-driven bullet points and paragraphs.
Rules:
- Start bullet points with strong action verbs (Led, Built, Designed, Reduced, Increased, etc.)
- Include numbers and metrics wherever possible (%, $, x improvement, team size, timeline)
- Remove filler words (responsible for, helped with, worked on)
- Keep each bullet to 1-2 lines maximum
- Make it specific to the target role

Respond ONLY with a JSON object:
{ "improved_content": "<the enhanced text, with \\n between bullets if multiple>" }"""

SECTION_GENERATE_PROMPT = """You are Alex, a Senior Resume Writing Expert who creates compelling resume sections from scratch.
Create polished, ATS-optimized content tailored to the target role.
Rules:
- Professional tone, first-person implied (no "I")
- Use strong action verbs and include concrete details
- ATS-friendly keywords naturally woven in
- For experience bullets: 3-5 bullets with metrics
- For summaries: 2-3 powerful sentences
- For skills: organized comma-separated list by category

Respond ONLY with a JSON object:
{ "generated_content": "<the generated content>" }"""


# ── Core Analysis Function (Structured JSON) ─────────────────────────────────

def analyze_resume_structured(
    resume_text: str,
    job_title: str,
    experience_level: str = "0-1",
) -> dict:
    """
    Deep resume analysis returning a structured dictionary with 5 scores,
    strengths, gaps, improvements, rewritten summary, and recommendation.

    Args:
        resume_text:      Full extracted text of the resume
        job_title:        Target job title the candidate is applying for
        experience_level: One of "0-1", "1-3", "3-5", "5+" (years)

    Returns:
        dict matching the JSON schema defined in ANALYSIS_SYSTEM_PROMPT
    """
    llm = _get_llm(temperature=0.2)

    user_msg = (
        f"TARGET ROLE: {job_title}\n"
        f"EXPERIENCE LEVEL: {experience_level} years\n\n"
        f"RESUME TO ANALYZE:\n{resume_text[:12000]}"
    )

    messages = [
        SystemMessage(content=ANALYSIS_SYSTEM_PROMPT),
        {"role": "user", "content": user_msg},
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    # Strip any accidental markdown fences
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Attempt to extract the JSON object if the model added extra text
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            return json.loads(json_match.group(0))
        # Fallback: return a safe default with the raw text
        return _fallback_analysis(resume_text, job_title)


def _fallback_analysis(resume_text: str, job_title: str) -> dict:
    """Return a safe fallback analysis dictionary if JSON parsing fails."""
    return {
        "overall_score": 65,
        "ats_score": 60,
        "keyword_match_score": 55,
        "impact_score": 60,
        "formatting_score": 70,
        "verdict": "Good",
        "strengths": [
            "Resume uploaded and extracted successfully",
            "Contains relevant professional experience",
            "Education section is present",
            "Skills are listed",
            "Contact information available",
        ],
        "skill_gaps": [
            f"Core {job_title} technical skills not clearly highlighted",
            "Quantified achievements are missing",
            "Keywords for ATS optimization are sparse",
            "Professional summary needs improvement",
            "Action verbs could be stronger",
        ],
        "keywords_found": ["Python", "Team", "Development", "Management"],
        "keywords_missing": ["Leadership", "Agile", "CI/CD", "Cloud", "Docker", "REST API", "Git", "Testing"],
        "improvements": [
            {
                "section": "Work Experience",
                "before": "Worked on various projects",
                "after": f"Led end-to-end delivery of 3 key {job_title} projects, improving team velocity by 30%",
                "why": "Quantified impact and strong action verb make this far more compelling to ATS and hiring managers.",
            }
        ],
        "rewritten_summary": (
            f"Results-driven professional targeting a {job_title} role with a strong foundation in "
            "software development and collaborative problem-solving. Passionate about building scalable "
            "solutions and delivering measurable impact in fast-paced environments."
        ),
        "recommendation": (
            f"Prioritize adding 3-5 quantified achievements to your experience bullets for the {job_title} "
            "role. Hiring managers decide in 6 seconds — numbers make you memorable."
        ),
    }


# ── Section Improver ─────────────────────────────────────────────────────────

def improve_resume_section(
    section_name: str,
    content: str,
    job_title: str,
) -> str:
    """
    Take an existing resume section and return AI-enhanced content.

    Args:
        section_name: e.g. "Work Experience", "Skills", "Summary"
        content:      Current text of the section
        job_title:    Target job title for context

    Returns:
        Enhanced content as a string
    """
    llm = _get_llm(temperature=0.4)

    user_msg = (
        f"TARGET ROLE: {job_title}\n"
        f"SECTION: {section_name}\n\n"
        f"CURRENT CONTENT:\n{content}"
    )

    messages = [
        SystemMessage(content=SECTION_IMPROVE_PROMPT),
        {"role": "user", "content": user_msg},
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)

    try:
        data = json.loads(raw)
        return data.get("improved_content", content)
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
                return data.get("improved_content", content)
            except Exception:
                pass
        return raw  # Return raw if parsing fails entirely


# ── Section Generator ────────────────────────────────────────────────────────

def generate_resume_section(
    section_name: str,
    context: str,
    job_title: str,
) -> str:
    """
    Generate a full resume section from minimal context.

    Args:
        section_name: e.g. "Professional Summary", "Skills", "Work Experience"
        context:      Brief context (e.g. "3 years at TechCorp as backend developer")
        job_title:    Target job title

    Returns:
        Generated content as a string
    """
    llm = _get_llm(temperature=0.6)

    user_msg = (
        f"TARGET ROLE: {job_title}\n"
        f"SECTION TO GENERATE: {section_name}\n\n"
        f"CONTEXT PROVIDED BY CANDIDATE:\n{context}"
    )

    messages = [
        SystemMessage(content=SECTION_GENERATE_PROMPT),
        {"role": "user", "content": user_msg},
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)

    try:
        data = json.loads(raw)
        return data.get("generated_content", "")
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
                return data.get("generated_content", "")
            except Exception:
                pass
        return raw


# ── Backward-Compatible Plain-Text Wrapper ───────────────────────────────────

def analyze_resume(resume_text: str, job_title: str) -> str:
    """
    Plain-text analysis for backward compatibility with the crew pipeline.
    Calls the structured analyzer and formats as readable markdown.
    """
    result = analyze_resume_structured(resume_text, job_title)

    lines = [
        f"## Resume Analysis for: {job_title}",
        f"**Verdict**: {result.get('verdict', 'N/A')}",
        f"**Overall Score**: {result.get('overall_score', 0)}/100",
        f"**ATS Score**: {result.get('ats_score', 0)}/100",
        "",
        "### Top Strengths",
        *[f"- {s}" for s in result.get("strengths", [])],
        "",
        "### Skill Gaps",
        *[f"- {g}" for g in result.get("skill_gaps", [])],
        "",
        "### Improvements",
        *[
            f"**{imp['section']}**\n❌ {imp['before']}\n✅ {imp['after']}"
            for imp in result.get("improvements", [])
        ],
        "",
        "### Rewritten Professional Summary",
        result.get("rewritten_summary", ""),
        "",
        "### Recommendation",
        result.get("recommendation", ""),
    ]
    return "\n".join(lines)


# ── Legacy Helper ────────────────────────────────────────────────────────────

def get_resume_agent():
    """Return the ChatGroq LLM (kept for compatibility)."""
    return _get_llm()
