"""
agents/job_search_agent.py — Job-search agent with deterministic relevance
ranking and structured (LLM-free) output.

Pipeline (per call):

    1. Run Serper web searches against Pakistan + remote-friendly job boards.
    2. Drop spam: course pages, recruiter-portal logins, search index pages.
    3. Score each remaining hit deterministically:
         * Jaccard overlap (candidate skills ∩ title+snippet tokens)
         * domain quality (rozee.pk / mustakbil.com / linkedin / indeed +bonus)
         * level match (intern/junior/trainee +bonus, senior/lead −penalty)
    4. Return a STRUCTURED list of JobItem dicts — no LLM call. The frontend
       renders proper cards, so the markdown-formatting step that used to live
       here was pure decoration and a hallucination risk. Removing it makes
       the API deterministic and reproducible for grading.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from config import FIRECRAWL_API_KEY
from tools.search_tool import web_search


# ──────────────────────────────────────────────────────────────────────────────
# Optional Firecrawl secondary source (kept for API parity; not used in the
# default path since deterministic ranking on Serper output is enough)
# ──────────────────────────────────────────────────────────────────────────────

_USE_FIRECRAWL = False
_fc_app = None
try:
    if FIRECRAWL_API_KEY and len(FIRECRAWL_API_KEY) > 10:
        from firecrawl import FirecrawlApp
        _fc_app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
        _USE_FIRECRAWL = True
except Exception:
    _USE_FIRECRAWL = False


# ──────────────────────────────────────────────────────────────────────────────
# Scoring constants
# ──────────────────────────────────────────────────────────────────────────────

# Domains we trust to surface real job listings, vs. domains that are usually
# spam in this context. Bonuses/penalties tune ranking but never hard-filter
# (we leave hard-filtering to the spam regex below so trustworthy domains can
# still publish irrelevant pages without us blocking them).
DOMAIN_BONUS: dict[str, float] = {
    "rozee.pk":         0.30,
    "mustakbil.com":    0.25,
    "linkedin.com":     0.25,
    "indeed.com":       0.20,
    "wellfound.com":    0.18,
    "remoteok.com":     0.15,
    "remoteok.io":      0.15,
    "weworkremotely.com": 0.15,
    "glassdoor.com":    0.10,
    "naukri.com":       0.10,
    "monster.com":      0.05,
}

# These tokens in the URL strongly suggest the link is NOT a real job posting.
SPAM_URL_PATTERNS = [
    "/courses/", "/course/", "/learn/", "/tutorial",
    "/specialization", "/certificate", "/certification",
    "/blog/", "/articles/", "/news/",
    "udemy.com", "coursera.org", "edx.org", "udacity.com",
    "youtube.com", "youtu.be", "facebook.com",
    "/salaries", "salary-calculator",
    "/companies/", "/employer/",
    "indeed.com/q-",      # Indeed search index pages — not actual jobs
    "linkedin.com/jobs/search",
    "rozee.pk/job/jsearch",
    "mustakbil.com/jobs/search",
]

# Tokens that almost always indicate a course or training landing page, even
# when the URL alone doesn't give it away.
SPAM_TITLE_TOKENS = [
    "course", "tutorial", "certification course", "bootcamp signup",
    "free course", "learn ", "online course", "training program",
    "udemy", "coursera", "edx", "udacity",
]

# Level signals — used both as positive (entry-level) and negative (senior).
ENTRY_TOKENS  = ["intern", "internship", "trainee", "graduate", "fresher",
                 "fresh graduate", "junior", "entry level", "associate"]
SENIOR_TOKENS = ["senior", "lead", "principal", "head of", "director",
                 "vp ", "manager"]


# ──────────────────────────────────────────────────────────────────────────────
# Filtering and scoring
# ──────────────────────────────────────────────────────────────────────────────

def _domain_of(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return ""


def _is_spam(title: str, url: str, snippet: str) -> bool:
    """Hard-reject obvious non-job pages."""
    if not url or url == "N/A":
        return True
    lower_url = url.lower()
    if any(p in lower_url for p in SPAM_URL_PATTERNS):
        return True
    blob = f"{title} {snippet}".lower()
    if any(t in blob for t in SPAM_TITLE_TOKENS):
        return True
    return False


def _tokenise(s: str) -> set[str]:
    """Lowercase, strip punctuation, return word set with stop-words removed."""
    if not s:
        return set()
    raw = re.findall(r"[a-zA-Z][a-zA-Z+#./\-]{1,}", s.lower())
    stop = {
        "the", "and", "for", "with", "from", "this", "that", "your", "you",
        "are", "our", "we", "to", "in", "on", "of", "a", "an", "is", "as",
        "be", "by", "or", "at", "it", "job", "jobs", "role", "roles",
        "opportunity", "opportunities", "apply", "apply now",
    }
    return {tok for tok in raw if tok not in stop and len(tok) > 1}


def _skill_overlap(candidate_skills: list[str], job_text: str) -> float:
    """Jaccard overlap between candidate skills and job posting text."""
    if not candidate_skills:
        return 0.0
    skills = {s.strip().lower() for s in candidate_skills if s and s.strip()}
    job_tokens = _tokenise(job_text)
    if not skills or not job_tokens:
        return 0.0
    intersection = sum(1 for s in skills if s in job_tokens)
    if intersection == 0:
        return 0.0
    union = len(skills) + len(job_tokens) - intersection
    return intersection / union if union else 0.0


def _level_score(title: str, snippet: str) -> float:
    """Reward entry-level signals, penalise senior/lead signals."""
    blob = f"{title} {snippet}".lower()
    score = 0.0
    if any(tok in blob for tok in ENTRY_TOKENS):
        score += 0.20
    if any(tok in blob for tok in SENIOR_TOKENS):
        score -= 0.30
    return score


def _score_hit(hit: dict, candidate_skills: list[str]) -> float:
    """Combine: skill overlap + domain bonus + level bonus, clipped to [0,1]."""
    title   = hit.get("title", "")    or ""
    url     = hit.get("link", "")     or ""
    snippet = hit.get("snippet", "")  or ""
    domain  = _domain_of(url)
    overlap = _skill_overlap(candidate_skills, f"{title} {snippet}")
    overlap_score = min(0.55, overlap * 4.0)        # rescale (Jaccard is small)
    domain_bonus  = max((b for d, b in DOMAIN_BONUS.items() if d in domain), default=0.0)
    level_bonus   = _level_score(title, snippet)
    return max(0.0, min(1.0, overlap_score + domain_bonus + level_bonus))


def _dedupe_by_url(hits: list[dict]) -> list[dict]:
    """Keep only the first occurrence of each URL."""
    seen: set[str] = set()
    out: list[dict] = []
    for h in hits:
        url = (h.get("link") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(h)
    return out


# ──────────────────────────────────────────────────────────────────────────────
# Search
# ──────────────────────────────────────────────────────────────────────────────

JOB_QUERIES = [
    "junior {title} jobs Pakistan {year} site:rozee.pk OR site:mustakbil.com",
    "{title} internship OR trainee Pakistan {year} site:linkedin.com OR site:indeed.com",
    "fresh graduate {title} {topskills} Pakistan OR remote {year}",
    "junior {title} remote {topskills} {year} site:wellfound.com OR site:remoteok.com",
]


def _search_serper(job_title: str, candidate_skills: list[str], year: str) -> list[dict]:
    """Run the standard query bundle through Serper and aggregate raw hits."""
    top_skills = " ".join((candidate_skills or [])[:3])
    raw: list[dict] = []
    for q in JOB_QUERIES:
        query = q.format(title=job_title, year=year, topskills=top_skills).strip()
        for hit in web_search(query, num_results=8):
            if "error" in hit:
                continue
            raw.append(hit)
    return raw


# ──────────────────────────────────────────────────────────────────────────────
# Card-shape extractors  (deterministic, no LLM)
# ──────────────────────────────────────────────────────────────────────────────

# A small list of known Pakistan + global tech employers. Used to extract a
# clean company name from a Serper title that's typically formatted as
# "Junior Software Engineer at Folio3 - Karachi | LinkedIn".
KNOWN_EMPLOYERS = [
    "arbisoft", "folio3", "10pearls", "netsol", "tkxel", "systems limited",
    "techlogix", "afiniti", "venturedive", "s&p global", "ibex", "k2",
    "google", "microsoft", "amazon", "meta", "stripe", "shopify",
    "vercel", "github", "gitlab", "openai", "anthropic", "linear",
    "datadog", "snowflake", "cloudflare", "figma", "atlassian",
]

# Locations to recognise inside titles / snippets.
PK_CITIES = ["karachi", "lahore", "islamabad", "rawalpindi", "peshawar",
             "faisalabad", "multan", "hyderabad", "quetta"]


def _strip_trailing_city(name: str) -> str:
    """Trim a "Foo Karachi" or "Foo - Lahore" tail to just "Foo"."""
    n = name or ""
    for city in PK_CITIES:
        # Trailing city, optionally preceded by separator
        n = re.sub(rf"\s*[-,|]?\s*{city}\s*$", "", n, flags=re.IGNORECASE)
    return n.strip(" .,-|") or name


def _extract_company(title: str, url: str) -> str:
    """
    Try, in order:
      1. anything after "at <Company>" / "@ <Company>" in the title
      2. anything before " - " or " | " in the title that isn't the role
      3. a known-employer match anywhere in the title
      4. the URL's domain (best-effort)
    """
    if not title:
        return _domain_of(url).split(".")[0].title() or "Unknown"

    # Pattern 1: "... at COMPANY -" or "... at COMPANY |"
    m = re.search(r"\bat\s+([A-Z][A-Za-z0-9&.\-]{2,40}(?:\s+[A-Z][A-Za-z0-9&.\-]{2,30}){0,2})", title)
    if m:
        return _strip_trailing_city(m.group(1).strip(" .,-|"))

    # Pattern 2: trailing " - Company" / " | Company"
    m = re.search(r"[\-|]\s+([A-Z][A-Za-z0-9&.\- ]{2,40})\s*$", title)
    if m and " jobs" not in m.group(1).lower():
        return _strip_trailing_city(m.group(1).strip(" .,-|"))

    # Pattern 3: known employer mentioned anywhere
    lower = title.lower()
    for emp in KNOWN_EMPLOYERS:
        if emp in lower:
            return emp.title()

    # Pattern 4: domain
    dom = _domain_of(url).split(".")[0]
    return dom.title() if dom else "Unknown"


def _extract_role(title: str) -> str:
    """Strip employer/location/board names from the title to get the bare role."""
    t = title or ""
    # Cut off after employer separator
    t = re.split(r"\b(?:at|@)\b", t, maxsplit=1, flags=re.IGNORECASE)[0]
    t = re.split(r"\s[\-|]\s", t)[0]
    t = re.sub(r"\b(?:apply|hiring|jobs?|career|careers)\b\.?", "", t, flags=re.IGNORECASE)
    return t.strip(" .,-|") or (title or "Job Opening")


def _extract_level(blob: str) -> str:
    """Return one of Internship / Trainee / Junior / Entry Level / Graduate / Junior."""
    s = (blob or "").lower()
    if "intern" in s: return "Internship"
    if "trainee" in s: return "Trainee"
    if "graduate" in s and "post" not in s: return "Graduate"
    if "junior" in s or "jr." in s: return "Junior"
    if "associate" in s: return "Associate"
    if "fresh" in s: return "Entry Level"
    return "Entry Level"


def _extract_location(blob: str, domain: str) -> str:
    """City, Pakistan or Remote or Pakistan."""
    s = (blob or "").lower()
    if "remote" in s and "remote first" not in s:
        return "Remote"
    for city in PK_CITIES:
        if city in s:
            return f"{city.title()}, Pakistan"
    if any(d in domain for d in ("rozee.pk", "mustakbil.com")):
        return "Pakistan"
    if "remote" in domain or "weworkremotely" in domain:
        return "Remote"
    return "Pakistan"


def _extract_salary(blob: str) -> str | None:
    """Pluck a salary mention out of the snippet, or return None."""
    s = blob or ""
    m = re.search(r"(?:PKR|Rs\.?|₨)\s?[\d,]{3,9}(?:\s*[-–]\s*\$?[\d,]{3,9})?(?:\s*(?:per month|/month|p\.m\.|monthly))?", s, re.IGNORECASE)
    if m: return m.group(0).strip()
    # Match $25,000-$35,000 or $25k-$35k forms (the dash + second number).
    m = re.search(r"\$\s?[\d,]{2,7}(?:k)?\s*[-–]\s*\$?[\d,]{2,7}(?:k)?(?:\s*(?:/yr|per year|/year|annually))?", s, re.IGNORECASE)
    if m: return m.group(0).strip()
    m = re.search(r"\$\s?[\d,]{2,7}(?:k)?(?:\s*(?:/yr|per year|/year|annually))?", s, re.IGNORECASE)
    if m: return m.group(0).strip()
    return None


def _extract_matched_skills(candidate_skills: list[str], blob: str) -> list[str]:
    """Which of the candidate's skills appear in the listing text?"""
    if not candidate_skills:
        return []
    blob_l = (blob or "").lower()
    out: list[str] = []
    seen: set[str] = set()
    for s in candidate_skills:
        s_clean = s.strip()
        if not s_clean:
            continue
        # word-boundary match where possible (some skills contain "+" or "#")
        pattern = re.escape(s_clean.lower())
        if re.search(rf"(?<![A-Za-z0-9]){pattern}(?![A-Za-z0-9])", blob_l):
            if s_clean.lower() not in seen:
                out.append(s_clean)
                seen.add(s_clean.lower())
    return out[:8]


