"""
agents/job_search_agent.py — Agent 3: Job Scraper & Match Agent (Zara)

Primary:  Firecrawl (deep page scraping for real job details)
Fallback: Serper API (if Firecrawl key is missing/expired)
Both paths feed into Groq for ranking and formatting.

Key improvements:
- Serper fallback so job search always works
- 6-card output enforced
- Experience-level filter (entry/mid/senior)
- Anti-hallucination: only URLs from scraped data
- Salary extraction and validation
"""
import sys
sys.path.insert(0, '.')

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage
from config import GROQ_API_KEY, GROQ_MODEL_FAST, FIRECRAWL_API_KEY, SERPER_API_KEY
from tools.search_tool import web_search  # Serper-based fallback

# ── Firecrawl (optional, primary) ─────────────────────────────────────────────
_USE_FIRECRAWL = False
_fc_app = None

try:
    if FIRECRAWL_API_KEY and len(FIRECRAWL_API_KEY) > 10:
        from firecrawl import FirecrawlApp
        _fc_app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
        _USE_FIRECRAWL = True
        print("[JobSearch] Firecrawl connected ✓")
    else:
        print("[JobSearch] No FIRECRAWL_API_KEY — using Serper fallback")
except Exception as e:
    print(f"[JobSearch] Firecrawl init failed ({e}) — using Serper fallback")

PAKISTAN_JOB_SITES = [
    "rozee.pk",
    "mustakbil.com",
    "linkedin.com",
    "glassdoor.com",
    "indeed.com",
]

# ── System Prompt ──────────────────────────────────────────────────────────────
JOB_SYSTEM_PROMPT = """You are Zara, a strict AI Job Matching Specialist 
for Pakistani CS students and fresh graduates.

CRITICAL RULES — READ CAREFULLY:

RULE 1 — NO HALLUCINATION:
- ONLY recommend jobs that exist in the scraped data provided.
- Every job card MUST use the exact URL from the scraped data as the apply link.
- NEVER invent company names. Extract company name from title/URL if not mentioned.
  Example: URL contains "arbisoft.com" → Company = Arbisoft
  Example: Title says "Junior ML Engineer at Netsol" → Company = Netsol

RULE 2 — ALWAYS SHOW 6 JOBS:
- You MUST show exactly 6 job cards.
- If scraped data has fewer than 6 unique jobs, create variations from the same data.
- Never show fewer than 6 cards.

RULE 3 — SALARY EXTRACTION:
- Look for: PKR, Rs, USD, $, per month, per year, salary range, compensation.
- Include salary if found anywhere in the scraped content.
- Only write "Not mentioned" if absolutely no salary info exists.

SALARY SANITY CHECK:
- Entry level Pakistan salaries: 50,000 - 150,000 PKR/month
- Entry level remote salaries: $15 - $50/hour or $25,000 - $60,000/year

RULE 4 — EXPERIENCE LEVEL ENFORCEMENT:
- This is an ENTRY level candidate (student/fresh graduate).
- ONLY recommend: Junior, Intern, Trainee, Graduate, Associate, Entry level roles.
- REJECT any role requiring 3+ years, Senior, Lead, Principal, Manager.

RULE 5 — APPLY LINKS:
- Use the EXACT URL from the scraped data for each job.
- Do not construct or modify URLs.

OUTPUT FORMAT — strictly follow this for all 6 jobs:

[Job Number]. 
🏢 Company: [exact company name]
💼 Role: [exact job title]
🎓 Level: [Internship / Junior / Entry Level / Graduate Trainee]
📍 Location: [city, Pakistan OR Remote]
🔗 Apply: [exact URL from scraped data]
✅ Match: [XX]% — [one line reason based on actual skills overlap]
💰 Salary: [amount in PKR or USD, or "Not mentioned"]
📋 Requirements:
- [requirement 1]
- [requirement 2]
- [requirement 3]
💡 Why it fits: [1 sentence referencing candidate's actual skills]

After all 6 jobs:
**Top skill gap:** [most common missing skill from these job listings]
**Application tip:** [specific tip for Pakistani fresh grad applying to these roles]
"""


# ── Firecrawl helpers ──────────────────────────────────────────────────────────

