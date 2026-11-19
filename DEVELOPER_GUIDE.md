# B2 Developer Guide

**B2** is a private, ChatGPT-style AI chatbot that runs on your own PC. It has a React interface, a small Python
server, web search and its own versioned AI model built on Ollama.

This guide explains **what was built, in what order, and how you (the developer) set it up, run it, change it and
upgrade it.**

---

## Contents
1. [How it works (architecture)](#1-how-it-works-architecture)
2. [What to download and install](#2-what-to-download-and-install)
3. [Project folder structure](#3-project-folder-structure)
4. [Build history: what was done, step by step](#4-build-history-what-was-done-step-by-step)
   - [4A. Every step in detail: what, why, how it works, how it helps](#4a-every-step-in-detail-what-why-how-it-works-how-it-helps)
5. [Running the app](#5-running-the-app)
6. [Modifying things](#6-modifying-things)
7. [Upgrading the model (versions)](#7-upgrading-the-model-versions)
8. [Troubleshooting](#8-troubleshooting)
9. [Command cheat sheet](#9-command-cheat-sheet)
10. [Licensing: can I sell it?](#10-licensing-can-i-sell-it)
11. [What to build next](#11-what-to-build-next)

---

## 1. How it works (architecture)

```
┌──────────────────────┐   /api/chat    ┌──────────────────────┐   /api/chat    ┌───────────────────────┐
│  Browser (React UI)  │ ─────────────▶ │  server.py (Python)  │ ─────────────▶ │  Ollama (port 11434)  │
│  frontend/src/...    │ ◀───────────── │  port 8000           │ ◀───────────── │  runs model b2:latest │
│  chat, history, UI   │  streamed text │  + web_search.py     │  token stream  │  on your GPU / CPU    │
└──────────────────────┘                └──────────┬───────────┘                └───────────────────────┘
                                                   │ (only when 🌐 Web is on)
                                                   ▼
                                       Wikipedia / Ollama Web Search
```

**The key ideas to remember:**

| Idea | What it means in this project |
|---|---|
| **The model has no memory** | The browser sends the **whole conversation** every time. That list *is* the memory. |
| **System prompt = personality** | `personas.json` and the `SYSTEM` line in the Modelfile tell the model who it is. |
| **Streaming** | Ollama sends one small JSON line per few words (NDJSON), so text appears live. |
| **Tokens** | Models read and write in tokens (word pieces). Speed = tokens/second. |
| **Context window (`num_ctx`)** | How many tokens the model can "see" at once. Set to 4096 for every request. |
| **RAG** | For web search, our code searches first and pastes the results into the prompt. The model never browses by itself. |
| **Modelfile** | A recipe that turns a base model into *your* model (`b2:v1`, `b2:v2`, …). |

---

## 2. What to download and install

Do these once, in this order. (Sizes and versions are what this project was built with.)

| # | What | Why | How |
|---|---|---|---|
| 1 | **Ollama** for Windows | Runs AI models locally | Install from ollama.com. It runs in the system tray and listens on `http://localhost:11434` |
| 2 | **Python 3.12** | Runs `server.py` (standard library only, no `pip install` needed) | python.org installer; check with `py --version` |
| 3 | **Node.js 24** | Builds the React interface | nodejs.org installer; check with `node --version` |
| 4 | **Base model for v2**: `qwen3:4b-instruct-2507-q4_K_M` (≈2.5 GB) | The brain B2 v2 is built on | `ollama pull qwen3:4b-instruct-2507-q4_K_M` |
| 5 | *(optional)* **Base model for v1**: `llama3.2` (≈2 GB) | Only needed for the v1 backup | `ollama pull llama3.2` |
| 6 | **React packages** (≈100 MB in `node_modules`) | React, Vite, Bootstrap, Framer Motion, … | `cd frontend` then `npm install` (`start.bat` does this automatically) |

> **Note:** `ollama` is not on the PATH on this PC. Either use the full path
> `"%LOCALAPPDATA%\Programs\Ollama\ollama.exe"` or add that folder to your PATH.

**Hardware it was tested on:** 16 GB RAM and an NVIDIA GTX 1650 Ti (4 GB). Measured speed:

| Model | Speed |
|---|---|
| v1 (llama3.2 3B) | ~40 tokens/s |
| v2 (Qwen3 4B) | ~22 tokens/s (partly on the CPU because the graphics card has only 4 GB of memory) |

### Frontend libraries used (`frontend/package.json`)
| Package | Purpose |
|---|---|
| `react`, `react-dom` | UI components |
| `vite`, `@vitejs/plugin-react` | Dev server with live reload, and production build |
| `bootstrap`, `bootstrap-icons` | Layout, form controls, icons |
| `framer-motion` | Animations (messages, sidebar, chat box moving down) |
| `react-markdown`, `remark-gfm` | Render answers with lists, tables and code blocks |

---

## 3. Project folder structure

```
personal-chatbot/
├── start.bat               ← double-click: builds UI on first run, starts server, opens browser
├── server.py               ← Python backend (serves UI, talks to Ollama, runs web search)
├── web_search.py           ← internet access (Wikipedia / Ollama Web Search) - RAG
├── personas.json           ← personalities: B2, Teacher, Code Buddy, Roast Bot
├── build_model.bat         ← builds a model version: build_model.bat v2
├── models/
│   ├── README.md           ← version table + licensing notes
│   ├── v1/Modelfile        ← B2 v1 = llama3.2 + personality
│   └── v2/Modelfile        ← B2 v2 = Qwen3 4B Instruct + personality
├── frontend/               ← React app (Vite)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js      ← dev server on 5173, forwards /api to Python on 8000
│   ├── dist/               ← the BUILT app (created by npm run build, served by server.py)
│   └── src/
│       ├── main.jsx        ← entry point, loads Bootstrap + styles
│       ├── App.jsx         ← the brain of the UI: chats, send(), streaming, settings
│       ├── api.js          ← all calls to server.py + reading the stream
│       ├── useLocalStorage.js ← saves chats/settings in the browser
│       ├── styles.css      ← theme: colours, glass panels, animations
│       └── components/
│           ├── Sidebar.jsx    ← chat history, search, new chat
│           ├── Header.jsx     ← model + persona pickers, settings, Under the hood button
│           ├── Welcome.jsx    ← "Hi, I'm B2" screen, persona chips, suggestions
│           ├── Message.jsx    ← one chat bubble, markdown, code blocks, sources
│           ├── Composer.jsx   ← the chat box, 🌐 web toggle, send/stop button
│           └── HoodPanel.jsx  ← learning panel: request JSON, tokens, speed
├── static/                 ← the first plain-HTML version (fallback only)
├── ollama_api_key.txt      ← (you create it, optional) key for Ollama Web Search. SECRET
├── .gitignore
├── README.md
└── DEVELOPER_GUIDE.md      ← this file
```

**Where things live outside the project:**
- AI models: `%USERPROFILE%\.ollama\models` (managed by Ollama, don't edit by hand)
- Chat history: inside your browser's storage for `localhost:8000` (clearing site data deletes it)

---

## 4. Build history: what was done, step by step

### Phase 1: Check the PC and plan
- Found Ollama running but **with no models**, Python 3.12 and Node 24 installed, and a GTX 1650 Ti (4 GB)
- Picked a **3B model** because it fits a 4 GB graphics card
- Downloaded `llama3.2` (≈2 GB) with `ollama pull llama3.2`

### Phase 2: First working chatbot (plain HTML)
- **`server.py`**: a tiny Python server (standard library only) that
  - serves the web page
  - forwards `POST /api/chat` to Ollama's `http://localhost:11434/api/chat`
  - streams the answer back line by line
- **`personas.json`**: 4 personalities, each just a system prompt
- **`static/`**: HTML/CSS/JS chat page with history, streaming, markdown and the **Under the hood** panel
- **`start.bat`**: one-click start

### Phase 3: Move to a permanent folder
- Moved from a temporary session folder to `Desktop\my-ai-chatbot\personal-chatbot`

### Phase 4: Rebuild the interface in React
- Created `frontend/` with **Vite + React**, split the UI into components (`Sidebar`, `Header`, `Message`, …)
- `api.js` reads the stream with `fetch` + `ReadableStream`
- `server.py` now serves `frontend/dist` (the built React app) and falls back to `static/` if it isn't built
- `start.bat` runs `npm install` + `npm run build` automatically the first time

### Phase 5: Modern design with Bootstrap and animations
- Added **Bootstrap 5** (dark mode), **Bootstrap Icons** and **Framer Motion**
- Animated aurora background, glass panels, spring animations on messages, a typing cursor, bouncing "thinking" dots
- Mac-style code blocks with a copy button, persona chips, suggestion cards

### Phase 6: More room for chat, ChatGPT-style chat box
- Chat area widened to 1400px, tighter spacing, slimmer top bar, **hide-sidebar** button
- New chat: a **big centered chat box**. After the first message it **glides down and shrinks** to a slim bar
  (Framer Motion `layoutId="composer"` animates between the two positions)

### Phase 7: Rename to B2
- Renamed Nova → **B2** everywhere, with a gradient "B2" logo and ⚡ icon
- B2's system prompt says Anubhav built it
- New welcome suggestions: "How do you work?", "Debug my code", "Plan my week", "Roast a bio"

### Phase 8: Internet access (web search / RAG)
- **`web_search.py`**:
  1. the model rewrites your question into a short **search query** (handles follow-ups like "what was its rover?")
  2. search **Wikipedia** (free, no key), or **Ollama Web Search** if `ollama_api_key.txt` exists
  3. paste the results into the prompt as an extra system message
  4. the model answers with `[1] [2]` citations
- Server sends extra stream events: `status` (searching), `search` (results), `prompt` (full prompt for Under the hood)
- UI: 🌐 toggle in the chat box, "Searching for…" animation, clickable **source cards**
- **Lesson:** DuckDuckGo blocks automated searches with a bot check, so it was dropped (never bypass bot checks)
- **Lesson:** changing `num_ctx` between requests makes Ollama **reload the model** (slow). It's now always 4096.

### Phase 9: Your own model, B2 v1
- `models/v1/Modelfile`: `FROM llama3.2` + `SYSTEM` personality + `PARAMETER` settings + `MESSAGE` examples
- `build_model.bat v1` creates `b2:v1` and points `b2:latest` at it
- The app automatically picks `b2:latest`

### Phase 10: B2 v2 on an Apache 2.0 base
- Switched the base to **Qwen3 4B**, which allows renaming, fine-tuning and selling
- **Lesson:** plain `qwen3:4b` is the **Thinking** variant. It always writes long reasoning first and ignores
  `think: false`. Fix: use **`qwen3:4b-instruct-2507-q4_K_M`**, which answers directly.
- Server checks each model's capabilities (`/api/show`) and sends `think: false` only to models that support it
- Deleted the unused Thinking model to free 2.5 GB

---

## 4A. Every step in detail: what, why, how it works, how it helps

Each step below shows the **exact command or file change**, **why** it was done, **how it works** under the hood,
and **how it helps** the project. Follow them in order to rebuild B2 from zero.

---

### Step 1: Check what's installed on the PC
```bash
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" list     # which AI models exist
py --version                                         # Python available?
node --version                                       # Node.js available?
```
Also checked RAM (16 GB) and the graphics card (GTX 1650 Ti, 4 GB).

- **Why:** before building anything you need to know your limits. The biggest limit for local AI is **GPU memory**.
- **How it works:** a model must be loaded into GPU memory (VRAM) to run fast. If it doesn't fit, Ollama puts part of
  it in normal RAM and runs that part on the CPU, which is much slower.
- **How it helps:** with 4 GB of VRAM, the right model size is **3B–4B parameters** (≈2–2.5 GB files). That decided every
  model choice afterwards.

---

### Step 2: Download the first model (llama3.2)
```bash
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull llama3.2
```
- **Why:** Ollama was installed but had **zero models**. Without a model there's nothing to chat with.
- **How it works:** `pull` downloads the model from Ollama's online library into `%USERPROFILE%\.ollama\models`.
  - The model is split into **blobs** (files named by their sha256 fingerprint).
  - The biggest blob (~1.9 GB) is the **weights**: ~3 billion numbers learned during training.
  - Small blobs hold the chat template, default settings and license.
  - A **manifest** lists which blobs make up "llama3.2".
- **How it helps:** gives a working brain that fits the GPU, at ~40 tokens/s on this PC.
- **Check it worked:** `ollama list` shows `llama3.2:latest  2.0 GB`.

---

### Step 3: Write the backend, `server.py`
```bash
py server.py        # runs on http://localhost:8000
```
- **Why:** the browser shouldn't talk to Ollama directly. A small server in the middle lets us add features
  (personas, web search, model checks) without changing Ollama.
- **How it works:**
  1. The browser sends `POST /api/chat` with the conversation.
  2. The server adds the persona's **system prompt** and forwards it to Ollama at `http://localhost:11434/api/chat`
     with `"stream": true`.
  3. Ollama replies with one JSON line per few words. The server **passes each line straight through** to the browser.
- **How it helps:** answers appear word by word. It uses only Python's standard library, so there's nothing to install.

---

### Step 4: Personas, `personas.json`
```json
{ "id": "coder", "name": "Code Buddy", "emoji": "💻", "system": "You are an expert programmer..." }
```
- **Why:** to show that one model can behave like many different bots.
- **How it works:** the `system` text is sent as the **first, hidden message** of every request. The model treats it
  as instructions about who it is.
- **How it helps:** you can add new bots (a teacher, a coder, a comedian) **without any training**, just by writing text.

---

### Step 5: First chat page (`static/`) and `start.bat`
- **Why:** to get a working end-to-end chatbot as early as possible, then improve it.
- **How it works:** plain HTML/JS reads the stream with `fetch()` + `getReader()`, adds each piece of text to the bubble,
  and saves chats in the browser's `localStorage`. `start.bat` opens the browser and runs `py server.py`.
- **How it helps:** proves the whole chain works (browser → server → Ollama → back). It's still the fallback if the
  React build is missing.

---

### Step 6: Move the project to a permanent folder
- **Why:** it was first created in a temporary session folder that gets deleted with the session.
- **How:** moved to `Desktop\my-ai-chatbot\personal-chatbot`.
- **How it helps:** the code is safe, and you can open it in VS Code or put it on GitHub.

---

### Step 7: Rebuild the interface in React
```bash
cd frontend
npm install          # downloads React, Vite, etc. into node_modules (~100 MB)
npm run build        # turns src/ into optimised files in dist/
```
- **Why:** plain HTML gets messy as features grow. React splits the UI into **components**.
- **How it works:**
  - **Vite** is the build tool. `npm run dev` gives live reload; `npm run build` makes the final files in `dist/`.
  - `server.py` serves `frontend/dist` if it exists, otherwise `static/`.
  - `vite.config.js` forwards `/api` calls from port 5173 to the Python server on 8000 during development.
- **How it helps:** each part (sidebar, message, chat box) lives in its own file, so it's easy to change and learn.

---

### Step 8: Install Bootstrap, icons and Framer Motion
```bash
npm install bootstrap@5.3.3 bootstrap-icons@1.11.3 framer-motion@11.11.17
```
- **Why:** to make it look modern and animated without writing everything from scratch.
- **How it works:**
  - **Bootstrap** gives ready-made layout, buttons, forms and dark mode (`data-bs-theme="dark"`).
  - **Bootstrap Icons** is an icon font (`<i className="bi bi-send" />`).
  - **Framer Motion** animates React elements (`<motion.div initial={...} animate={...}>`).
- **How it helps:** the glass panels, spring animations and aurora background make it something you can show off.

---

### Step 9: ChatGPT-style layout
- **Why:** answers were cramped and needed too much scrolling.
- **How it works:**
  - Chat width went from 860px to 1400px, with tighter spacing and a slimmer top bar.
  - A new chat shows a **big centered chat box**. After sending, the same box moves to the bottom as a slim bar.
  - Both boxes share `layoutId="composer"`, so Framer Motion animates one into the other.
- **How it helps:** far more text fits on screen, and it feels familiar to anyone who has used ChatGPT.

---

### Step 10: Rename to B2
- **Why:** "Nova" is already a famous name. "B2" sounds like "Bittu," and it's short and unique.
- **How:** replaced the name in every file, made a gradient "B2" logo, and updated the persona prompt to say Anubhav
  built it.
- **How it helps:** it becomes *your* product with its own identity.

---

### Step 11: Internet access (web search / RAG), `web_search.py`
```bash
py web_search.py "James Webb telescope"    # test search on its own
```
- **Why:** a model's knowledge is frozen at its training date. Web search gives it fresh facts.
- **How it works (RAG = Retrieval-Augmented Generation):**
  1. The model rewrites your question into a short **search query**. For example, "what was its rover?" becomes
     "Chandrayaan-3 rover name".
  2. `web_search.py` searches **Wikipedia** (free, no key), or **Ollama Web Search** if `ollama_api_key.txt` exists.
  3. The results are pasted into the prompt as an extra system message.
  4. The model answers from that text and cites `[1] [2]`.
- **How it helps:** correct answers about things the model never learned, with sources you can click.
- **Why not DuckDuckGo:** it returned a bot-check page. Bot checks must never be bypassed, so a provider that
  allows apps was used instead.
- **Speed fix:** the server always sends `num_ctx: 4096`. If the context size changes between requests, Ollama
  **reloads the whole model** (≈10+ seconds).

---

### Step 12: Your own model, B2 v1 (Modelfile)
```bash
build_model.bat v1
# runs:  ollama create b2:v1 -f models\v1\Modelfile
#        ollama cp b2:v1 b2:latest
```
- **Why:** to have **your own named model** that knows it's B2, even outside the app.
- **How it works:** a **Modelfile** is a recipe:
  - `FROM llama3.2`: which brain to start from (no download, it reuses the existing files)
  - `SYSTEM """..."""`: a personality built into the model
  - `PARAMETER temperature 0.7`: default settings
  - `MESSAGE user/assistant`: example chats that teach the style

  `ollama create` packages this into a new model **without retraining**. It only adds small blobs, so it takes
  seconds. `ollama cp` makes `b2:latest` a **nickname** for that version.
- **How it helps:** the app always loads `b2:latest`. Upgrading B2 means building a new version and moving the
  nickname, with no app changes.

---

### Step 13: Download Qwen3 (the wrong variant) and learn from it
```bash
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull qwen3:4b     # ≈2.5 GB
```
- **Why:** llama3.2's license requires derived models to be named "Llama-…". Qwen3 is **Apache 2.0**, so you can
  rename it, fine-tune it and sell it. It's also smarter.
- **What went wrong:** `qwen3:4b` now points to the **Thinking-2507** variant. It always writes long hidden reasoning
  before answering (≈800 characters for "12×7"), which is ~20 seconds extra on this GPU. It also ignored `think: false`.
- **How it was found:** `ollama show` reported `general.finetune = Thinking`.
- **Safety step:** moved `b2:latest` back to v1 so the app kept working:
  ```bash
  "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" cp b2:v1 b2:latest
  ```

---

### Step 14: Download the right variant, Qwen3 Instruct
```bash
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull qwen3:4b-instruct-2507-q4_K_M    # ≈2.5 GB
```
- **Why:** the **Instruct** variant is the same brain and license, but it answers directly.
- **How to read the name:**
  - `4b` = 4 billion parameters
  - `instruct` = trained to follow instructions and chat
  - `2507` = July 2025 release
  - `q4_K_M` = **4-bit quantization**: numbers stored with 4 bits instead of 16, so ~4× smaller with little quality loss
- **How it helps:** a smarter base with a product-friendly license that still fits the PC.

---

### Step 15: Build B2 v2 and switch the app to it
```bash
build_model.bat v2        # FROM qwen3:4b-instruct-2507-q4_K_M
```
- **Server change:** `no_think()` asks Ollama (`/api/show`) whether a model supports "thinking", and sends
  `think: false` only to those models.
- **Tested:** "Main B2 hoon, Anubhav ne mujhe banaya hai. Namaste! 😊", correct Python code, ~22 tokens/s.
- **How it helps:** B2 is now on a base you can legally rename, fine-tune and sell.

---

### Step 16: Delete the unused model
```bash
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" rm qwen3:4b
```
- **Why:** nothing used it any more, and it took 2.5 GB.
- **How it works:** `rm` removes the model's manifest. Ollama then deletes only the blobs **no other model uses**, so
  `b2:v2` and its Instruct base are untouched.
- **How it helps:** frees disk space safely. Models built on the same base share files, so `ollama list` sizes add up to
  more than the real disk use.
- **Rule of thumb:** never delete a base model while a `b2` version is built `FROM` it (e.g. keep `llama3.2` while you
  keep `b2:v1`).

---

### Step 17: Write the documentation
- `README.md` covers quick start and features, `models/README.md` covers versions and licensing, and this guide covers
  everything else.
- **How it helps:** you (or anyone) can rebuild, change and upgrade B2 later without remembering every detail.

---

## 5. Running the app

### Normal use
1. Make sure **Ollama** is running (llama icon in the system tray)
2. Double-click **`start.bat`**. It opens http://localhost:8000
3. After changing anything: close the server window, run `start.bat` again, press **Ctrl+F5** in the browser

### Developer mode (live reload while editing the UI)
Run each in its own terminal:
```
py server.py                    # terminal 1 - backend on http://localhost:8000
cd frontend && npm run dev      # terminal 2 - React on http://localhost:5173
```
Open **http://localhost:5173**. Every save in `frontend/src` updates the page instantly.
When finished, run `npm run build` (in `frontend/`) so `start.bat` serves the new version.

### Run on a different port
```
set PORT=8001 && py server.py
```

### Let friends on the same Wi-Fi use it
In `server.py`, change `"127.0.0.1"` to `"0.0.0.0"`, restart, find your IP with `ipconfig`, and open
`http://<your-ip>:8000` on their phone. Windows will ask to allow it through the firewall.

---

## 6. Modifying things

| I want to… | Edit this | Then |
|---|---|---|
| Change a persona or add a new one | `personas.json` (`id`, `name`, `emoji`, `system`) | Refresh the browser |
| Change colours, sizes, animations | `frontend/src/styles.css` (colours are at the top in `:root`) | `npm run build` |
| Change the welcome text or suggestions | `frontend/src/components/Welcome.jsx` (`SUGGESTIONS` list) | `npm run build` |
| Change the chat box | `frontend/src/components/Composer.jsx` | `npm run build` |
| Change how answers look (code blocks, sources) | `frontend/src/components/Message.jsx` | `npm run build` |
| Change what is sent to the model | `server.py` → `handle_chat()` | Restart the server |
| Change temperature / context size defaults | `server.py` → `options` (and the Modelfile `PARAMETER`s) | Restart the server |
| Change web search (provider, number of results) | `web_search.py` (`MAX_RESULTS`, `CHARS_PER_RESULT`) | Restart the server |
| Turn on full web + news search | Create `ollama_api_key.txt` with your key from ollama.com → Settings → API keys | Restart the server |
| Change B2's built-in identity | `models/vX/Modelfile` (`SYSTEM`, `MESSAGE`) | `build_model.bat vX` |

> **Persona vs Modelfile:** when the app sends a persona's system prompt, it **replaces** the Modelfile's `SYSTEM`
> for that chat. The Modelfile identity is used when B2 runs without a persona (terminal, other apps) and is what a
> future fine-tune builds on. Keep both in sync.

### Server API (for your own tools)
| Method + path | Returns |
|---|---|
| `GET /api/models` | `{"models": ["b2:latest", …]}` |
| `GET /api/personas` | contents of `personas.json` |
| `GET /api/web-status` | `{"provider": "Wikipedia"}` or `"Ollama Web Search"` |
| `POST /api/chat` | NDJSON stream. Body: `{model, system, temperature, web, messages:[{role, content}]}` |

Stream lines from `/api/chat`:
```
{"status":"searching","query":"..."}           ← web mode only
{"search":{"query","provider","results":[…]}}  ← web mode only
{"prompt":[ …exact messages sent… ]}
{"message":{"content":"Hel"},"done":false}     ← answer pieces (from Ollama)
{"done":true,"eval_count":42,…}                ← final stats
```

---

## 7. Upgrading the model (versions)

### How versions work
```
models/v1/Modelfile  ──build_model.bat v1──▶  b2:v1 ─┐
models/v2/Modelfile  ──build_model.bat v2──▶  b2:v2 ─┼──▶  b2:latest  ◀── the app uses this
models/v3/...        ──build_model.bat v3──▶  b2:v3 ─┘     (a nickname that points at one version)
```

| Version | Base | Status |
|---|---|---|
| v1 | `llama3.2` 3B | Backup |
| **v2** | `qwen3:4b-instruct-2507-q4_K_M` | **Current** (`b2:latest`) |
| v3 | v2 + your own fine-tune | Next |

### Make a new version (no training)
1. Copy `models/v2` → `models/v3`
2. Edit `models/v3/Modelfile`: change `FROM` (a new base model), `SYSTEM`, `PARAMETER`s or `MESSAGE` examples
3. If it's a new base model: `ollama pull <model-name>` first
4. Run `build_model.bat v3`. This creates `b2:v3` and moves `b2:latest` to it
5. Test in the app. Update the table in `models/README.md`

> When picking a new base model: check its **license** (Apache 2.0 / MIT for a product), its **size**
> (≈2–3 GB fits a 4 GB GPU) and that it's an **Instruct** model, not a "Thinking" one.

### Roll back
```
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" cp b2:v1 b2:latest
```

### Fine-tune your own version (v3): the real "training" step
1. **Collect data**: 200–1000+ example chats in a `.jsonl` file, one per line:
   `{"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"ideal B2 answer"}]}`
2. **Train a LoRA** (a small "add-on" to the model) with **Unsloth** on a free **Google Colab** GPU,
   starting from `Qwen3-4B-Instruct-2507`
3. **Export** the result to a `.gguf` file (Unsloth can do this directly)
4. Put it in `models/v3/` and write a Modelfile: `FROM ./b2-v3.gguf` (plus `SYSTEM`, `PARAMETER`s)
5. `build_model.bat v3`, test, compare against v2 on the same questions

---

## 8. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "No models. Run: ollama pull…" | Ollama has no model, or isn't running | Start Ollama; `ollama list`; build `b2` |
| Old design still shows | Browser cache, or server started before the build | Restart `start.bat`, press **Ctrl+F5** |
| `ollama` is not recognized | Ollama isn't on the PATH | Use `"%LOCALAPPDATA%\Programs\Ollama\ollama.exe"` |
| Port 8000 is busy | Another copy of the server is running | Close the other window, or `set PORT=8001` |
| Answer shows reasoning and `</think>` | A "Thinking" model variant is used | Use an **Instruct** variant as the base |
| Slow answers | Model too big for the GPU, or `num_ctx` keeps changing | Use a smaller model; keep `num_ctx` fixed at 4096 |
| Web search: "Web search failed" | No internet, or the provider is down | Check the connection; turn 🌐 off |
| Web answers are about the wrong thing | The search query was poor | Ask more specifically; check the query in **Under the hood** |
| Chat history disappeared | Browser site data was cleared | History lives in the browser only |

---

## 9. Command cheat sheet

```bash
# ---- Ollama models ----
ollama list                                    # installed models
ollama ps                                      # loaded models + GPU/CPU split
ollama pull qwen3:4b-instruct-2507-q4_K_M      # download a base model
ollama run b2 "Who are you?"                   # chat with B2 in the terminal
ollama show b2:latest --modelfile              # see B2's recipe
ollama cp b2:v1 b2:latest                      # roll back to v1
ollama rm <model>                              # delete a model

# ---- B2 project ----
build_model.bat v2                             # build a model version
py server.py                                   # start the backend
py web_search.py "James Webb telescope"        # test web search alone

# ---- React UI (inside frontend/) ----
npm install                                    # install packages (first time)
npm run dev                                    # live-reload dev server on :5173
npm run build                                  # build into frontend/dist

# ---- Talk to Ollama directly ----
curl.exe http://localhost:11434/api/chat -d "{\"model\":\"b2\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"stream\":false}"
```

---

## 10. Licensing: can I sell it?

*(Not legal advice. Read each license before selling.)*

| Part | License | Can I sell? |
|---|---|---|
| Your code (UI, server, web search, scripts) | Yours | ✅ Yes |
| B2 v2 base: **Qwen3 4B** | Apache 2.0 | ✅ Yes, rename and fine-tune freely; keep the license notice |
| B2 v1 base: **llama3.2** | Llama 3.2 Community License | ⚠️ Yes, but show "Built with Llama", follow Meta's policy, and the model name must start with "Llama" |
| Ollama | MIT | ✅ Yes |
| React, Bootstrap, Framer Motion, Vite | MIT | ✅ Yes |
| Wikipedia text (web search results) | CC BY-SA | Fine to show with links; don't resell the text itself |
| Your training data | Must be yours or licensed | You are responsible |

**To actually sell it you'll also need:** a server with a GPU (customers can't use your PC) or an installer that runs
locally on the customer's machine, user accounts, and a privacy policy.

---

## 11. What to build next

- [ ] **Fine-tune B2 v3** on your own example chats (Unsloth + Colab) — the step that makes B2 truly yours
- [ ] **Chat with your documents**: upload PDFs and notes, embed them (`ollama pull nomic-embed-text`), search them (RAG)
- [ ] **Tool calling**: let B2 decide by itself when to search, calculate or check the time
- [ ] **Voice**: speech-to-text (Whisper) and text-to-speech
- [ ] **Save chats on the server** (SQLite) instead of in the browser
- [ ] **Login + deploy** to a cloud GPU so friends can use it from anywhere
- [ ] **Train a tiny GPT from scratch** (nanoGPT) to understand what happens inside the model