def _build_card(hit: dict, score: float, candidate_skills: list[str]) -> dict:
    """Convert a raw Serper hit + relevance score into a structured JobItem."""
    title   = (hit.get("title") or "").strip()
    url     = (hit.get("link") or "").strip()
    snippet = (hit.get("snippet") or "").strip()
    domain  = _domain_of(url)
    blob    = f"{title} {snippet}"

    company = _extract_company(title, url)
    role    = _extract_role(title)
    level   = _extract_level(blob)
    loc     = _extract_location(blob, domain)
    salary  = _extract_salary(snippet)
    matched = _extract_matched_skills(candidate_skills, blob)

    pct = int(round(score * 100))
    return {
        "id":             url,                       # URL is unique per hit
        "company":        company,
        "role":           role,
        "level":          level,
        "location":       loc,
        "url":            url,
        "domain":         domain,
        "match_pct":      pct,
        "snippet":        snippet,
        "skills_matched": matched,
        "salary":         salary,                    # None if not detected
        "source":         _source_label(domain),
    }


def _source_label(domain: str) -> str:
    """Human-readable source name from a domain."""
    if "rozee.pk" in domain:        return "Rozee.pk"
    if "mustakbil.com" in domain:   return "Mustakbil"
    if "linkedin.com" in domain:    return "LinkedIn"
    if "indeed.com" in domain:      return "Indeed"
    if "wellfound.com" in domain:   return "Wellfound"
    if "remoteok" in domain:        return "RemoteOK"
    if "weworkremotely.com" in domain: return "We Work Remotely"
    if "glassdoor.com" in domain:   return "Glassdoor"
    return domain or "Web"


