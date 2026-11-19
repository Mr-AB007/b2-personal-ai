import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { getModels, getPersonas, getWebStatus, streamChat } from "./api.js";
import { useLocalStorage } from "./useLocalStorage.js";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Welcome from "./components/Welcome.jsx";
import Message from "./components/Message.jsx";
import Composer from "./components/Composer.jsx";
import HoodPanel from "./components/HoodPanel.jsx";

export default function App() {
  // ---- saved in the browser ----
  const [chats, setChats] = useLocalStorage("nova.chats", []); // [{id, title, persona, messages}]
  const [currentId, setCurrentId] = useLocalStorage("nova.currentId", null);
  const [model, setModel] = useLocalStorage("nova.model", "");
  const [temperature, setTemperature] = useLocalStorage("nova.temp", 0.7);
  const [personaId, setPersonaId] = useLocalStorage("nova.persona", "assistant");
  const [sidebarHidden, setSidebarHidden] = useLocalStorage("nova.sidebarHidden", false);
  const [webOn, setWebOn] = useLocalStorage("b2.web", false); // 🌐 internet search on/off
  const [webProvider, setWebProvider] = useState("Wikipedia");
  const [lastSearch, setLastSearch] = useState(null);

  // ---- only for this visit ----
  const [personas, setPersonas] = useState([]);
  const [models, setModels] = useState([]);
  const [status, setStatus] = useState({ ok: null, text: "Checking Ollama…" });
  const [streaming, setStreaming] = useState(false);
  const [lastRequest, setLastRequest] = useState(null);
  const [lastStats, setLastStats] = useState(null);
  const [showHood, setShowHood] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  const chat = chats.find((c) => c.id === currentId);
  const activePersonaId = chat?.persona ?? personaId;
  const persona = personas.find((p) => p.id === activePersonaId) ?? personas[0];

  // Load personas + models once when the page opens.
  useEffect(() => {
    getPersonas().then(setPersonas).catch(() => {});
    getWebStatus().then((s) => setWebProvider(s.provider));
    getModels().then((res) => {
      if (res.error) return setStatus({ ok: false, text: res.error });
      if (!res.models.length) return setStatus({ ok: false, text: "No models. Run: ollama pull llama3.2" });
      setModels(res.models);
      setStatus({ ok: true, text: `Ollama ready · ${res.models.length} model${res.models.length > 1 ? "s" : ""}` });
      // Use my own model (b2:latest) by default, unless I picked another one myself.
      const mine = res.models.includes("b2:latest") ? "b2:latest" : null;
      setModel((m) => {
        if (mine && !localStorage.getItem("b2.modelPicked")) return mine;
        return res.models.includes(m) ? m : mine ?? res.models[0];
      });
    });
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chat?.messages]);

  // Small helper: change one chat immutably (React needs new objects to re-render).
  const updateChat = (id, fn) => setChats((all) => all.map((c) => (c.id === id ? fn(c) : c)));

  async function send(text, history) {
    if (!text.trim() || streaming || !model) return;

    // 1. Find or create the chat and add the user's message.
    let id = currentId;
    let base = history ?? chat?.messages ?? [];
    if (!chat) {
      id = Date.now().toString();
      setChats((all) => [...all, { id, title: text.slice(0, 40), persona: personaId, messages: [] }]);
      setCurrentId(id);
      base = [];
    }
    const messages = [...base, { role: "user", content: text }];
    updateChat(id, (c) => ({ ...c, messages: [...messages, { role: "assistant", content: "", streaming: true }] }));

    // 2. Build the request. The WHOLE conversation goes every time - the model has no memory.
    const request = {
      model,
      system: persona?.system,
      temperature,
      web: webOn, // ask the server to search the internet first
      messages: messages.map(({ role, content }) => ({ role, content })),
    };
    setLastRequest(request);
    setLastSearch(null);

    // 3. Stream the answer into the last (assistant) message.
    const setLast = (fn) =>
      updateChat(id, (c) => {
        const msgs = [...c.messages];
        msgs[msgs.length - 1] = fn(msgs[msgs.length - 1]);
        return { ...c, messages: msgs };
      });

    abortRef.current = new AbortController();
    setStreaming(true);
    try {
      await streamChat(request, {
        signal: abortRef.current.signal,
        onToken: (t) => setLast((m) => ({ ...m, searching: null, content: m.content + t })),
        onEvent: (e) => {
          if (e.status === "searching") setLast((m) => ({ ...m, searching: { query: e.query } }));
          if (e.search) {
            setLastSearch(e.search);
            setLast((m) => ({ ...m, searching: { query: e.search.query, reading: true }, sources: e.search.results, searchError: e.search.error }));
          }
          if (e.prompt) setLastRequest((r) => ({ ...r, fullPrompt: e.prompt }));
        },
        onDone: (d) => {
          const tokens = d.eval_count || 0;
          const stats = {
            model: d.model,
            promptTokens: d.prompt_eval_count ?? 0,
            tokens,
            tps: tokens / ((d.eval_duration || 1) / 1e9),
            seconds: (d.total_duration || 0) / 1e9,
          };
          setLastStats(stats);
          setLast((m) => ({ ...m, stats }));
        },
      });
    } catch (err) {
      if (err.name !== "AbortError") setLast((m) => ({ ...m, error: err.message }));
    } finally {
      setLast((m) => ({ ...m, streaming: false, searching: null }));
      setStreaming(false);
    }
  }

  // Ask again: drop the last answer and resend the last question.
  function regenerate() {
    const msgs = chat.messages;
    const lastUser = msgs.findLastIndex((m) => m.role === "user");
    send(msgs[lastUser].content, msgs.slice(0, lastUser));
  }

  function newChat() {
    setCurrentId(null);
    setSidebarOpen(false);
  }

  function choosePersona(id) {
    setPersonaId(id);
    if (chat) updateChat(chat.id, (c) => ({ ...c, persona: id }));
  }

  const isEmpty = !chat?.messages.length;
  const composerProps = {
    streaming,
    disabled: !model,
    personaName: persona?.name ?? "B2",
    onSend: (t) => send(t),
    onStop: () => abortRef.current?.abort(),
    webOn,
    webProvider,
    onToggleWeb: () => setWebOn((w) => !w),
  };

  return (
    <div className="app">
      {/* Animated "aurora" background: three blurred blobs slowly drifting */}
      <div className="aurora" aria-hidden="true">
        <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
        <div className="grid-overlay" />
      </div>
      <Sidebar
        chats={chats}
        currentId={currentId}
        personas={personas}
        status={status}
        open={sidebarOpen}
        hidden={sidebarHidden}
        onSelect={(id) => { setCurrentId(id); setSidebarOpen(false); }}
        onNew={newChat}
        onDelete={(id) => {
          setChats((all) => all.filter((c) => c.id !== id));
          if (id === currentId) setCurrentId(null);
        }}
        onClose={() => setSidebarOpen(false)}
      />

      <main>
        <Header
          models={models}
          model={model}
          onModel={(m) => { setModel(m); try { localStorage.setItem("b2.modelPicked", "1"); } catch {} }}
          personas={personas}
          persona={persona}
          onPersona={choosePersona}
          temperature={temperature}
          onTemperature={setTemperature}
          showHood={showHood}
          onToggleHood={() => setShowHood((s) => !s)}
          onMenu={() => setSidebarOpen(true)}
          sidebarHidden={sidebarHidden}
          onToggleSidebar={() => setSidebarHidden((h) => !h)}
        />

        <LayoutGroup>
          <div className={`messages ${isEmpty ? "empty" : ""}`} ref={scrollRef}>
            <div className="messages-inner">
              {isEmpty ? (
                // New chat: the chat box sits big in the middle, like ChatGPT
                <Welcome personas={personas} persona={persona} onPersona={choosePersona} onAsk={(t) => send(t)}>
                  <Composer hero {...composerProps} />
                </Welcome>
              ) : (
                chat.messages.map((m, i) => (
                  <Message
                    key={i}
                    message={m}
                    persona={persona}
                    isLast={i === chat.messages.length - 1}
                    canRegenerate={!streaming && m.role === "assistant"}
                    onRegenerate={regenerate}
                  />
                ))
              )}
            </div>
          </div>

          {/* After the first message the same box glides down and shrinks into a slim bar */}
          {!isEmpty && <Composer {...composerProps} />}
        </LayoutGroup>
      </main>

      <AnimatePresence>
        {showHood && <HoodPanel request={lastRequest} stats={lastStats} search={lastSearch} onClose={() => setShowHood(false)} />}
      </AnimatePresence>
    </div>
  );
}
