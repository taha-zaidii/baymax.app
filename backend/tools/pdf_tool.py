"""
tools/pdf_tool.py — PDF Text Extraction Utility

Tries pypdf first (modern), falls back to PyPDF2 (legacy).
Both are listed in requirements.txt.
"""

import os


def extract_text_from_pdf(path: str) -> str:
    """
    Extract all text from a PDF file.

    Args:
        path: Absolute or relative path to the PDF file

    Returns:
        Extracted text as a single string. Returns empty string on failure.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"PDF not found: {path}")

    # ── Try pypdf (modern, recommended) ──────────────────────────────────────
    try:
        from pypdf import PdfReader
        reader = PdfReader(path)
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        if text:
            return text
    except ImportError:
        pass
    except Exception:
        pass

    # ── Fallback: PyPDF2 (legacy) ──────────────────────────────────────────
    try:
        import PyPDF2
        with open(path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        if text:
            return text
    except ImportError:
        pass
    except Exception:
        pass

    raise RuntimeError(
        "Could not extract text from PDF. "
        "Ensure pypdf or PyPDF2 is installed and the file is not encrypted."
    )
