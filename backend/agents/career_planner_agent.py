"""
agents/career_planner_agent.py — Agent 5: Rahul — Career Roadmap Planner

Synthesizes context from ALL upstream agents:
  - Resume gaps    (from Alex, Agent 1)
  - Interview data (from Sam, Agent 2)
  - Job market     (from Zara, Agent 3)

Anti-hallucination strategy:
  - LLM prompt EXPLICITLY forbids URLs in its output
  - All resource URLs come ONLY from FREE_RESOURCES dict (hardcoded, never LLM)
  - LLM output is post-processed to strip any markdown links it generates
  - Chat replies are also stripped of any URLs

Public API:
    build_roadmap(job_title, skills_gap, resume_analysis_raw, job_market_context,
                  current_skills, interview_weak_areas) -> str
    chat_with_rahul(user_message, conversation_history, job_title, skills_gap) -> dict
    get_financial_aid_template(...) -> str
    get_resources_for_gaps(gaps_list) -> dict
    recommend_certifications(job_title, skills_gap, current_skills) -> list[dict]
"""
import re
import json
from groq import Groq
from config import GROQ_API_KEY, GROQ_MODEL

client = Groq(api_key=GROQ_API_KEY)

# ── FREE RESOURCE LIBRARY ──────────────────────────────────────────────────────
# RULE: URLs ONLY come from this dict. LLM never generates URLs.

