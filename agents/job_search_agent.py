"""
agents/job_search_agent.py — Agent 3: Job Scraper & Match Agent (Zara)

Refined Version: Replaced scrape_url() with search() for better JS-heavy site handling.
Includes global remote awareness, salary tracking, and expanded 12k char context.
Latest Update (2026): Added 4th search query, enhanced card formatting,
experience-level detection, hard pre-filter, strict LLM enforcement,
anti-hallucination rules, fresh-grad focused search queries,
and fix for Firecrawl v4 SearchData return type.
"""
import sys
sys.path.insert(0, '.')

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage
from firecrawl import FirecrawlApp
from config import GROQ_API_KEY, GROQ_MODEL, FIRECRAWL_API_KEY

# FIRECRAWL CONFIGURATION
app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)

# 1. ADD PAKISTAN_JOB_SITES LIST AT THE TOP
PAKISTAN_JOB_SITES = [
    "rozee.pk",
    "mustakbil.com",
    "linkedin.com",
    "glassdoor.com",
    "indeed.com"
]

# SYSTEM PROMPT: Rewritten to fix company names, 6-card requirement, salary extraction
JOB_SYSTEM_PROMPT = """You are Zara, a strict AI Job Matching Specialist 
for Pakistani CS students and fresh graduates.

CRITICAL RULES — READ CAREFULLY:

RULE 1 — NO HALLUCINATION:
- ONLY recommend jobs that exist in the scraped data provided.
- Every job card MUST use the exact URL from the scraped data as the apply link.
- NEVER invent company names. If company name is not in scraped data, 
  write the company name exactly as it appears in the job title or URL.
- Extract company name from the job title or URL if not explicitly mentioned.
  Example: URL contains "arbisoft.com" → Company = Arbisoft
  Example: Title says "Junior ML Engineer at Netsol" → Company = Netsol
  Example: URL is "pk.indeed.com/..." → extract company from title text

RULE 2 — ALWAYS SHOW 6 JOBS:
- You MUST show exactly 6 job cards.
- If scraped data has fewer than 6 unique jobs, create variations by 
  listing the same company with slightly different roles that match the skills.
- Never show fewer than 6 cards.

RULE 3 — SALARY EXTRACTION:
- Read the scraped content carefully for any salary mentions.
- Look for: PKR, Rs, USD, $, per month, per year, salary range, compensation.
- If found anywhere in the scraped content, include it in the salary field.
- Only write "Not mentioned" if absolutely no salary info exists anywhere.

SALARY SANITY CHECK:
- If a remote job shows salary above $80/hour or $120,000/year 
  for an entry level role, flag it as "Verify before applying — 
  may be inaccurate" instead of showing the raw number.
- Entry level Pakistan salaries realistically range: 
  50,000 - 150,000 PKR/month
- Entry level remote salaries realistically range: 
  $15 - $50/hour or $25,000 - $60,000/year

RULE 4 — EXPERIENCE LEVEL ENFORCEMENT:
- This is an ENTRY level candidate (student/fresh graduate).
- ONLY recommend: Junior, Intern, Trainee, Graduate, Associate, Entry level roles.
- REJECT any role requiring 3+ years, Senior, Lead, Principal, Manager.
- If a job in the scraped data explicitly says 
  "10+ years", "8+ years", "7+ years", "5+ years required", 
  SKIP that job entirely and replace it with the next 
  available job from the scraped data.
- Never include a job that clearly mismatches experience level 
  even if it is the only data available for that company.

RULE 5 — APPLY LINKS:
- Use the EXACT URL from the scraped data for each job.
- Do not construct or modify URLs.
- If a direct apply link exists in content, use that over the search page URL.

OUTPUT FORMAT — strictly follow this for all 6 jobs:

[Job Number]. 
🏢 Company: [exact company name extracted from title/URL/content]
💼 Role: [exact job title from scraped data]
🎓 Level: [Internship / Junior / Entry Level / Graduate Trainee]
📍 Location: [city, Pakistan OR Remote — from scraped data]
🔗 Apply: [exact URL from scraped data]
✅ Match: [XX]% — [one line reason based on actual skills overlap]
💰 Salary: [exact amount from scraped data in PKR or USD, or "Not mentioned"]
📋 Requirements:
- [requirement 1 from scraped data]
- [requirement 2 from scraped data]  
- [requirement 3 from scraped data]
💡 Why it fits: [1 sentence referencing candidate's actual skills]

After all 6 jobs:
**Top skill gap:** [most common missing skill from these job listings]
**Application tip:** [specific tip for Pakistani fresh grad applying to these roles]
"""

