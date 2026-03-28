"""
interview_agent.py — Sam: Personalized Multi-Turn Interview Coach

Every session is unique — questions are generated dynamically from the
candidate's specific resume, job title, and skill gaps.
"""

from groq import Groq
from config import GROQ_API_KEY
import json
import random

client = Groq(api_key=GROQ_API_KEY)

# ── System Prompt ──────────────────────────────────────────────────────────────

INTERVIEW_SYSTEM = """You are Sam, a warm but rigorous technical interviewer at a top Pakistan tech company.
Your personality: Professional, encouraging, but realistic. You push candidates to think deeper.

PERSONALIZATION RULES:
- Study the candidate's resume and ask questions SPECIFIC to their projects, tech stack, and companies
- Reference their actual project names, tools, and experiences in follow-ups
- Mix: 50% technical (specific to their stack), 30% behavioral (their real projects), 20% system design
- Never ask generic questions if you have resume context — be specific

STRUCTURE:
1. Ask ONE question at a time. Keep it concise (max 2 sentences).
2. Listen to the answer then probe if shallow.
3. After 3 exchanges on a topic, move to next.
4. Total 5-6 questions.
5. Never reveal you are AI — stay in character as Sam throughout.

QUESTION VARIETY (pick randomly each session, avoid same patterns):
- Open with: "Tell me about [SPECIFIC_PROJECT]" OR "Walk me through [THEIR_TECH]" OR "What's the hardest bug you fixed at [COMPANY]?"
- Never start with "Tell me about yourself" unless resume is empty
- For technical roles: ask about architecture decisions, tradeoffs, debugging specific to their stack
- For behavioral: reference their actual experiences "In your [PROJECT] project, how did you..."

SAFETY:
- If candidate seems distressed, acknowledge empathy before continuing.
- Never ask for real personal data (phone, home address, financial info).

When evaluating an answer, respond ONLY in this JSON format:
{
    "type": "feedback_and_next",
    "feedback": "brief specific feedback on their answer",
    "score": 7,
    "follow_up_or_next": "Your next personalized question here"
}

When starting, respond ONLY in this JSON format:
{
    "type": "first_question",
    "question": "Your opening personalized question here"
}
"""

# ── Question Openers (for variety each session) ────────────────────────────────

OPENERS = [
    "Walk me through your most challenging project — what was the hardest technical decision you made?",
    "Tell me about a time your code broke in production. What happened and how did you fix it?",
    "If you had to explain {job_title} responsibilities to a 10-year-old, what would you say?",
    "What's the most interesting problem you've solved recently in your work?",
    "Describe your development workflow — how do you go from idea to deployed feature?",
]

def start_interview(job_title: str, resume_summary: str) -> dict:
    """Start a new interview session. Returns first personalized question."""
    
    # Pick a random opener to vary across sessions
    opener_hint = random.choice(OPENERS).format(job_title=job_title)
    
    # Build a rich context prompt
    has_resume = resume_summary and len(resume_summary.strip()) > 30
    
    context = f"Job Title: {job_title}\n"
    if has_resume:
        context += f"Candidate Resume/Background:\n{resume_summary}\n\n"
        context += f"Based on their SPECIFIC resume above, ask a highly personalized opening question.\n"
        context += f"Reference their actual projects, companies, or tech stack — not generic questions.\n"
        context += f"Opening style suggestion: {opener_hint}"
    else:
        context += f"No resume provided. Use this opener: {opener_hint}"
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": INTERVIEW_SYSTEM},
            {
                "role": "user",
                "content": f"Start a personalized technical + behavioral interview.\n{context}\nGenerate the first question as JSON."
            }
        ],
        temperature=0.85,   # Higher temperature = more creative, varied questions
        max_tokens=300,
    )
    content = response.choices[0].message.content.strip()
    
    # Try to parse JSON, handling markdown code blocks
    try:
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content.strip())
    except Exception:
        return {"type": "first_question", "question": content}


def evaluate_answer(
    job_title: str,
    conversation_history: list,
    latest_answer: str,
    question_num: int,
    total_questions: int = 6,
) -> dict:
    """Evaluate one answer and get the next personalized question."""
    messages = [{"role": "system", "content": INTERVIEW_SYSTEM}]
    messages.extend(conversation_history)

    prompt_content = f'Candidate\'s answer: "{latest_answer}"\nQuestion {question_num} of {total_questions}.\n'
    
    if question_num >= total_questions:
        prompt_content += (
            "This is the LAST question. Provide final encouraging feedback and a summary score. "
            "Respond in JSON with type='feedback_and_next' and set follow_up_or_next to 'DONE'."
        )
    else:
        prompt_content += (
            "Evaluate specifically and ask the next personalized question based on their answer. "
            "If they mentioned a specific tool/project in their answer, probe deeper on that."
        )

    messages.append({"role": "user", "content": prompt_content})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.75,
        max_tokens=400,
    )
    content = response.choices[0].message.content.strip()
    
    try:
        if "```" in content:
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content.strip())
    except Exception:
        return {
            "type": "feedback_and_next",
            "feedback": content,
            "score": 7,
            "follow_up_or_next": "Can you elaborate on a recent technical challenge you faced?"
        }


def transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe audio using Groq Whisper."""
    transcription = client.audio.transcriptions.create(
        file=("audio.wav", audio_bytes, "audio/wav"),
        model="whisper-large-v3",
        language="en",
    )
    return transcription.text


def generate_interview(job_title: str, resume_summary: str, candidate_answers: str = "") -> str:
    """Backward-compatible batch mode for pipeline integration."""
    user_prompt = f"Generate a complete 6-question personalized interview for {job_title}.\nResume: {resume_summary}\n"
    if candidate_answers:
        user_prompt += f"Candidate answers to evaluate: {candidate_answers}\n"
    else:
        user_prompt += "Generate questions only — make them specific to the resume provided.\n"

    user_prompt += "Include: 3 technical (specific to their stack), 2 behavioral (referencing their projects), 1 system design. End with score out of 10 and feedback."

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": INTERVIEW_SYSTEM},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.80,
        max_tokens=1500,
    )
    return response.choices[0].message.content