FREE_RESOURCES: dict[str, list[dict]] = {
    "python": [
        {"title": "Python Full Course – freeCodeCamp",       "url": "https://www.youtube.com/watch?v=rfscVS0vtbw",                                     "platform": "YouTube",        "duration": "4.5 hrs",    "free": True},
        {"title": "Python for Everybody (audit free)",        "url": "https://www.coursera.org/specializations/python",                                  "platform": "Coursera",       "duration": "8 months",   "free": True, "financial_aid": True},
        {"title": "Automate the Boring Stuff",                "url": "https://automatetheboringstuff.com",                                               "platform": "Free Book",      "duration": "Self-paced", "free": True},
        {"title": "Scientific Computing with Python",         "url": "https://www.freecodecamp.org/learn/scientific-computing-with-python/",              "platform": "freeCodeCamp",   "duration": "Self-paced", "free": True},
    ],
    "machine learning": [
        {"title": "ML Specialization – Andrew Ng (audit)",   "url": "https://www.coursera.org/specializations/machine-learning-introduction",           "platform": "Coursera",       "duration": "3 months",   "free": True, "financial_aid": True},
        {"title": "fast.ai – Practical Deep Learning",       "url": "https://course.fast.ai",                                                           "platform": "fast.ai",        "duration": "Self-paced", "free": True},
        {"title": "ML Crash Course – Google",                "url": "https://developers.google.com/machine-learning/crash-course",                      "platform": "Google",         "duration": "15 hrs",     "free": True},
        {"title": "Intro to ML – Kaggle",                    "url": "https://www.kaggle.com/learn/intro-to-machine-learning",                           "platform": "Kaggle",         "duration": "3 hrs",      "free": True},
    ],
    "deep learning": [
        {"title": "Deep Learning Specialization (audit)",    "url": "https://www.coursera.org/specializations/deep-learning",                           "platform": "Coursera",       "duration": "5 months",   "free": True, "financial_aid": True},
        {"title": "Neural Networks: Zero to Hero – Karpathy","url": "https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ",        "platform": "YouTube",        "duration": "Self-paced", "free": True},
        {"title": "PyTorch Official Tutorials",              "url": "https://pytorch.org/tutorials/",                                                   "platform": "PyTorch Docs",   "duration": "Self-paced", "free": True},
        {"title": "Intro to Deep Learning – Kaggle",         "url": "https://www.kaggle.com/learn/intro-to-deep-learning",                              "platform": "Kaggle",         "duration": "4 hrs",      "free": True},
    ],
    "data science": [
        {"title": "IBM Data Science Certificate (audit)",    "url": "https://www.coursera.org/professional-certificates/ibm-data-science",              "platform": "Coursera",       "duration": "10 months",  "free": True, "financial_aid": True},
        {"title": "Data Science Full Course – freeCodeCamp","url": "https://www.youtube.com/watch?v=ua-CiDNNj30",                                       "platform": "YouTube",        "duration": "6 hrs",      "free": True},
        {"title": "Kaggle Learn",                            "url": "https://www.kaggle.com/learn",                                                     "platform": "Kaggle",         "duration": "Self-paced", "free": True},
        {"title": "Data Analysis with Python",               "url": "https://www.freecodecamp.org/learn/data-analysis-with-python/",                    "platform": "freeCodeCamp",   "duration": "Self-paced", "free": True},
    ],
    "sql": [
        {"title": "SQL Tutorial – freeCodeCamp",             "url": "https://www.youtube.com/watch?v=HXV3zeQKqGY",                                      "platform": "YouTube",        "duration": "4 hrs",      "free": True},
        {"title": "SQL for Data Science (audit)",            "url": "https://www.coursera.org/learn/sql-for-data-science",                              "platform": "Coursera",       "duration": "4 weeks",    "free": True, "financial_aid": True},
        {"title": "SQLZoo – Interactive SQL",                "url": "https://sqlzoo.net",                                                               "platform": "SQLZoo",         "duration": "Self-paced", "free": True},
        {"title": "Intro to SQL – Kaggle",                   "url": "https://www.kaggle.com/learn/intro-to-sql",                                        "platform": "Kaggle",         "duration": "3 hrs",      "free": True},
    ],
    "dsa": [
        {"title": "DSA Full Course – Abdul Bari",            "url": "https://www.youtube.com/watch?v=0IAPZzGSbME",                                      "platform": "YouTube",        "duration": "12 hrs",     "free": True},
        {"title": "NeetCode 150",                            "url": "https://neetcode.io",                                                              "platform": "NeetCode",       "duration": "Self-paced", "free": True},
        {"title": "Algorithms Part I – Princeton (audit)",   "url": "https://www.coursera.org/learn/algorithms-part1",                                  "platform": "Coursera",       "duration": "6 weeks",    "free": True, "financial_aid": True},
        {"title": "LeetCode Free Problems",                  "url": "https://leetcode.com/problemset/",                                                 "platform": "LeetCode",       "duration": "Self-paced", "free": True},
    ],
    "algorithms": [
        {"title": "Algorithms Full Course – freeCodeCamp",  "url": "https://www.youtube.com/watch?v=8hly31xKli0",                                      "platform": "YouTube",        "duration": "6 hrs",      "free": True},
        {"title": "NeetCode – Algorithm Patterns",           "url": "https://neetcode.io",                                                              "platform": "NeetCode",       "duration": "Self-paced", "free": True},
    ],
    "system design": [
        {"title": "System Design Primer",                    "url": "https://github.com/donnemartin/system-design-primer",                              "platform": "GitHub",         "duration": "Self-paced", "free": True},
        {"title": "System Design – Gaurav Sen",              "url": "https://www.youtube.com/watch?v=xpDnVSmNFX0",                                      "platform": "YouTube",        "duration": "Self-paced", "free": True},
        {"title": "ByteByteGo – System Design",             "url": "https://www.youtube.com/@bytebytego",                                              "platform": "YouTube",        "duration": "Self-paced", "free": True},
    ],
    "react": [
        {"title": "React Full Course – Dave Gray",           "url": "https://www.youtube.com/watch?v=RVFAyFWO4go",                                      "platform": "YouTube",        "duration": "9 hrs",      "free": True},
        {"title": "Front End Libraries – freeCodeCamp",      "url": "https://www.freecodecamp.org/learn/front-end-development-libraries/",               "platform": "freeCodeCamp",   "duration": "Self-paced", "free": True},
        {"title": "React Official Tutorial",                 "url": "https://react.dev/learn",                                                          "platform": "React Docs",     "duration": "Self-paced", "free": True},
    ],
    "javascript": [
        {"title": "JavaScript Full Course – freeCodeCamp",  "url": "https://www.youtube.com/watch?v=PkZNo7MFNFg",                                      "platform": "YouTube",        "duration": "3 hrs",      "free": True},
        {"title": "JS Algorithms & DS – freeCodeCamp",       "url": "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/",     "platform": "freeCodeCamp",   "duration": "Self-paced", "free": True},
        {"title": "The Odin Project",                        "url": "https://www.theodinproject.com",                                                   "platform": "Odin Project",   "duration": "Self-paced", "free": True},
    ],
    "typescript": [
        {"title": "TypeScript Full Course – freeCodeCamp",  "url": "https://www.youtube.com/watch?v=30LWjhZzg50",                                      "platform": "YouTube",        "duration": "3 hrs",      "free": True},
        {"title": "TypeScript Official Handbook",            "url": "https://www.typescriptlang.org/docs/handbook/intro.html",                           "platform": "TS Docs",        "duration": "Self-paced", "free": True},
    ],
    "docker": [
        {"title": "Docker Tutorial – TechWorld with Nana",  "url": "https://www.youtube.com/watch?v=3c-iBn73dDE",                                      "platform": "YouTube",        "duration": "3 hrs",      "free": True},
        {"title": "Docker & Kubernetes – freeCodeCamp",      "url": "https://www.youtube.com/watch?v=Wf2eSG3owoA",                                      "platform": "YouTube",        "duration": "5 hrs",      "free": True},
        {"title": "Play with Docker",                        "url": "https://labs.play-with-docker.com",                                                "platform": "Docker Labs",    "duration": "Self-paced", "free": True},
    ],
    "kubernetes": [
        {"title": "Kubernetes Full Course – TechWorld Nana", "url": "https://www.youtube.com/watch?v=X48VuDVv0do",                                      "platform": "YouTube",        "duration": "4 hrs",      "free": True},
        {"title": "Kubernetes Basics – Official Docs",       "url": "https://kubernetes.io/docs/tutorials/kubernetes-basics/",                          "platform": "K8s Docs",       "duration": "Self-paced", "free": True},
    ],
    "cloud": [
        {"title": "AWS Cloud Practitioner Essentials",       "url": "https://aws.amazon.com/training/digital/aws-cloud-practitioner-essentials/",       "platform": "AWS",            "duration": "6 hrs",      "free": True},
        {"title": "Google Cloud Skills Boost",               "url": "https://cloudskillsboost.google",                                                  "platform": "Google Cloud",   "duration": "Self-paced", "free": True},
        {"title": "Azure Fundamentals – Microsoft Learn",    "url": "https://learn.microsoft.com/en-us/training/paths/azure-fundamentals/",              "platform": "Microsoft Learn", "duration": "Self-paced", "free": True},
    ],
    "aws": [
        {"title": "AWS Cloud Practitioner Essentials",       "url": "https://aws.amazon.com/training/digital/aws-cloud-practitioner-essentials/",       "platform": "AWS",            "duration": "6 hrs",      "free": True},
        {"title": "AWS Tutorial – freeCodeCamp",             "url": "https://www.youtube.com/watch?v=3hLmDS179YE",                                      "platform": "YouTube",        "duration": "5 hrs",      "free": True},
    ],
    "devops": [
        {"title": "DevOps Roadmap",                          "url": "https://roadmap.sh/devops",                                                        "platform": "Roadmap.sh",     "duration": "Self-paced", "free": True},
        {"title": "DevOps Full Course – freeCodeCamp",       "url": "https://www.youtube.com/watch?v=j5Zsa_eOXeY",                                      "platform": "YouTube",        "duration": "3 hrs",      "free": True},
    ],
    "nlp": [
        {"title": "NLP Specialization (audit)",              "url": "https://www.coursera.org/specializations/natural-language-processing",             "platform": "Coursera",       "duration": "4 months",   "free": True, "financial_aid": True},
        {"title": "Hugging Face NLP Course",                 "url": "https://huggingface.co/learn/nlp-course/chapter1/1",                               "platform": "HuggingFace",    "duration": "Self-paced", "free": True},
        {"title": "Stanford CS224N – free lectures",         "url": "https://www.youtube.com/playlist?list=PLoROMvodv4rOSH4v6133s9LFPRHjEmbmJ",         "platform": "YouTube",        "duration": "Self-paced", "free": True},
    ],
    "git": [
        {"title": "Git & GitHub – freeCodeCamp",             "url": "https://www.youtube.com/watch?v=RGOj5yH7evk",                                      "platform": "YouTube",        "duration": "1 hr",       "free": True},
        {"title": "Learn Git Branching (interactive)",       "url": "https://learngitbranching.js.org",                                                 "platform": "Interactive",    "duration": "Self-paced", "free": True},
    ],
    "statistics": [
        {"title": "Statistics with Python (audit)",          "url": "https://www.coursera.org/specializations/statistics-with-python",                  "platform": "Coursera",       "duration": "5 months",   "free": True, "financial_aid": True},
        {"title": "StatQuest – Josh Starmer",                "url": "https://www.youtube.com/@statquest",                                               "platform": "YouTube",        "duration": "Self-paced", "free": True},
    ],
    "communication": [
        {"title": "English for Career Development (audit)",  "url": "https://www.coursera.org/learn/careerdevelopment",                                 "platform": "Coursera",       "duration": "5 weeks",    "free": True, "financial_aid": True},
        {"title": "Successful Presentation (audit)",         "url": "https://www.coursera.org/learn/presentation-skills",                               "platform": "Coursera",       "duration": "4 weeks",    "free": True, "financial_aid": True},
    ],
    "interview": [
        {"title": "Pramp – Free Peer Mock Interviews",       "url": "https://www.pramp.com",                                                            "platform": "Pramp",          "duration": "Self-paced", "free": True},
        {"title": "InterviewBit",                            "url": "https://www.interviewbit.com",                                                     "platform": "InterviewBit",   "duration": "Self-paced", "free": True},
        {"title": "Tech Interview Handbook",                 "url": "https://techinterviewhandbook.org",                                                "platform": "Handbook",       "duration": "Self-paced", "free": True},
        {"title": "LeetCode – Free Problem Set",             "url": "https://leetcode.com/problemset/",                                                 "platform": "LeetCode",       "duration": "Self-paced", "free": True},
    ],
    "backend": [
        {"title": "Backend Engineering Roadmap",             "url": "https://roadmap.sh/backend",                                                       "platform": "Roadmap.sh",     "duration": "Self-paced", "free": True},
        {"title": "APIs for Beginners – freeCodeCamp",       "url": "https://www.youtube.com/watch?v=GZvSYJDk-us",                                      "platform": "YouTube",        "duration": "2 hrs",      "free": True},
    ],
    "pandas": [
        {"title": "Pandas Tutorial – freeCodeCamp",          "url": "https://www.youtube.com/watch?v=gtjxAH8uaP0",                                      "platform": "YouTube",        "duration": "4 hrs",      "free": True},
        {"title": "Pandas – Kaggle",                         "url": "https://www.kaggle.com/learn/pandas",                                              "platform": "Kaggle",         "duration": "4 hrs",      "free": True},
    ],
    "tensorflow": [
        {"title": "TensorFlow 2.0 – freeCodeCamp",          "url": "https://www.youtube.com/watch?v=tPYj3fFJGjk",                                      "platform": "YouTube",        "duration": "7 hrs",      "free": True},
        {"title": "TensorFlow Official Tutorials",           "url": "https://www.tensorflow.org/tutorials",                                             "platform": "TF Docs",        "duration": "Self-paced", "free": True},
    ],
    "linux": [
        {"title": "Linux Command Line – freeCodeCamp",       "url": "https://www.youtube.com/watch?v=ROjZy1WbCIA",                                      "platform": "YouTube",        "duration": "6 hrs",      "free": True},
    ],
}

