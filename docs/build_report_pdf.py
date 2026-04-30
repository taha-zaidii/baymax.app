"""
docs/build_report_pdf.py
--------------------------------------------------------------------------------
Render PROJECT_REPORT.md to a styled PDF that matches the proposal's
visual theme (black section ribbons, red title bar, summary tables).

Pipeline:
    1.  Read PROJECT_REPORT.md
    2.  Convert to HTML with the `markdown` library (tables, fenced code,
        sane lists, attr-list, toc).
    3.  Wrap it in an HTML template that supplies print-friendly CSS:
            - red title rule under the title block
            - black section ribbons for each `<h2>` (mirrors the proposal)
            - clean tables, code blocks, callouts
            - footer page numbers via @page CSS
    4.  Hand the HTML to headless Chrome with `--print-to-pdf`. Chrome's
        renderer respects `@page`, modern CSS, and prints crisp PDFs
        without any TeX or pandoc dependency.

Run:
    python3 docs/build_report_pdf.py
Output:
    docs/Baymax_Project_Report.pdf
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import markdown


REPO_ROOT     = Path(__file__).resolve().parent.parent
REPORT_MD     = REPO_ROOT / "PROJECT_REPORT.md"
OUT_PDF       = REPO_ROOT / "docs" / "Baymax_Project_Report.pdf"
SCREENSHOTS   = REPO_ROOT / "docs" / "screenshots"

# Chrome on macOS — fallback to other locations if needed.
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    shutil.which("google-chrome") or "",
    shutil.which("chromium")     or "",
    shutil.which("chrome")       or "",
]

CSS = r"""
:root {
    --red: #e8272b;
    --red-dark: #b91c1c;
    --black: #0a0a0a;
    --grey-100: #f7f7f7;
    --grey-300: #d8d8d8;
    --grey-500: #6b6b6b;
    --grey-700: #2a2a2a;
}

@page {
    size: A4;
    margin: 18mm 16mm 22mm 16mm;
    @bottom-center {
        content: "Baymax  |  Page " counter(page);
        font-family: "DM Sans", "Helvetica Neue", sans-serif;
        font-size: 8pt;
        color: var(--grey-500);
    }
    @top-left {
        content: "CS 2005: Artificial Intelligence  |  Final Project Report  |  FAST NUCES Karachi";
        font-family: "DM Sans", "Helvetica Neue", sans-serif;
        font-size: 7.5pt;
        color: var(--grey-500);
    }
}

* { box-sizing: border-box; }

