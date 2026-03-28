"""
tools/search_tool.py — Serper API Web Search Utility

Provides web_search() used by job_search_agent.py as a Firecrawl fallback.
Requires SERPER_API_KEY in environment.
"""

import os
import json
import requests


SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
SERPER_ENDPOINT = "https://google.serper.dev/search"


def web_search(query: str, num_results: int = 6) -> list[dict]:
    """
    Search the web using Serper API (Google Search results).

    Args:
        query:       Search query string
        num_results: Maximum number of results to return (default: 6)

    Returns:
        List of dicts with keys: title, link, snippet
        Returns [{"error": "..."}] if search fails.
    """
    if not SERPER_API_KEY:
        print("[SearchTool] SERPER_API_KEY not set — returning empty results")
        return [{"error": "SERPER_API_KEY not configured"}]

    try:
        response = requests.post(
            SERPER_ENDPOINT,
            headers={
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json",
            },
            json={"q": query, "num": num_results},
            timeout=10,
        )

        if not response.ok:
            print(f"[SearchTool] Serper returned {response.status_code}: {response.text[:200]}")
            return [{"error": f"Serper HTTP {response.status_code}"}]

        data = response.json()
        organic = data.get("organic", [])

        results = []
        for item in organic[:num_results]:
            results.append({
                "title":   item.get("title",   "N/A"),
                "link":    item.get("link",    "N/A"),
                "snippet": item.get("snippet", "N/A"),
            })

        return results if results else [{"error": "No results found"}]

    except requests.exceptions.Timeout:
        print("[SearchTool] Serper request timed out")
        return [{"error": "Search timed out"}]
    except Exception as e:
        print(f"[SearchTool] Serper search failed: {e}")
        return [{"error": str(e)}]
