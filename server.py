"""
Personal Chatbot - backend server
=================================

A tiny web server (Python standard library only, nothing to pip install) that:
  1. serves the chat web page from the  static/  folder
  2. forwards chat messages to Ollama (running on http://localhost:11434)
  3. streams Ollama's answer back to the browser, token by token

Run it:   py server.py      then open  http://localhost:8000

LEARNING NOTES
--------------
* An LLM has NO memory. Every time you send a message, the browser sends the
  WHOLE conversation (all previous messages) again. That list of messages is
  called the "context". Look at `messages` in handle_chat().
* The "system prompt" is a hidden first message that tells the model who it
  is and how to behave. Personas in personas.json are just system prompts.
* "Streaming": Ollama sends one small JSON line per generated token chunk,
  so you can watch the answer appear word by word.
"""

import json
import os
import urllib.request
import urllib.error
from datetime import date
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

import web_search  # our own file: gives B2 internet access

OLLAMA_URL = "http://localhost:11434"
PORT = int(os.environ.get("PORT", 8000))
ROOT = Path(__file__).parent
# Serve the React app once it is built (frontend/dist). If it isn't built yet,
# fall back to the original plain-HTML version in static/.
REACT_BUILD = ROOT / "frontend" / "dist"
STATIC_DIR = REACT_BUILD if (REACT_BUILD / "index.html").exists() else ROOT / "static"
PERSONAS_FILE = ROOT / "personas.json"
THINKING_CACHE = {}  # model name -> can it "think"? (see no_think)


class ChatHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    # ---------- GET routes ----------
    def do_GET(self):
        if self.path == "/api/models":
            return self.handle_models()
        if self.path == "/api/web-status":
            return self.send_json({"provider": web_search.provider_name()})
        if self.path == "/api/personas":
            return self.send_json(json.loads(PERSONAS_FILE.read_text(encoding="utf-8")))
        return super().do_GET()  # serve files from static/

    # ---------- POST routes ----------
    def do_POST(self):
        if self.path == "/api/chat":
            return self.handle_chat()
        self.send_error(404)

    def handle_models(self):
        """Ask Ollama which models are installed (`ollama list`)."""
        try:
            with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=5) as r:
                data = json.load(r)
            self.send_json({"models": [m["name"] for m in data.get("models", [])]})
        except urllib.error.URLError:
            self.send_json({"error": "Ollama is not running. Start the Ollama app."}, 503)

    def send_event(self, obj):
        """Send one line of JSON to the browser right away."""
        self.wfile.write((json.dumps(obj) + "\n").encode())
        self.wfile.flush()

    def no_think(self, model):
        """Some models (like Qwen3) can 'think' (write hidden reasoning) before answering.
        That's slow on a small GPU, so we switch it off for chat. Only models that
        support thinking accept this switch, so we ask Ollama first (and remember)."""
        if model not in THINKING_CACHE:
            try:
                req = urllib.request.Request(
                    f"{OLLAMA_URL}/api/show", data=json.dumps({"model": model}).encode(),
                    headers={"Content-Type": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=10) as r:
                    THINKING_CACHE[model] = "thinking" in json.load(r).get("capabilities", [])
            except Exception:
                THINKING_CACHE[model] = False
        return {"think": False} if THINKING_CACHE[model] else {}

    def make_search_query(self, model, messages):
        """Ask the model to turn the chat into a short search query.
        e.g. 'and who directed it?' (after talking about Inception) -> 'Inception film director'"""
        recent = "\n".join(f"{m['role']}: {m['content'][:300]}" for m in messages[-5:])
        prompt = (
            "Write ONE short web search query (max 8 words) that would find the answer to the "
            "user's LAST message. Reply with only the query, no quotes.\n\n" + recent
        )
        try:
            req = urllib.request.Request(
                f"{OLLAMA_URL}/api/generate",
                data=json.dumps({"model": model, "prompt": prompt, "stream": False, **self.no_think(model),
                                 "options": {"temperature": 0, "num_predict": 24, "num_ctx": 4096}}).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                q = json.load(r)["response"].strip().strip('"').splitlines()[0]
            return q or messages[-1]["content"]
        except Exception:
            return messages[-1]["content"]

    def handle_chat(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))

        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        # This is EXACTLY what gets sent to the model. The browser shows it
        # in the "Under the hood" panel so you can learn from it.
        messages = []
        if body.get("system"):
            messages.append({"role": "system", "content": body["system"]})
        history = body["messages"]  # [{"role": "user"|"assistant", "content": "..."}]
        messages += history

        options = {
            # temperature: 0 = predictable and focused, 1.5 = creative and random
            "temperature": float(body.get("temperature", 0.7)),
            # num_ctx = the model's "reading window" in tokens (chat + web results must fit).
            # Keep it the SAME for every request: changing it makes Ollama reload the model (slow).
            "num_ctx": 4096,
        }

        # ---------- 🌐 Web mode: search first, then let the model answer ----------
        if body.get("web"):
            try:
                self.send_event({"status": "searching"})
                query = self.make_search_query(body["model"], history)
                provider = web_search.provider_name()
                self.send_event({"status": "searching", "query": query, "provider": provider})
                results = web_search.search(query)
                self.send_event({"search": {
                    "query": query, "provider": provider,
                    "results": [{k: r[k] for k in ("title", "url", "snippet")} for r in results],
                }})
                if results:
                    context = web_search.build_context(results, date.today().strftime("%d %B %Y"), provider)
                    # Put the web results just before the user's latest message.
                    messages.insert(len(messages) - 1, {"role": "system", "content": context})
            except (BrokenPipeError, ConnectionResetError):
                return
            except Exception as e:
                self.send_event({"search": {"error": f"Web search failed: {e}", "results": []}})

        self.send_event({"prompt": messages})  # for the "Under the hood" panel

        payload = {"model": body["model"], "messages": messages, "stream": True, "options": options,
                   **self.no_think(body["model"])}
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/chat",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )

        try:
            with urllib.request.urlopen(req) as r:
                # Ollama answers with one JSON object per line. We pass each
                # line straight through to the browser as soon as it arrives.
                for line in r:
                    self.wfile.write(line)
                    self.wfile.flush()
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            self.wfile.write((json.dumps({"error": msg}) + "\n").encode())
        except urllib.error.URLError:
            self.wfile.write((json.dumps({"error": "Cannot reach Ollama. Is it running?"}) + "\n").encode())
        except (BrokenPipeError, ConnectionResetError):
            pass  # user pressed Stop / closed the tab

    # ---------- helpers ----------
    def send_json(self, obj, status=200):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        if args and "/api/chat" in str(args[0]):
            print("chat request ->", args[0])


if __name__ == "__main__":
    print(f"Personal Chatbot running at  http://localhost:{PORT}")
    print(f"Serving UI from: {STATIC_DIR.relative_to(ROOT)}")
    print("Press Ctrl+C to stop.")
    # 127.0.0.1 = only this PC can open it. Change to "0.0.0.0" to let
    # friends on the same Wi-Fi open http://<your-pc-ip>:8000
    ThreadingHTTPServer(("127.0.0.1", PORT), ChatHandler).serve_forever()