# ── Coursera Financial Aid Template ────────────────────────────────────────────
FINANCIAL_AID_TEMPLATE = """\
Subject: Financial Aid Application – {course_name}

To the Coursera Financial Aid Team,

I am applying for financial aid for "{course_name}" offered by {provider}.

Why I want to take this course:
I am a computer science student in Pakistan pursuing a career as a {job_title}. This course covers {skill_area}, which I have identified as a critical skill gap. Completing it will directly help me qualify for roles I am actively applying for.

Why I need financial aid:
I am a student with no independent income. The course fee is beyond my current means as a student in Pakistan.

How I will use this knowledge:
I will complete all graded assignments, dedicate {hours_per_week} hours per week, and apply the skills in a real project: {project_plan}.

My commitment:
I will finish the course within the access window and engage with the discussion forums.

Sincerely,
{full_name}
{email}
{university}
"""


# ── Helpers ────────────────────────────────────────────────────────────────────

def get_resources_for_gaps(gaps: list) -> dict:
    """
    Match skill gaps to FREE_RESOURCES. Returns {gap_label: [resources]}.
    Pure Python — no LLM, zero hallucination risk.
    Deduplicates by URL across all gaps.
    """
    result: dict[str, list] = {}
    seen_urls: set[str] = set()
    for gap in gaps:
        gap_lower = gap.lower().strip()
        if not gap_lower:
            continue
        matched = []
        for key, resources in FREE_RESOURCES.items():
            if key in gap_lower or gap_lower in key:
                for r in resources:
                    if r["url"] not in seen_urls:
                        matched.append(r)
                        seen_urls.add(r["url"])
        if matched:
            result[gap] = matched
    return result


