"""
config.py — Centralized configuration for Baymax AI
All settings pulled from environment variables via .env
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── API Keys ──────────────────────────────────────────────────────────────────
GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")
SERPER_API_KEY    = os.getenv("SERPER_API_KEY", "")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "fc-72b12ed462de43ccab20fc0e118129de")
MEM0_API_KEY      = os.getenv("MEM0_API_KEY",      "m0-GmuOrwaLpvuXBjhwGOrb06CgIDKr2Hvv8RsYaQBl")


# ── Groq Model Selection ──────────────────────────────────────────────────────
# Primary model: llama-3.3-70b-versatile  (smarter, slightly slower)
# Fast model:    mixtral-8x7b-32768       (blazing speed for quick tasks)
GROQ_MODEL      = os.getenv("GROQ_MODEL",      "llama-3.3-70b-versatile")
GROQ_MODEL_FAST = os.getenv("GROQ_MODEL_FAST", "mixtral-8x7b-32768")

# ── ChromaDB ─────────────────────────────────────────────────────────────────
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma_db")
CHROMA_COLLECTION  = "baymax_knowledge"

# ── Embedding Model ───────────────────────────────────────────────────────────
# Running locally via sentence-transformers — no API key needed
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# ── App ───────────────────────────────────────────────────────────────────────
APP_TITLE = os.getenv("APP_TITLE", "Baymax AI")
DEBUG     = os.getenv("DEBUG", "false").lower() == "true"

# ── Validation ────────────────────────────────────────────────────────────────
def validate_keys() -> list[str]:
    """Return list of missing required API keys."""
    missing = []
    if not GROQ_API_KEY:
        missing.append("GROQ_API_KEY")
    if not SERPER_API_KEY:
        missing.append("SERPER_API_KEY (optional but recommended)")
    return missing
