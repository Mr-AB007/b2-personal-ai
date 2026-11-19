// Personal Chatbot - frontend logic
// Chats are saved in your browser (localStorage), so they survive a refresh.

const $ = (id) => document.getElementById(id);
const state = {
  chats: load("chats", []),          // [{id, title, persona, messages:[{role, content}]}]
  currentId: load("currentId", null),
  personas: [],
  controller: null,                  // lets us cancel a streaming answer
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save() {
  try {
    localStorage.setItem("chats", JSON.stringify(state.chats));
    localStorage.setItem("currentId", JSON.stringify(state.currentId));
  } catch {}
}
const current = () => state.chats.find((c) => c.id === state.currentId);
const persona = () => state.personas.find((p) => p.id === $("personaSelect").value) || state.personas[0];

// ---------------- startup ----------------
async function init() {
  state.personas = await fetch("/api/personas").then((r) => r.json());
  $("personaSelect").innerHTML = state.personas
    .map((p) => `<option value="${p.id}">${p.emoji} ${p.name}</option>`).join("");

  const res = await fetch("/api/models").then((r) => r.json()).catch(() => ({ error: "Server offline" }));
  if (res.error || !res.models.length) {
    $("statusDot").className = "dot bad";
    $("statusText").textContent = res.error || "No models. Run: ollama pull llama3.2";
    $("modelSelect").innerHTML = `<option>no model</option>`;
  } else {
    $("statusDot").className = "dot ok";
    $("statusText").textContent = `Ollama ready · ${res.models.length} model(s)`;
    $("modelSelect").innerHTML = res.models.map((m) => `<option>${m}</option>`).join("");
    const saved = load("model", null);
    if (res.models.includes(saved)) $("modelSelect").value = saved;
  }
  $("temp").value = load("temp", 0.7);
  $("tempVal").textContent = $("temp").value;
  renderChatList();
  renderMessages();
}

// ---------------- rendering ----------------
function renderChatList() {
  $("chatList").innerHTML = "";
  [...state.chats].reverse().forEach((c) => {
    const li = document.createElement("li");
    li.className = c.id === state.currentId ? "active" : "";
    li.innerHTML = `<span>${escapeHtml(c.title)}</span><button class="del" title="Delete">✕</button>`;
    li.onclick = () => { state.currentId = c.id; save(); renderChatList(); renderMessages(); $("sidebar").classList.remove("open"); };
    li.querySelector(".del").onclick = (e) => {
      e.stopPropagation();
      state.chats = state.chats.filter((x) => x.id !== c.id);
      if (state.currentId === c.id) state.currentId = null;
      save(); renderChatList(); renderMessages();
    };
    $("chatList").appendChild(li);
  });
}

function renderMessages() {
  const chat = current();
  const box = $("messages");
  box.querySelectorAll(".msg").forEach((m) => m.remove());
  $("welcome").style.display = chat && chat.messages.length ? "none" : "block";
  if (!chat) return;
  if (chat.persona) $("personaSelect").value = chat.persona;
  chat.messages.forEach((m) => addBubble(m.role, m.content, m.meta));
}

function addBubble(role, content, meta) {
  const p = state.personas.find((x) => x.id === current()?.persona) || persona();
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `<div class="avatar">${role === "user" ? "🙂" : p.emoji}</div>
                   <div><div class="bubble"></div><div class="meta"></div></div>`;
  const bubble = div.querySelector(".bubble");
  if (role === "user") bubble.textContent = content;
  else bubble.innerHTML = markdown(content);
  if (meta) div.querySelector(".meta").textContent = meta;
  $("messages").appendChild(div);
  $("messages").scrollTop = $("messages").scrollHeight;
  return div;
}

// ---------------- sending a message ----------------
async function send(text) {
  text = text.trim();
  if (!text || state.controller) return;

  let chat = current();
  if (!chat) {
    chat = { id: Date.now().toString(), title: text.slice(0, 40), persona: persona().id, messages: [] };
    state.chats.push(chat);
    state.currentId = chat.id;
  }
  chat.messages.push({ role: "user", content: text });
  save(); renderChatList();
  $("welcome").style.display = "none";
  addBubble("user", text);
  $("input").value = ""; autoGrow();

  const div = addBubble("assistant", "");
  const bubble = div.querySelector(".bubble");
  bubble.classList.add("typing");

  const p = state.personas.find((x) => x.id === chat.persona) || persona();
  const request = {
    model: $("modelSelect").value,
    system: p.system,
    temperature: parseFloat($("temp").value),
    // The WHOLE conversation is sent every time - that's the model's only "memory".
    messages: chat.messages.map(({ role, content }) => ({ role, content })),
  };
  $("rawRequest").textContent = JSON.stringify(
    { model: request.model, options: { temperature: request.temperature },
      messages: [{ role: "system", content: request.system }, ...request.messages] }, null, 2);

  setBusy(true);
  let answer = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request), signal: state.controller.signal,
    });
    // Read the stream: each line is a JSON object with a small piece of the answer.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const data = JSON.parse(line);
        if (data.error) throw new Error(data.error);
        if (data.message?.content) {
          answer += data.message.content;
          bubble.innerHTML = markdown(answer);
          $("messages").scrollTop = $("messages").scrollHeight;
        }
        if (data.done) showStats(data, div);
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      bubble.innerHTML = `<span class="error">⚠ ${escapeHtml(err.message)}</span>`;
    }
  } finally {
    bubble.classList.remove("typing");
    if (answer) {
      chat.messages.push({ role: "assistant", content: answer, meta: div.querySelector(".meta").textContent });
      save();
    }
    setBusy(false);
  }
}

