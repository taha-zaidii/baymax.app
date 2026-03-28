"""
agents/memory_agent.py — Shared Memory Layer

Uses Mem0 when a valid API key is available.
Degrades gracefully to in-process dict-store when the key is missing/invalid
so that the rest of the pipeline keeps working.

Public API:
    save_context(user_id, data)
    get_context(user_id) -> dict
    save_full_profile(user_id, resume_text, analysis, job_title)
    get_full_profile(user_id) -> dict | None
    save_interview_result(user_id, avg_score, weak_areas)
    save_resume_analysis(user_id, job_title, analysis_result)
    save_job_search(user_id, job_title, skills_summary)
"""
import json
import re
from config import MEM0_API_KEY

# ── Mem0 Client (optional) ─────────────────────────────────────────────────────
_USE_MEM0 = False
_client = None

try:
    if MEM0_API_KEY and len(MEM0_API_KEY) > 10:
        from mem0 import MemoryClient
        _client = MemoryClient(api_key=MEM0_API_KEY)
        _USE_MEM0 = True
        print("[Memory] Mem0 connected ✓")
    else:
        print("[Memory] No MEM0_API_KEY — using in-process fallback store")
except Exception as e:
    print(f"[Memory] Mem0 init failed ({e}) — using in-process fallback store")

# ── In-process fallback (dict) ─────────────────────────────────────────────────
# Maps user_id -> list of dicts (latest first)
_local_store: dict[str, list] = {}


# ─────────────────────────────── Core helpers ──────────────────────────────────

def save_context(user_id: str, data: dict) -> bool:
    """
    Save agent-generated context for a user session.
    Uses Mem0 if available, otherwise in-process dict.
    """
    if not user_id:
        return False

    # ── In-process fallback ────────────────────────────────────────────────────
    if not _USE_MEM0:
        if user_id not in _local_store:
            _local_store[user_id] = []
        _local_store[user_id].insert(0, data)
        return True

    # ── Mem0 path ──────────────────────────────────────────────────────────────
    try:
        messages = [
            {
                "role": "system",
                "content": f"Baymax candidate profile update: {json.dumps(data, ensure_ascii=False)}"
            }
        ]
        _client.add(messages, user_id=user_id)
        return True
    except Exception as e:
        print(f"[Mem0] save_context failed for {user_id}: {e}")
        # Fall back to local store even in Mem0 mode
        if user_id not in _local_store:
            _local_store[user_id] = []
        _local_store[user_id].insert(0, data)
        return True  # Still return True so pipeline continues


def get_context(user_id: str) -> dict:
    """
    Retrieve the most recent saved context for a user.
    Returns dict with parsed context, or empty dict on miss/error.
    """
    if not user_id:
        return {}

    # ── In-process fallback ────────────────────────────────────────────────────
    if not _USE_MEM0:
        records = _local_store.get(user_id, [])
        return records[0] if records else {}

    # ── Mem0 path ──────────────────────────────────────────────────────────────
    try:
        memories = _client.get_all(user_id=user_id)
        if not memories:
            return _local_store.get(user_id, [{}])[0]  # fallback to local

        latest = memories[0] if isinstance(memories, list) else {}
        memory_text = (
            latest.get("memory", "")
            or latest.get("content", "")
            or str(latest)
        )

        try:
            match = re.search(r"\{.*\}", memory_text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
        except Exception:
            pass

        return {"raw_memory": memory_text}
    except Exception as e:
        print(f"[Mem0] get_context failed for {user_id}: {e}")
        return _local_store.get(user_id, [{}])[0]


# ─────────────────────────────── Full Profile ──────────────────────────────────

def save_full_profile(
    user_id: str,
    resume_text: str,
    analysis: dict,
    job_title: str,
) -> bool:
    """
    Persist the user's complete profile after resume analysis.
    """
    payload = {
        "event": "full_profile_saved",
        "job_title": job_title,
        "resume_text": resume_text[:8_000],
        "overall_score": analysis.get("overall_score"),
        "ats_score":     analysis.get("ats_score"),
        "match_score":   analysis.get("match_score"),
        "strengths":        analysis.get("strengths",        [])[:5],
        "weaknesses":       analysis.get("weaknesses",       [])[:5],
        "missing_keywords": analysis.get("missing_keywords", [])[:10],
        "section_feedback": analysis.get("section_feedback", {}),
    }
    return save_context(user_id, payload)


def get_full_profile(user_id: str) -> dict | None:
    """
    Retrieve the full profile saved by save_full_profile.
    Returns None if nothing is saved yet.
    """
    # Check local store first (fastest)
    for record in _local_store.get(user_id, []):
        if isinstance(record, dict) and record.get("event") == "full_profile_saved":
            return record

    if not _USE_MEM0:
        return None

    try:
        memories = _client.get_all(user_id=user_id)
        for m in memories:
            text = m.get("memory", "") or m.get("content", "") or str(m)
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
                if parsed.get("event") == "full_profile_saved":
                    return parsed
    except Exception:
        pass
    return None


# ─────────────────────────── Interview Result ──────────────────────────────────

def save_interview_result(
    user_id: str,
    avg_score: float,
    weak_areas: str,
) -> bool:
    """Persist interview performance for downstream agents."""
    return save_context(user_id, {
        "event": "interview_completed",
        "avg_score": avg_score,
        "weak_areas": weak_areas,
    })


# ──────────────────────────── Convenience wrappers ────────────────────────────

def save_resume_analysis(user_id: str, job_title: str, analysis_result: dict) -> bool:
    """Lightweight analysis summary."""
    return save_context(user_id, {
        "event": "resume_analyzed",
        "job_title": job_title,
        "overall_score":    analysis_result.get("overall_score"),
        "ats_score":        analysis_result.get("ats_score"),
        "match_score":      analysis_result.get("match_score"),
        "strengths":        analysis_result.get("strengths",        [])[:3],
        "weaknesses":       analysis_result.get("weaknesses",       [])[:3],
        "missing_keywords": analysis_result.get("missing_keywords", [])[:5],
    })


def save_job_search(user_id: str, job_title: str, skills_summary: str) -> bool:
    """Persist job search event for history tracking."""
    return save_context(user_id, {
        "event": "job_searched",
        "job_title": job_title,
        "skills_summary": skills_summary[:300],
    })