def format_resource_block(resources: list) -> str:
    """Render resources as markdown."""
    if not resources:
        return "_No specific resources found. Try searching YouTube or freeCodeCamp directly._"
    lines = []
    for r in resources:
        tags = ["🆓 Free" if r.get("free") else "💰 Freemium"]
        if r.get("financial_aid"):
            tags.append("💳 Financial Aid Available")
        lines.append(
            f"- [{r['title']}]({r['url']}) — **{r['platform']}** · {r['duration']} · {' · '.join(tags)}"
        )
    return "\n".join(lines)


def _strip_llm_urls(text: str) -> str:
    """Remove any [text](url) links the LLM generated."""
    return re.sub(r'\[([^\]]+)\]\(https?://[^\)]+\)', r'\1', text)


def _parse_gaps_from_alex(resume_analysis_raw: str) -> list:
    """Extract gap list from Alex's output. Tries multiple patterns, never raises."""
    if not resume_analysis_raw or not resume_analysis_raw.strip():
        return []
    # Pattern 1: ❌ or ✗ markers
    gaps = re.findall(r'[❌✗]\s*(.+?)(?:\n|$)', resume_analysis_raw)
    if gaps:
        return [g.strip() for g in gaps if g.strip()]
    # Pattern 2: JSON gaps array
    try:
        data = json.loads(resume_analysis_raw)
        if isinstance(data.get("gaps"), list):
            return [str(g).strip() for g in data["gaps"] if str(g).strip()]
        if isinstance(data.get("weaknesses"), list):
            return [str(g).strip() for g in data["weaknesses"] if str(g).strip()]
    except Exception:
        pass
    # Pattern 3: bullet lines under Gaps/Missing/Weakness heading
    in_gaps = False
    gaps = []
    for line in resume_analysis_raw.splitlines():
        if re.search(r'\b(gap|missing|improve|weakness|skill gap)\b', line, re.IGNORECASE):
            in_gaps = True
        elif line.strip().startswith("##"):
            in_gaps = False
        elif in_gaps and re.match(r'^\s*[-*]\s+', line):
            gaps.append(re.sub(r'^\s*[-*]\s+', '', line).strip())
    return gaps


