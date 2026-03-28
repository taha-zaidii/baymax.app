"""
agents/memory_agent.py — Shared Memory Layer using Mem0

Syncs context between agents so that Zara (Job Scout) knows what
Alex (Resume Analyzer) found, and the interview agent can personalize
questions based on the candidate's full profile.

Usage:
    from agents.memory_agent import save_context, get_context

    save_context("user_abc", {
        "job_title": "Software Engineer",
        "skills": ["Python", "React"],
        "skill_gaps": ["Docker", "CI/CD"],
        "resume_score": 72,
    })

    ctx = get_context("user_abc")
"""
import json
from mem0 import MemoryClient
from config import MEM0_API_KEY


# ── Mem0 Client ────────────────────────────────────────────────────────────────
_client = MemoryClient(api_key=MEM0_API_KEY)


def save_context(user_id: str, data: dict) -> bool:
    """
    Save agent-generated context for a user session.

    Args:
        user_id: Unique session/user identifier (use session_id or "default")
        data:    Dict of context to save (job_title, skills, gaps, scores, etc.)

    Returns:
        True if saved successfully, False on error
    """
    try:
        # Convert to a list of messages mem0 can store
        messages = [
            {
                "role": "system",
                "content": f"Baymax candidate profile update: {json.dumps(data, ensure_ascii=False)}"
            }
        ]
        _client.add(messages, user_id=user_id)
        return True
    except Exception as e:
        print(f"[Mem0] save_context failed: {e}")
        return False


def get_context(user_id: str) -> dict:
    """
    Retrieve the most recent saved context for a user.

    Args:
        user_id: Session/user identifier

    Returns:
        Dict with the last saved context, or empty dict on miss/error
    """
    try:
        memories = _client.get_all(user_id=user_id)
        if not memories:
            return {}

        # Most recent memory first
        latest = memories[0] if isinstance(memories, list) else {}
        memory_text = (
            latest.get("memory", "")
            or latest.get("content", "")
            or str(latest)
        )

        # Attempt to parse back as JSON
        try:
            # Find the JSON blob in the memory text
            import re
            match = re.search(r"\{.*\}", memory_text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
        except Exception:
            pass

        return {"raw_memory": memory_text}
    except Exception as e:
        print(f"[Mem0] get_context failed: {e}")
        return {}


def save_resume_analysis(user_id: str, job_title: str, analysis_result: dict) -> bool:
    """Convenience wrapper to save resume analysis results."""
    return save_context(user_id, {
        "event": "resume_analyzed",
        "job_title": job_title,
        "overall_score": analysis_result.get("overall_score"),
        "ats_score": analysis_result.get("ats_score"),
        "match_score": analysis_result.get("match_score"),
        "strengths": analysis_result.get("strengths", [])[:3],
        "weaknesses": analysis_result.get("weaknesses", [])[:3],
        "missing_keywords": analysis_result.get("missing_keywords", [])[:5],
    })


def save_job_search(user_id: str, job_title: str, skills_summary: str) -> bool:
    """Convenience wrapper to save job search context."""
    return save_context(user_id, {
        "event": "job_searched",
        "job_title": job_title,
        "skills_summary": skills_summary[:300],
    })
