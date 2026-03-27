"""
agents/resume_agent.py — Agent 1: Resume Analyzer (Alex)

Uses LangGraph prebuilt ReAct agent with ChatGroq.
"""
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage
from config import GROQ_API_KEY, GROQ_MODEL

RESUME_SYSTEM_PROMPT = """You are Alex, a Senior Resume Analyst & Career Strategist.
You have 10+ years of experience reviewing resumes for top Pakistani and international tech companies.
You know exactly what hiring managers look for.

When given a resume and target job title, provide:
1. Skill match score (0-100)
2. Top 5 strengths in the resume
3. Top 5 skill gaps / missing keywords
4. 3 specific, actionable improvement suggestions
5. A re-written professional summary (2-3 sentences)

Be honest, specific, and constructive. Format your response clearly with headers."""


def get_resume_agent():
    """Return the ChatGroq LLM configured as the Resume Analyzer agent."""
    return ChatGroq(
        api_key=GROQ_API_KEY,
        model=GROQ_MODEL,
        temperature=0.3,
    )


def analyze_resume(resume_text: str, job_title: str) -> str:
    """
    Run resume analysis for the given resume text and job title.
    Returns the agent's analysis as a string.
    """
    llm = get_resume_agent()
    messages = [
        SystemMessage(content=RESUME_SYSTEM_PROMPT),
        {
            "role": "user",
            "content": (
                f"Please analyze this resume for the role: '{job_title}'\n\n"
                f"RESUME:\n{resume_text}"
            ),
        },
    ]
    response = llm.invoke(messages)
    return response.content