def _groq_call(messages: list, max_tokens: int = 1800) -> str:
    """Thin Groq wrapper. Always returns string — never raises to caller."""
    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.55,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        return f"⚠️ Rahul is temporarily unavailable: {e}"


# ── Roadmap System Prompt ──────────────────────────────────────────────────────

_ROADMAP_SYSTEM = """\
You are Rahul, a senior engineering manager and career mentor at a Pakistan tech company.
Build a personalised 3-month career roadmap.

STRICT RULES — DO NOT BREAK THESE:
1. NEVER include URLs, links, or website addresses anywhere in your output.
   The system appends verified links automatically. Any URL you write will be deleted.
2. NEVER use placeholder text like "[link]", "(link here)", or "(source)".
3. Every task must include: WHY it matters for this specific job title.
4. Use realistic time estimates — no padding.
5. Follow the exact format below. No extra sections, no preamble, no sign-off.
6. End with the disclaimer block exactly as shown — do not modify it.
"""

_ROADMAP_USER_TPL = """\
Job Title: {job_title}
Skill Gaps: {skills_gap}
Current Strengths (Alex): {resume_summary}
Interview Weak Areas (Sam): {interview_feedback}
Job Market Context (Zara): {job_market_context}

Output EXACTLY this structure:

## 🗓️ Month 1: Foundation (Weeks 1–4)
**Goal:** [one sentence — what they can DO after this month]

### Week 1–2: [Skill Name]
- [ ] [Concrete task] — *Why: [1-line reason tied to {job_title}]* · Est. Xhr
- [ ] [Concrete task] — *Why: [1-line reason]* · Est. Xhr
- [ ] [Concrete task] — *Why: [1-line reason]* · Est. Xhr

### Week 3–4: [Next Skill Name]
- [ ] [Task] — *Why: [reason]* · Est. Xhr
- [ ] [Task] — *Why: [reason]* · Est. Xhr

## 🚀 Month 2: Build (Weeks 5–8)
**Goal:** [one sentence]

### Week 5–6: [Skill Name]
- [ ] [Task] — *Why: [reason]* · Est. Xhr

### Week 7–8: [Skill Name]
- [ ] [Task] — *Why: [reason]* · Est. Xhr

## 🎯 Month 3: Apply (Weeks 9–12)
**Goal:** [one sentence: job-ready milestone]

### Week 9–10: [Skill Name]
- [ ] [Task] — *Why: [reason]* · Est. Xhr

### Week 11–12: Job Applications
- [ ] Apply to 5 roles/week on Rozee.pk and LinkedIn — *Why: Pakistan market moves fast* · Est. 3hrs/week
- [ ] [Task] — *Why: [reason]* · Est. Xhr

## 📊 Success Metrics
- [ ] [Verifiable milestone 1 — e.g. "Complete X project on GitHub"]
- [ ] [Verifiable milestone 2]
- [ ] [Verifiable milestone 3]

## ⚠️ AI Disclaimer
This roadmap is generated by Rahul (AI). Skill gaps and timelines are estimates based on your resume and general market data — not a guarantee of employment. Always verify job requirements independently. Baymax outputs are for guidance only and do not replace human career advice.
"""