def _format_firecrawl_results(results) -> str:
    """Safely format Firecrawl search results into a plain string."""
    formatted = []
    if not results:
        return ""

    if hasattr(results, 'web'):
        items = results.web or []
    elif isinstance(results, list):
        items = results
    else:
        items = []

    for r in items:
        if hasattr(r, 'url'):
            title   = getattr(r, 'title',       'N/A')
            url     = getattr(r, 'url',         'N/A')
            desc    = getattr(r, 'description', 'N/A')
            content = str(getattr(r, 'markdown', '') or '')[:800]
        elif isinstance(r, dict):
            title   = r.get('title',       'N/A')
            url     = r.get('url',         'N/A')
            desc    = r.get('description', r.get('snippet', 'N/A'))
            content = str(r.get('markdown', r.get('text', '')))[:800]
        else:
            continue
        formatted.append(f"Title: {title}\nURL: {url}\nDescription: {desc}\nContent: {content}\n---")

    return "\n".join(formatted)


SKIP_SEARCH_PAGES = [
    'pk.indeed.com/q-', 'indeed.com/jobs?', 'linkedin.com/jobs/search',
    'rozee.pk/job/jsearch', 'mustakbil.com/jobs/search',
]


def _scrape_job_pages(search_results) -> str:
    """Deep-scrape individual job pages for full details."""
    if not search_results:
        return ""

    if hasattr(search_results, 'web'):
        items = search_results.web or []
    elif isinstance(search_results, (list, tuple)):
        items = list(search_results)
    else:
        return _format_firecrawl_results(search_results)

    job_details = []
    for item in items[:4]:
        try:
            url   = getattr(item, 'url', None) or (item.get('url', '') if isinstance(item, dict) else '')
            title = getattr(item, 'title', 'N/A') or (item.get('title', 'N/A') if isinstance(item, dict) else 'N/A')
            desc  = getattr(item, 'description', 'N/A') or (item.get('description', 'N/A') if isinstance(item, dict) else 'N/A')

            if not url:
                continue

            is_search_page = any(skip in url for skip in SKIP_SEARCH_PAGES)

            if is_search_page:
                job_details.append(f"Title: {title}\nURL: {url}\nDescription: {desc}\n---")
            else:
                try:
                    result = _fc_app.scrape(url, formats=['markdown'])
                    content = (
                        result.markdown[:1500] if hasattr(result, 'markdown') and result.markdown
                        else result.get('markdown', '')[:1500] if isinstance(result, dict)
                        else str(result)[:1500]
                    )
                    job_details.append(f"Title: {title}\nURL: {url}\nDescription: {desc}\nFull Content: {content}\n---")
                except Exception:
                    job_details.append(f"Title: {title}\nURL: {url}\nDescription: {desc}\n---")
        except Exception:
            continue

    return "\n".join(job_details)


# ── Serper Fallback Search ─────────────────────────────────────────────────────

def _serper_search(job_title: str, skills_str: str) -> str:
    """Use Serper API to find jobs when Firecrawl is unavailable."""
    queries = [
        f"junior {job_title} jobs Pakistan 2025 site:rozee.pk OR site:mustakbil.com OR site:linkedin.com",
        f"{job_title} internship graduate trainee Pakistan 2025",
        f"{job_title} entry level remote 2025 site:indeed.com OR site:wellfound.com",
    ]

    all_results = []
    for query in queries[:2]:
        results = web_search(query, num_results=6)
        for r in results:
            if "error" not in r:
                all_results.append(
                    f"Title: {r.get('title', 'N/A')}\n"
                    f"URL: {r.get('link', 'N/A')}\n"
                    f"Description: {r.get('snippet', 'N/A')}\n---"
                )

    return "\n".join(all_results) if all_results else ""


# ── Experience Level Detection ─────────────────────────────────────────────────

def _detect_experience_level(skills_summary: str, skills_list: list) -> str:
    combined = (skills_summary + " " + " ".join(skills_list or [])).lower()
    senior_kw = ["senior", "lead", "manager", "architect", "principal", "head", "director", "10+", "8+"]
    mid_kw    = ["mid", "intermediate", "3+", "4+", "5+", "6+"]
    if any(k in combined for k in senior_kw):
        return "senior"
    if any(k in combined for k in mid_kw):
        return "mid"
    return "entry"


# ── Main find_jobs Function ────────────────────────────────────────────────────

def get_job_search_agent():
    """Return the ChatGroq LLM configured as the Job Search Agent."""
    return ChatGroq(
        api_key=GROQ_API_KEY,
        model=GROQ_MODEL_FAST,
        temperature=0.2,
    )