// Ollama's last chunk tells us how fast the model was. Great for learning!
function showStats(d, div) {
  const tokens = d.eval_count || 0;
  const secs = (d.eval_duration || 1) / 1e9;
  const tps = (tokens / secs).toFixed(1);
  const total = ((d.total_duration || 0) / 1e9).toFixed(1);
  div.querySelector(".meta").textContent = `${d.model} · ${tokens} tokens · ${tps} tok/s · ${total}s`;
  $("stats").innerHTML = [
    ["Prompt tokens (input)", d.prompt_eval_count ?? "-"],
    ["Answer tokens (output)", tokens],
    ["Speed", `${tps} tok/s`],
    ["Total time", `${total}s`],
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join("");
}

function setBusy(busy) {
  state.controller = busy ? new AbortController() : null;
  $("sendBtn").textContent = busy ? "Stop" : "Send";
  $("sendBtn").classList.toggle("stop", busy);
}

// ---------------- tiny markdown renderer ----------------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function markdown(src) {
  const parts = escapeHtml(src).split(/```/);
  return parts.map((part, i) => {
    if (i % 2 === 1) { // inside a code block
      const nl = part.indexOf("\n");
      const lang = nl > -1 ? part.slice(0, nl).trim() : "";
      const code = nl > -1 ? part.slice(nl + 1) : part;
      return `<div class="codeblock"><span class="lang">${lang}</span><button class="copy">copy</button><pre><code>${code.replace(/\n$/, "")}</code></pre></div>`;
    }
    let html = "", list = null;
    for (const line of part.split("\n")) {
      const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/), h = line.match(/^(#{1,3})\s+(.*)/);
      const type = ul ? "ul" : ol ? "ol" : null;
      if (list && list !== type) { html += `</${list}>`; list = null; }
      if (type) { if (!list) { html += `<${type}>`; list = type; } html += `<li>${inline((ul || ol)[1])}</li>`; }
      else if (h) html += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`;
      else if (line.trim()) html += `<p>${inline(line)}</p>`;
    }
    if (list) html += `</${list}>`;
    return html;
  }).join("");
}

// ---------------- events ----------------
$("composer").onsubmit = (e) => {
  e.preventDefault();
  if (state.controller) state.controller.abort();
  else send($("input").value);
};
$("input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("composer").requestSubmit(); }
});
function autoGrow() { const t = $("input"); t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
$("input").addEventListener("input", autoGrow);
$("newChat").onclick = () => { state.currentId = null; save(); renderChatList(); renderMessages(); $("input").focus(); };
$("temp").oninput = () => { $("tempVal").textContent = $("temp").value; localStorage.setItem("temp", $("temp").value); };
$("modelSelect").onchange = () => localStorage.setItem("model", JSON.stringify($("modelSelect").value));
$("personaSelect").onchange = () => { const c = current(); if (c) { c.persona = persona().id; save(); } };
$("hoodBtn").onclick = () => $("hood").classList.toggle("hidden");
$("menuBtn").onclick = () => $("sidebar").classList.toggle("open");
document.querySelectorAll(".suggestions button").forEach((b) => (b.onclick = () => send(b.textContent)));
$("messages").addEventListener("click", (e) => {
  if (!e.target.classList.contains("copy")) return;
  navigator.clipboard.writeText(e.target.parentElement.querySelector("code").textContent);
  e.target.textContent = "copied!"; setTimeout(() => (e.target.textContent = "copy"), 1200);
});

init();