def format_search_results(results) -> str:
    """
    Safely format Firecrawl search results into a plain string for the LLM.

    Handles Firecrawl v4 SearchData objects (results.web is a list of
    SearchResultWeb objects with .url / .title / .description attributes),
    as well as older list-of-dicts and edge-case return types.
    """
    formatted = []

    # Nothing returned
    if not results:
        return ""

    # --- Firecrawl v4: SearchData object with a .web attribute ---
    if hasattr(results, 'web'):
        items = results.web or []
        for r in items:
            title   = getattr(r, 'title',       None) or getattr(r, 'name',    'N/A')
            url     = getattr(r, 'url',         None) or getattr(r, 'link',    'N/A')
            desc    = getattr(r, 'description', None) or getattr(r, 'snippet', 'N/A')
            content = str(getattr(r, 'markdown', None) or getattr(r, 'text', '') or '')[:1000]
            formatted.append(
                f"Title: {title}\nURL: {url}\nDescription: {desc}\nContent: {content}\n---"
            )
        return "\n".join(formatted)

    # --- Older Firecrawl: dict with a 'data' wrapper ---
    if isinstance(results, dict) and 'data' in results:
        results = results['data']

    # --- Single dict result — wrap in list ---
    if isinstance(results, dict):
        results = [results]

    # --- Tuple — convert to list ---
    if isinstance(results, tuple):
        results = list(results)

    # --- Iterate over list items (dicts or attribute objects) ---
    for r in results:
        if isinstance(r, tuple):
            try:
                r = dict(r)
            except Exception:
                continue

        if isinstance(r, dict):
            title   = r.get('title',       r.get('name',    'N/A'))
            url     = r.get('url',         r.get('link',    'N/A'))
            desc    = r.get('description', r.get('snippet', r.get('content', 'N/A')))
            content = str(r.get('markdown', r.get('text', r.get('body', ''))))[:1000]
        elif hasattr(r, 'url'):
            title   = getattr(r, 'title',       'N/A')
            url     = getattr(r, 'url',         'N/A')
            desc    = getattr(r, 'description', 'N/A')
            content = str(getattr(r, 'markdown', '') or '')[:1000]
        else:
            continue

        formatted.append(
            f"Title: {title}\nURL: {url}\nDescription: {desc}\nContent: {content}\n---"
        )

    return "\n".join(formatted) if formatted else ""


def scrape_job_pages(search_results) -> str:
    """
    Takes Firecrawl search results, extracts job URLs, then scrapes each
    individual job page for full details (company name, salary, requirements).
    Falls back to snippet text for generic search-listing pages.
    """
    if not search_results:
        return ""

    if hasattr(search_results, 'web'):
        items = search_results.web or []
    elif isinstance(search_results, (list, tuple)):
        items = list(search_results)
    else:
        return format_search_results(search_results)

    job_details = []

    SKIP_DOMAINS = [
        'pk.indeed.com/q-',
        'indeed.com/jobs?',
        'linkedin.com/jobs/search',
        'rozee.pk/job/jsearch',
        'mustakbil.com/jobs/search',
    ]

    for item in items[:4]:
        try:
            if hasattr(item, 'url'):
                url         = item.url or ''
                title       = getattr(item, 'title',       'N/A')
                description = getattr(item, 'description', 'N/A')
            elif isinstance(item, dict):
                url         = item.get('url', '')
                title       = item.get('title',       'N/A')
                description = item.get('description', 'N/A')
            else:
                continue

            if not url:
                continue

            is_search_page = any(skip in url for skip in SKIP_DOMAINS)

            if is_search_page:
                job_details.append(
                    f"Title: {title}\nURL: {url}\nDescription: {description}\n---"
                )
            else:
                try:
                    result = app.scrape(url, formats=['markdown'])

                    if hasattr(result, 'markdown') and result.markdown:
                        content = result.markdown[:1500]
                    elif isinstance(result, dict):
                        content = result.get('markdown', '')[:1500]
                    else:
                        content = str(result)[:1500]

                    job_details.append(
                        f"Title: {title}\nURL: {url}\n"
                        f"Description: {description}\n"
                        f"Full Content: {content}\n---"
                    )
                except Exception as scrape_err:
                    print(f"[DEBUG] Page scrape failed for {url}: {scrape_err}")
                    job_details.append(
                        f"Title: {title}\nURL: {url}\nDescription: {description}\n---"
                    )

        except Exception:
            continue

    return "\n".join(job_details)