html, body {
    font-family: "DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #111;
    font-size: 10.2pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

body {
    margin: 0;
    padding: 0;
}

/* ── First-page title block, mirrors the proposal ─────────────────────── */

.cover {
    border-top: 4px solid var(--red);
    padding-top: 18pt;
    margin-bottom: 18pt;
}

.cover .label {
    font-family: "Syne", "DM Sans", sans-serif;
    font-weight: 800;
    color: var(--red);
    font-size: 13pt;
    letter-spacing: 0.06em;
    text-align: center;
    margin: 0;
}

.cover .sublabel {
    text-align: center;
    color: var(--grey-500);
    font-size: 10pt;
    margin: 3pt 0 0 0;
}

.cover .title {
    font-family: "Syne", "DM Sans", sans-serif;
    font-weight: 800;
    font-size: 36pt;
    text-align: center;
    margin: 16pt 0 0 0;
    letter-spacing: -0.01em;
    color: #000;
}

.cover .subtitle {
    text-align: center;
    color: #333;
    font-size: 12pt;
    margin: 4pt 0 18pt 0;
}

.cover .meta {
    border-top: 2px solid var(--red);
    border-bottom: 2px solid var(--red);
    padding: 0;
}

.cover .meta table {
    width: 100%;
    border-collapse: collapse;
}

.cover .meta td {
    padding: 8pt 10pt;
    text-align: center;
    border-right: 1px solid var(--grey-300);
}
.cover .meta td:last-child { border-right: none; }
.cover .meta td .k {
    font-size: 8pt;
    color: var(--grey-500);
    text-transform: uppercase;
    letter-spacing: 0.08em;
}
.cover .meta td .v {
    font-weight: 700;
    margin-top: 2pt;
}

.cover .members {
    margin-top: 12pt;
    background: var(--grey-100);
    border-left: 6px solid var(--red);
    padding: 0;
}
.cover .members table { width: 100%; border-collapse: collapse; }
.cover .members td {
    padding: 7pt 10pt;
    border-right: 1px solid var(--grey-300);
}
.cover .members td:last-child { border-right: none; }
.cover .members .leader {
    background: var(--red);
    color: #fff;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.06em;
    font-size: 9pt;
    text-align: center;
}
.cover .members .name {
    text-align: center;
    font-weight: 600;
}

/* ── Section headings — mirror proposal's black ribbon ─────────────────── */

h1.cover-only { display: none; }   /* the markdown's H1 is duplicated; hide it */

h2 {
    background: var(--black);
    color: #fff;
    font-family: "Syne", "DM Sans", sans-serif;
    font-weight: 800;
    font-size: 13.5pt;
    padding: 7pt 12pt;
    margin: 22pt 0 12pt 0;
    border-left: 4pt solid var(--red);
    page-break-after: avoid;
    break-after: avoid;
}

h3 {
    font-family: "Syne", "DM Sans", sans-serif;
    font-weight: 800;
    font-size: 11.2pt;
    margin: 14pt 0 4pt 0;
    color: #000;
    border-bottom: 1px solid var(--red);
    padding-bottom: 3pt;
    page-break-after: avoid;
    break-after: avoid;
}

h4 {
    font-family: "Syne", "DM Sans", sans-serif;
    font-weight: 700;
    font-size: 10pt;
    margin: 10pt 0 3pt 0;
    color: #222;
    page-break-after: avoid;
}

p { margin: 0 0 8pt 0; }

strong { color: #000; }

a { color: var(--red); text-decoration: none; word-break: break-word; }
a:hover { text-decoration: underline; }

ul, ol {
    margin: 0 0 8pt 0;
    padding-left: 18pt;
}
li { margin-bottom: 3pt; }

/* ── Tables ────────────────────────────────────────────────────────────── */

table {
    width: 100%;
    border-collapse: collapse;
    margin: 8pt 0 12pt 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
}
table thead tr { background: var(--red); color: #fff; }
table thead th {
    padding: 6pt 9pt;
    font-weight: 800;
    text-align: left;
    font-family: "Syne", "DM Sans", sans-serif;
    letter-spacing: 0.02em;
}
table tbody td {
    padding: 5pt 9pt;
    border-bottom: 1px solid var(--grey-300);
    vertical-align: top;
}
table tbody tr:nth-child(even) { background: #fafafa; }

/* ── Code blocks ───────────────────────────────────────────────────────── */

pre {
    background: #1b1b1b;
    color: #f1f1f1;
    border-left: 3pt solid var(--red);
    padding: 10pt 12pt;
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 8.4pt;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
    border-radius: 3pt;
    page-break-inside: avoid;
    margin: 6pt 0 12pt 0;
}
pre code { background: transparent; color: inherit; padding: 0; }

code {
    background: #f0f0f0;
    color: #b91c1c;
    padding: 1pt 4pt;
    border-radius: 3pt;
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 8.8pt;
}

/* ── Blockquotes / callouts ───────────────────────────────────────────── */

blockquote {
    border-left: 3pt solid var(--red);
    background: #fff5f5;
    color: #4a0000;
    padding: 8pt 12pt;
    margin: 8pt 0;
    font-size: 9.6pt;
    border-radius: 0 3pt 3pt 0;
}
blockquote p { margin: 0; }

/* ── Horizontal rules ─────────────────────────────────────────────────── */

hr {
    border: none;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--red), transparent);
    margin: 18pt 0;
}

/* ── Image / screenshot placeholders ──────────────────────────────────── */

img {
    max-width: 100%;
    border-radius: 4pt;
    border: 1px solid var(--grey-300);
    margin: 6pt 0;
}

/* ── Page breaks for big sections ─────────────────────────────────────── */

h2 + p,
h2 + table,
h2 + ul {
    page-break-before: avoid;
}

/* Avoid orphaned headings */
h2, h3, h4 {
    page-break-after: avoid;
}

/* Force a page break before each top-level "##" if the page is getting long */
.page-break {
    page-break-before: always;
    break-before: page;
}
"""


# A bespoke cover block we inject into the HTML so the title page mirrors the
# proposal's layout exactly. The Markdown's first big block is similar but,
# because Chrome's MD-rendered version is HTML-y, we replace it here with
# a stronger, table-based layout.
COVER_HTML = """
<div class="cover">
    <p class="label">ARTIFICIAL INTELLIGENCE LAB</p>
    <p class="sublabel">CS 2005  |  Final Project Report</p>

    <h1 class="title-real">Baymax</h1>
    <p class="subtitle">AI-Powered Career Coaching System for CS Students in Pakistan</p>

    <div class="meta">
        <table>
            <tr>
                <td><div class="k">Course</div><div class="v">CS 2005 — AI</div></td>
                <td><div class="k">Submission</div><div class="v">Spring 2026</div></td>
                <td><div class="k">Institution</div><div class="v">FAST NUCES KHI</div></td>
            </tr>
        </table>
    </div>

    <div class="members">
        <table>
            <tr>
                <td class="leader">Group<br/>Members</td>
                <td class="name">Taha Zaidi</td>
                <td class="name">Amna Khan</td>
                <td class="name">Kissa Zehra</td>
                <td class="name">Aiza Gazyani</td>
            </tr>
        </table>
    </div>
</div>
"""


def find_chrome() -> str | None:
    """Return a path to a usable Chrome/Chromium binary, or None."""
    for cand in CHROME_CANDIDATES:
        if cand and os.path.exists(cand) and os.access(cand, os.X_OK):
            return cand
    return None


def md_to_html(md_text: str) -> str:
    """Convert markdown to HTML with the extensions we need for tables, code, etc."""
    html_body = markdown.markdown(
        md_text,
        extensions=[
            "tables",
            "fenced_code",
            "sane_lists",
            "attr_list",
            "toc",
            "nl2br",
        ],
        output_format="html5",
    )
    # Strip the markdown's own front-matter cover block — we replace it with
    # COVER_HTML which mirrors the proposal's layout exactly. The block
    # starts at the first <div align="center"> and ends at its first </div>
    # *outside* of nested tables.  We just remove everything up to the first
    # horizontal rule (---) which the markdown renders as <hr/>.
    hr_idx = html_body.find("<hr")
    if hr_idx > 0:
        html_body = html_body[hr_idx + html_body[hr_idx:].find(">") + 1 :]

    # Add a screenshot inliner: any `<img src="docs/screenshots/...">` whose
    # file is missing should render a clear placeholder rather than a broken
    # image icon.
    html_body = inline_or_placeholder_screenshots(html_body)

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Baymax — CS 2005 Final Project Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>{CSS}</style>
</head>
<body>
{COVER_HTML}
{html_body}
</body>
</html>
"""


def inline_or_placeholder_screenshots(html: str) -> str:
    """
    Replace `<img src="docs/screenshots/<file>">` tags with either an inline
    file:// path (if the file exists) or a clear "Screenshot pending" tile.
    The MD already contains markdown image refs in the body, so this catches
    them after rendering.
    """
    import re

    def repl(m: re.Match) -> str:
        rel = m.group(1)
        full = (REPO_ROOT / rel).resolve()
        if full.exists():
            return f'<img src="{full.as_uri()}" alt="screenshot" />'
        # placeholder block
        name = full.name
        return (
            f'<div style="border:1px dashed #d8d8d8;background:#fafafa;'
            f'padding:18pt;text-align:center;border-radius:3pt;'
            f'margin:6pt 0;color:#6b6b6b;font-size:9pt;">'
            f'<strong>📷 Screenshot placeholder</strong><br/>'
            f'<code style="background:transparent;color:#6b6b6b;font-size:8.5pt;">{name}</code><br/>'
            f'<span style="font-size:8pt;">drop the PNG into <code style="background:transparent;color:#6b6b6b;">docs/screenshots/</code> and re-run the build</span>'
            f'</div>'
        )

    return re.sub(r'<img[^>]*src=["\'](docs/screenshots/[^"\']+)["\'][^>]*/?>', repl, html)


def render_pdf_with_chrome(html_path: Path, out_pdf: Path, chrome: str) -> None:
    """Print the local HTML file to a PDF via headless Chrome."""
    out_pdf.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",   # we own header/footer via @page CSS
        f"--print-to-pdf={out_pdf}",
        "--virtual-time-budget=8000",
        "--run-all-compositor-stages-before-draw",
        html_path.as_uri(),
    ]
    print(f"[pdf]  using {chrome}")
    print(f"[pdf]  rendering → {out_pdf}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stderr or result.stdout)
        # Fall back to old --headless flag (some Chrome versions reject =new)
        cmd[1] = "--headless"
        print("[pdf]  retry with legacy --headless")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            sys.stderr.write(result.stderr or result.stdout)
            raise RuntimeError("Chrome --print-to-pdf failed; see stderr above.")


def main() -> None:
    if not REPORT_MD.exists():
        sys.exit(f"Report markdown not found: {REPORT_MD}")

    chrome = find_chrome()
    if not chrome:
        sys.exit(
            "Could not locate a Chrome / Chromium binary. Install Google Chrome "
            "(or set CHROME_CANDIDATES in this script) and try again."
        )

    md_text = REPORT_MD.read_text(encoding="utf-8")
    html_doc = md_to_html(md_text)

    with tempfile.TemporaryDirectory() as tmp:
        html_path = Path(tmp) / "report.html"
        html_path.write_text(html_doc, encoding="utf-8")
        render_pdf_with_chrome(html_path, OUT_PDF, chrome)

    size_kb = OUT_PDF.stat().st_size / 1024
    print(f"[pdf]  ✓ wrote {OUT_PDF}  ({size_kb:,.0f} KB)")
    print(f"[pdf]    open with: open {OUT_PDF}")


if __name__ == "__main__":
    main()