def _top_skill_gap(jobs: list[dict], candidate_skills: list[str]) -> str:
    """The skill mentioned most often across listings that the candidate lacks."""
    have = {s.lower() for s in candidate_skills if s.strip()}
    counter: dict[str, int] = {}
    common_skills = [
        "python", "javascript", "typescript", "react", "node.js", "node",
        "docker", "kubernetes", "aws", "azure", "gcp", "sql", "postgresql",
        "mongodb", "redis", "tensorflow", "pytorch", "machine learning",
        "system design", "ci/cd", "linux", "git", "django", "flask",
        "fastapi", "graphql", "rest", "kafka", "rabbitmq",
    ]
    for j in jobs:
        s = f"{j['role']} {j['snippet']}".lower()
        for sk in common_skills:
            if sk in s and sk not in have:
                counter[sk] = counter.get(sk, 0) + 1
    if not counter:
        return ""
    return max(counter.items(), key=lambda x: x[1])[0]


# ──────────────────────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────────────────────

def find_jobs(
    job_title: str,
    skills_summary: str = "",
    skills_list: list | None = None,
    *,
    top_k: int = 8,
    year: str = "2026",
) -> dict:
    """
    Returns a structured payload that the frontend renders directly:

        {
          "jobs":            [JobItem, ...],
          "top_skill_gap":   str,             # most-common gap across listings
          "application_tip": str,             # short hint
          "query_meta":      { "experience_level": "entry", "year": "2026", ... }
        }

    Where each JobItem has:
        id, company, role, level, location, url, domain, source,
        match_pct, snippet, skills_matched, salary
    """
    skills_list = list(skills_list or [])
    if not skills_list and skills_summary:
        skills_list = [s.strip() for s in re.split(r"[,;|]", skills_summary) if s.strip()]

    raw_hits = _search_serper(job_title, skills_list, year)
    raw_hits = _dedupe_by_url(raw_hits)

    cleaned = [h for h in raw_hits
               if not _is_spam(h.get("title", ""),
                               h.get("link", ""),
                               h.get("snippet", ""))]

    scored: list[tuple[float, dict]] = []
    for h in cleaned:
        scored.append((_score_hit(h, skills_list), h))
    scored.sort(key=lambda x: x[0], reverse=True)

    cards = [_build_card(hit, score, skills_list) for score, hit in scored[:top_k]]

    # Soften: if everything got hard-filtered, fall back to best-effort raw hits.
    if not cards and raw_hits:
        cards = [_build_card(h, 0.0, skills_list) for h in raw_hits[:top_k]]

    return {
        "jobs":            cards,
        "top_skill_gap":   _top_skill_gap(cards, skills_list),
        "application_tip": (
            "Tailor your resume bullets to mirror the requirements in the top match — "
            "ATS systems weigh exact keyword overlap heavily."
        ),
        "query_meta": {
            "experience_level": "entry",
            "year":             year,
            "job_title":        job_title,
            "skills_used":      skills_list,
            "raw_hits":         len(raw_hits),
            "kept_after_spam":  len(cleaned),
            "returned":         len(cards),
        },
    }