def get_job_search_agent():
    """Return the ChatGroq LLM configured as the Job Search Agent using the 70B model."""
    return ChatGroq(
        api_key=GROQ_API_KEY,
        model=GROQ_MODEL,
        temperature=0.2,
    )


def is_suitable_for_candidate(job_text: str, experience_level: str) -> bool:
    """Filter out scraped job blocks that are clearly too senior for the candidate."""
    job_lower = job_text.lower()

    if experience_level == "entry":
        reject_keywords = [
            "10+ years", "8+ years", "7+ years", "6+ years", "5+ years",
            "senior engineer", "senior developer", "lead engineer",
            "lead developer", "principal engineer", "staff engineer",
            "engineering manager", "tech lead", "team lead",
            "head of", "director", "vp of", "vice president",
            "minimum 5", "minimum 6", "minimum 7", "minimum 8",
            "at least 5", "at least 6", "at least 7", "at least 8",
            "required: 5", "required: 6", "required: 7"
        ]
        return not any(k in job_lower for k in reject_keywords)

    elif experience_level == "mid":
        reject_keywords = [
            "10+ years", "8+ years", "senior director", "vp of",
            "vice president", "head of engineering", "principal",
            "minimum 8", "minimum 9", "minimum 10"
        ]
        return not any(k in job_lower for k in reject_keywords)

    return True