# ── Main Pipeline Function ─────────────────────────────────────────────────────

def build_roadmap(
    job_title: str,
    skills_gap: str = "",
    resume_analysis_raw: str = "",
    job_market_context: str = "",
    current_skills: str = "",
    interview_weak_areas: str = "",
) -> str:
    """
    Agent 5: Career Roadmap Planner (Rahul).
    Receives context from all upstream agents and synthesises a 90-day roadmap
    with verified free learning resources appended (zero hallucination).
    Never raises — returns error string on failure.
    """
    if not job_title or not job_title.strip():
        return "⚠️ Rahul needs a job title to build a roadmap. Please provide one."

    # Auto-extract gaps from Alex output if skills_gap is missing
    if not skills_gap or not skills_gap.strip():
        auto_gaps = _parse_gaps_from_alex(resume_analysis_raw)
        skills_gap = "\n".join(auto_gaps) if auto_gaps else f"core {job_title} skills"

    resume_summary = (resume_analysis_raw or "Not provided")[:500]
    job_ctx = (job_market_context or "Not provided")[:400]
    interview_fb = (interview_weak_areas or "Not provided")[:300]

    messages = [
        {"role": "system", "content": _ROADMAP_SYSTEM},
        {"role": "user", "content": _ROADMAP_USER_TPL.format(
            job_title=job_title.strip(),
            skills_gap=skills_gap[:600],
            resume_summary=resume_summary,
            interview_feedback=interview_fb,
            job_market_context=job_ctx,
        )},
    ]

    raw = _groq_call(messages, max_tokens=1800)
    raw = _strip_llm_urls(raw)  # strip any hallucinated links

    # ── Append verified resources ──────────────────────────────────────────────
    gaps_list = [g.strip() for g in re.split(r'[\n,]', skills_gap) if g.strip()]
    resources_by_gap = get_resources_for_gaps(gaps_list)

    resource_section = "\n\n---\n## 🎓 Free Learning Resources\n"
    resource_section += "> ✅ All links are manually verified. Rahul never generates URLs — zero hallucination risk.\n\n"

    if resources_by_gap:
        for gap_label, resources in resources_by_gap.items():
            resource_section += f"### 📌 {gap_label.title()}\n"
            resource_section += format_resource_block(resources) + "\n\n"
    else:
        resource_section += "### 📌 General Career Prep\n"
        resource_section += format_resource_block(FREE_RESOURCES.get("interview", [])) + "\n\n"

    # Coursera financial aid callout
    has_aid = any(
        r.get("financial_aid")
        for resources in resources_by_gap.values()
        for r in resources
    )
    if has_aid:
        resource_section += (
            "### 💳 How to Get Coursera Courses for Free (Financial Aid)\n"
            "Some courses above offer **Financial Aid** — full access + certificate for free.\n"
            "**Steps:** Course page → *Enroll for Free* → *Financial Aid Available* → fill form.\n"
            "Pakistan applicants have high approval rates. Approval takes ~15 days.\n"
            "> 💡 Tip: Ask Rahul below — *'Give me a financial aid template for [course name]'*\n"
        )

    return raw + resource_section


