"""
web_search.py - gives B2 access to the internet (standard library only)
=======================================================================

How "internet access" for an LLM works (this is called RAG):
  1. search()        -> ask a search service for the top results
  2. build_context() -> paste the results into the prompt as "web results"
  3. the model writes its answer from that fresh text, citing [1], [2], ...

The model itself never touches the internet. Our code does the searching and
just shows the model what it found.

Two search providers:
  * Ollama Web Search  - full web + news. Needs a FREE key from ollama.com
                         (Settings -> API keys). Put it in a file named
                         ollama_api_key.txt next to this file, or set the
                         OLLAMA_API_KEY environment variable.
  * Wikipedia          - used automatically when there is no key. No signup.
"""

import html
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "B2-PersonalChatbot/1.0 (personal learning project)"
MAX_RESULTS = 5
CHARS_PER_RESULT = 1100  # keep the prompt small: small models have small "context windows"
KEY_FILE = Path(__file__).parent / "ollama_api_key.txt"


def _api_key():
    key = os.environ.get("OLLAMA_API_KEY", "")
    if not key and KEY_FILE.exists():
        key = KEY_FILE.read_text(encoding="utf-8").strip()
    return key


def provider_name():
    return "Ollama Web Search" if _api_key() else "Wikipedia"


def _request_json(url, body=None, headers=None, timeout=12):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def _clean(text):
    """Remove HTML tags and decode things like &amp; -> &."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", text or ""))).strip()


# ---------------- provider 1: Ollama Web Search (needs free key) ----------------
def _search_ollama(query):
    data = _request_json(
        "https://ollama.com/api/web_search",
        body={"query": query, "max_results": MAX_RESULTS},
        headers={"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"},
    )
    return [
        {
            "title": r.get("title") or r.get("url", ""),
            "url": r.get("url", ""),
            "snippet": _clean(r.get("content", ""))[:220],
            "content": _clean(r.get("content", ""))[:CHARS_PER_RESULT],
        }
        for r in data.get("results", [])[:MAX_RESULTS]
    ]


# ---------------- provider 2: Wikipedia (no key) ----------------
def _search_wikipedia(query):
    api = "https://en.wikipedia.org/w/api.php?"
    found = _request_json(api + urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": query,
        "srlimit": MAX_RESULTS, "format": "json",
    }))["query"]["search"]
    if not found:
        return []

    # Second call: get the plain-text intro of each article we found.
    pages = _request_json(api + urllib.parse.urlencode({
        "action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1,
        "titles": "|".join(r["title"] for r in found), "format": "json",
    }))["query"]["pages"]
    intro = {p["title"]: p.get("extract", "") for p in pages.values()}

    return [
        {
            "title": r["title"],
            "url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(r["title"].replace(" ", "_")),
            "snippet": _clean(r.get("snippet", "")),
            "content": intro.get(r["title"], "")[:CHARS_PER_RESULT],
        }
        for r in found
    ]


def search(query):
    """Return [{title, url, snippet, content}] from the best available provider."""
    return _search_ollama(query) if _api_key() else _search_wikipedia(query)


def build_context(results, today, provider):
    """Turn the results into text the model can read."""
    parts = [
        f"Today's date is {today}. You searched the internet ({provider}) and found the results below.",
        "Answer the user's question using these results. Cite sources inline like [1] or [2].",
        "If the results don't contain the answer, say so honestly instead of guessing.",
        "",
    ]
    for i, r in enumerate(results, 1):
        parts.append(f"[{i}] {r['title']}\nURL: {r['url']}\n{r.get('content') or r['snippet']}\n")
    return "\n".join(parts)


if __name__ == "__main__":
    # Try it on its own:  py web_search.py "James Webb telescope"
    import sys

    q = " ".join(sys.argv[1:]) or "James Webb Space Telescope"
    print("Provider:", provider_name())
    for i, r in enumerate(search(q), 1):
        print(f"[{i}] {r['title']}\n    {r['url']}\n    {r['snippet'][:120]}\n    ({len(r['content'])} chars of text)\n")