def find_jobs(job_title: str, skills_summary: str = "", skills_list: list = None) -> str:
    """
    Search for jobs across Pakistan and Global remote boards using Firecrawl's search method.

    Args:
        job_title:      Target job title / role
        skills_summary: Candidate's key skills summary
        skills_list:    Structured list of skills (optional)

    Returns:
        Formatted list of top 6 matched job opportunities.
    """
    if skills_list is None:
        skills_list = []

    # Extract top 3 skills for query enrichment
    top_skills = ""
    if skills_list and len(skills_list) > 0:
        top_skills = " ".join(skills_list[:3])
    else:
        top_skills = " ".join(skills_summary.split()[:3])

    # Detect experience level from skills_summary and skills_list
    experience_level = "entry"

    senior_keywords = ["senior", "lead", "manager", "architect", "principal", "head", "director", "vp", "10+", "8+", "7+"]
    mid_keywords    = ["mid", "intermediate", "3+", "4+", "5+", "6+"]

    combined_text = (skills_summary + " " + " ".join(skills_list or [])).lower()

    if any(k in combined_text for k in senior_keywords):
        experience_level = "senior"
    elif any(k in combined_text for k in mid_keywords):
        experience_level = "mid"
    else:
        experience_level = "entry"

    print(f"[DEBUG] Firecrawl app type : {type(app).__name__}")
    print(f"[DEBUG] Firecrawl methods  : {[m for m in dir(app) if not m.startswith('_') and 'search' in m.lower()]}")

    pk_sites = " OR ".join([f"site:{s}" for s in PAKISTAN_JOB_SITES])
    search1_query = f"junior {job_title} jobs Pakistan 2026 {pk_sites}"
    search2_query = f"{job_title} internship OR graduate trainee OR entry level Pakistan 2026 {pk_sites}"
    search3_query = f"{job_title} intern OR junior OR trainee remote 2026 site:remoteok.com OR site:indeed.com OR site:wellfound.com"
    search4_query = f"fresh graduate {job_title} {top_skills} jobs Pakistan OR remote 2026"

    scraped_text_parts = []

    # Search 1: Junior Pakistan jobs — deep-scrape individual pages
    try:
        r1 = app.search(search1_query, limit=5)
        print(f"[DEBUG] r1 type  : {type(r1)}")
        print(f"[DEBUG] r1 sample: {str(r1)[:300]}")
        details1 = scrape_job_pages(r1)
        if details1:
            scraped_text_parts.append(f"SOURCE: PAKISTAN JOBS\n{details1}")
    except Exception as e:
        print(f"[DEBUG] Search 1 full error: {e}")
        scraped_text_parts.append(f"[rozee/mustakbil search failed: {e}]")

    # Search 2: Internship / Graduate trainee Pakistan — deep-scrape
    try:
        r2 = app.search(search2_query, limit=5)
        details2 = scrape_job_pages(r2)
        if details2:
            scraped_text_parts.append(f"SOURCE: INTERNSHIP & GRADUATE JOBS\n{details2}")
    except Exception as e:
        print(f"[DEBUG] Search 2 full error: {e}")
        scraped_text_parts.append(f"[internship search failed: {e}]")

    # Search 3: Remote junior/trainee roles — deep-scrape
    try:
        r3 = app.search(search3_query, limit=5)
        details3 = scrape_job_pages(r3)
        if details3:
            scraped_text_parts.append(f"SOURCE: REMOTE JUNIOR JOBS\n{details3}")
    except Exception as e:
        print(f"[DEBUG] Search 3 full error: {e}")
        scraped_text_parts.append(f"[remote junior search failed: {e}]")

    # Search 4: Fresh graduate with skills — deep-scrape
    try:
        r4 = app.search(search4_query, limit=5)
        details4 = scrape_job_pages(r4)
        if details4:
            scraped_text_parts.append(f"SOURCE: FRESH GRADUATE JOBS\n{details4}")
    except Exception as e:
        print(f"[DEBUG] Search 4 full error: {e}")
        scraped_text_parts.append(f"[fresh grad search failed: {e}]")

    # PRE-FILTER: Remove blocks containing senior-level indicators
    if experience_level in ("entry", "mid"):
        filtered_parts = [
            part for part in scraped_text_parts
            if is_suitable_for_candidate(part, experience_level)
        ]
        if len(filtered_parts) >= 2:
            scraped_text_parts = filtered_parts

    combined_scraped_text = "\n\n".join(scraped_text_parts)

    real_sources = len([p for p in scraped_text_parts if "Title:" in p])
    print(f"\n[DEBUG] Total scraped content length: {len(combined_scraped_text)} chars")
    print(f"[DEBUG] Sources found with real job data: {real_sources}")
    print(f"[DEBUG] First 200 chars of scraped data: {combined_scraped_text[:200]}\n")

    if (not combined_scraped_text.strip()) or ("failed" in combined_scraped_text and len(scraped_text_parts) <= 4):
        if not any("Title:" in part for part in scraped_text_parts):
            scraped_text = (
                f"No live job data was scraped successfully. "
                f"Based on your knowledge of the Pakistani job market in 2026, "
                f"recommend 4-6 REALISTIC entry level or junior {job_title} positions "
                f"at mid-size Pakistani tech companies like Arbisoft, Folio3, 10Pearls, "
                f"Netsol, Tkxel, Systems Limited, or remote-friendly startups on Wellfound. "
                f"These must be roles a fresh CS graduate with internship experience can apply to. "
                f"Be honest about salaries (50,000-120,000 PKR for Pakistan, "
                f"$20-40k remote). Do not mention Google, Microsoft, or NVIDIA."
            )
        else:
            scraped_text = combined_scraped_text[:20000]
    else:
        scraped_text = combined_scraped_text[:20000]

    all_skills_str = ", ".join(skills_list) if skills_list else skills_summary

    llm = get_job_search_agent()
    user_msg = (
        f"MOST IMPORTANT: Every apply link MUST be the exact URL "
        f"from the scraped data. The URL field in each result IS "
        f"the apply link. Copy it exactly — do not modify or replace it.\n\n"
        f"CANDIDATE PROFILE:\n"
        f"Name: Fresh Graduate / Undergraduate Student (2023-2027)\n"
        f"Target Role: {job_title}\n"
        f"Experience Level: {experience_level.upper()} — student with internships only\n"
        f"All Skills: {all_skills_str}\n\n"
        f"SCRAPED JOB DATA FROM LIVE WEBSITES (up to 20,000 chars):\n"
        f"{scraped_text}\n\n"
        f"INSTRUCTIONS:\n"
        f"1. Read ALL scraped data above carefully\n"
        f"2. Extract real company names, job titles, salaries, and URLs from it\n"
        f"3. Show EXACTLY 6 job cards using the format in your instructions\n"
        f"4. Every apply link must be a real URL from the scraped data above\n"
        f"5. This candidate is ENTRY level — reject any senior/lead roles\n"
        f"6. Check every line of scraped data for salary information\n"
    )

    messages = [
        SystemMessage(content=JOB_SYSTEM_PROMPT),
        {"role": "user", "content": user_msg},
    ]

    response = llm.invoke(messages)
    return response.content