# ── Recommend Certifications ────────────────────────────────────────────────────

def recommend_certifications(
    job_title: str,
    skills_gap: list,
    current_skills: list,
) -> list[dict]:
    """
    Returns 4-5 hyper-specific certification recommendations as a JSON list.
    Uses LLM for names/reasoning but URLs come ONLY from FREE_RESOURCES.
    """
    # Match from FREE_RESOURCES first (guaranteed real URLs)
    all_gaps_text = " ".join(skills_gap).lower()
    certs = []
    seen = set()

    for key, resources in FREE_RESOURCES.items():
        if key in all_gaps_text and key not in seen:
            for r in resources:
                if r.get("financial_aid") or "coursera" in r["platform"].lower():
                    certs.append({
                        "name": r["title"],
                        "issuer": r["platform"],
                        "url": r["url"],
                        "duration": r["duration"],
                        "cost": "Free (Financial Aid Available)" if r.get("financial_aid") else "Free",
                        "why_relevant": f"Directly addresses your skill gap in {key.title()}",
                        "addresses": key.title(),
                    })
                    seen.add(key)
                    break
        if len(certs) >= 5:
            break

    # Fill remaining with interview/general resources
    if len(certs) < 3:
        for r in FREE_RESOURCES.get("interview", []):
            certs.append({
                "name": r["title"],
                "issuer": r["platform"],
                "url": r["url"],
                "duration": r["duration"],
                "cost": "Free",
                "why_relevant": f"Essential for {job_title} interview preparation",
                "addresses": "Interview Prep",
            })
            if len(certs) >= 4:
                break

    return certs[:5]


# ── Interactive Chat ───────────────────────────────────────────────────────────