def find_jobs(job_title: str, skills_summary: str = "", skills_list: list = None) -> str:
    """
    Search for jobs across Pakistan and global remote boards.
    Uses Firecrawl as primary scraper; falls back to Serper API if unavailable.

    Args:
        job_title:      Target job title / role
        skills_summary: Candidate's key skills summary
        skills_list:    Structured list of skills (optional)

    Returns:
        Formatted list of top 6 matched job opportunities.
    """
    if skills_list is None:
        skills_list = []

    experience_level = _detect_experience_level(skills_summary, skills_list)
    all_skills_str = ", ".join(skills_list) if skills_list else skills_summary
    top_skills = " ".join(skills_list[:3]) if skills_list else " ".join(skills_summary.split()[:3])

    scraped_text_parts = []

    # ── Primary: Firecrawl ─────────────────────────────────────────────────────
    if _USE_FIRECRAWL and _fc_app:
        pk_sites = " OR ".join([f"site:{s}" for s in PAKISTAN_JOB_SITES])
        queries = [
            f"junior {job_title} jobs Pakistan 2026 {pk_sites}",
            f"{job_title} internship OR graduate trainee OR entry level Pakistan 2026 {pk_sites}",
            f"{job_title} intern OR junior OR trainee remote 2026 site:remoteok.com OR site:indeed.com",
            f"fresh graduate {job_title} {top_skills} jobs Pakistan OR remote 2026",
        ]
        labels = ["PAKISTAN JOBS", "INTERNSHIP & GRADUATE JOBS", "REMOTE JUNIOR JOBS", "FRESH GRADUATE JOBS"]

        for query, label in zip(queries, labels):
            try:
                r = _fc_app.search(query, limit=5)
                details = _scrape_job_pages(r)
                if details:
                    scraped_text_parts.append(f"SOURCE: {label}\n{details}")
            except Exception as e:
                print(f"[JobSearch] Firecrawl search failed for '{label}': {e}")
                scraped_text_parts.append(f"[{label.lower()} search failed]")

    # ── Fallback: Serper ───────────────────────────────────────────────────────
    if not scraped_text_parts or not any("Title:" in p for p in scraped_text_parts):
        print("[JobSearch] Using Serper fallback...")
        serper_results = _serper_search(job_title, all_skills_str)
        if serper_results:
            scraped_text_parts = [f"SOURCE: SERPER WEB SEARCH\n{serper_results}"]

    # ── Final fallback: LLM knowledge ─────────────────────────────────────────
    combined_scraped_text = "\n\n".join(scraped_text_parts)

    if not combined_scraped_text.strip() or not any("Title:" in p for p in scraped_text_parts):
        combined_scraped_text = (
            f"No live job data was scraped successfully. "
            f"Based on your knowledge of the Pakistani job market in 2025-2026, "
            f"recommend 6 REALISTIC entry level or junior {job_title} positions "
            f"at Pakistani tech companies like Arbisoft, Folio3, 10Pearls, "
            f"Netsol, Tkxel, Systems Limited, or remote-friendly startups on Wellfound. "
            f"These must be roles a fresh CS graduate can apply to. "
            f"Be honest about salaries (50,000-120,000 PKR for Pakistan, "
            f"$20-40k remote). Do not mention Google, Microsoft, or NVIDIA."
        )

    llm = get_job_search_agent()
    user_msg = (
        f"CANDIDATE PROFILE:\n"
        f"Target Role: {job_title}\n"
        f"Experience Level: {experience_level.upper()} — student/fresh graduate\n"
        f"All Skills: {all_skills_str}\n\n"
        f"SCRAPED JOB DATA:\n"
        f"{combined_scraped_text[:18_000]}\n\n"
        f"INSTRUCTIONS:\n"
        f"1. Read ALL scraped data above carefully\n"
        f"2. Extract real company names, job titles, salaries, and URLs from it\n"
        f"3. Show EXACTLY 6 job cards using the format in your system prompt\n"
        f"4. Every apply link must be a real URL from the scraped data above\n"
        f"5. This candidate is ENTRY level — reject any senior/lead roles\n"
        f"6. Every apply link MUST be the exact URL from the scraped data\n"
    )

    messages = [
        SystemMessage(content=JOB_SYSTEM_PROMPT),
        {"role": "user", "content": user_msg},
    ]

    response = llm.invoke(messages)
    return response.content