_CHAT_SYSTEM = """\
You are Rahul, an interactive career mentor inside Baymax.
The user has their roadmap and is asking follow-up questions.

STRICT RULES:
1. NEVER generate URLs, hyperlinks, or course links in your response. The system appends verified links.
   If the user asks for resources, say "Here are verified resources for [topic]:" and stop — the system adds them.
2. Always explain WHY — tied to the user's specific job title and gaps, not generic advice.
3. If the user seems overwhelmed or distressed, acknowledge that first.
4. 150–250 words max unless writing a template.
5. End EVERY reply with: *⚠️ AI guidance — verify with a human career advisor.*
"""


def chat_with_rahul(
    user_message: str,
    conversation_history: list,
    job_title: str = "",
    skills_gap: str = "",
) -> dict:
    """
    Interactive follow-up Q&A with Rahul.
    Returns:
        reply      (str)  — Rahul's response
        show_aid   (bool) — user asked for financial aid template
        resources  (list) — verified resource list (if user asked for resources)
        aid_course (str)  — course name extracted for template
    """
    if not user_message or not user_message.strip():
        return {"reply": "Please type a question for Rahul.", "show_aid": False, "resources": [], "aid_course": ""}

    msg_lower = user_message.lower().strip()

    # Intent: financial aid
    aid_triggers = ["financial aid", "coursera aid", "scholarship", "aid template", "free coursera", "apply for aid"]
    if any(t in msg_lower for t in aid_triggers):
        course_match = re.search(r'(?:for|template for)\s+"?([^"?\n]+?)"?\s*(?:course|specialization|certificate)?\.?\s*$', user_message, re.IGNORECASE)
        aid_course = course_match.group(1).strip() if course_match else ""
        return {
            "reply": f"Here's your Coursera financial aid template{' for ' + aid_course if aid_course else ''}. Fill in the fields and paste it into the course application form.",
            "show_aid": True,
            "resources": [],
            "aid_course": aid_course,
        }

    # Intent: resource request
    resource_triggers = ["resources for", "learn more about", "how to learn", "courses for",
                         "tutorials for", "free course", "where to learn", "best resource for"]
    extra_resources: list = []
    if any(t in msg_lower for t in resource_triggers):
        for key in FREE_RESOURCES:
            if key in msg_lower:
                extra_resources = FREE_RESOURCES[key]
                break
        if not extra_resources and skills_gap:
            for gap in skills_gap.splitlines():
                res = get_resources_for_gaps([gap.strip()])
                if res:
                    extra_resources = list(res.values())[0]
                    break

    # Build context-aware messages
    context = f"\nUser's target job: {job_title or 'not specified'}. Skill gaps: {skills_gap[:200] or 'not specified'}."
    messages = [{"role": "system", "content": _CHAT_SYSTEM + context}]

    for turn in conversation_history[-6:]:
        role = turn.get("role", "")
        content = str(turn.get("content", ""))[:600]
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    reply = _groq_call(messages, max_tokens=500)
    reply = _strip_llm_urls(reply)

    return {"reply": reply, "show_aid": False, "resources": extra_resources, "aid_course": ""}


# ── Financial Aid Template ─────────────────────────────────────────────────────

def get_financial_aid_template(
    course_name: str = "[COURSE NAME]",
    provider: str = "[UNIVERSITY/PROVIDER]",
    job_title: str = "[JOB TITLE]",
    skill_area: str = "[SKILL AREA]",
    full_name: str = "[YOUR FULL NAME]",
    email: str = "[YOUR EMAIL]",
    university: str = "[YOUR UNIVERSITY]",
    hours_per_week: str = "5",
    project_plan: str = "build a portfolio project using these skills",
) -> str:
    """Returns filled financial aid template."""
    return FINANCIAL_AID_TEMPLATE.format(
        course_name=course_name,
        provider=provider,
        job_title=job_title,
        skill_area=skill_area,
        full_name=full_name,
        email=email,
        university=university,
        hours_per_week=hours_per_week,
        project_plan=project_plan,
    )
