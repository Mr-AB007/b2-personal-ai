import { motion } from "framer-motion";

// The learning panel: shows exactly what the model receives, and how fast it answered.
export default function HoodPanel({ request, stats, search, onClose }) {
  // fullPrompt comes from the server and includes any web results it added.
  const sent = request && {
    model: request.model,
    options: { temperature: request.temperature },
    messages: request.fullPrompt ?? [{ role: "system", content: request.system }, ...request.messages],
  };

  const cards = [
    { icon: "bi-chat-left-text", label: "Messages sent", value: sent ? sent.messages.length : "–" },
    { icon: "bi-box-arrow-in-right", label: "Input tokens", value: stats?.promptTokens ?? "–" },
    { icon: "bi-box-arrow-right", label: "Output tokens", value: stats?.tokens ?? "–" },
    { icon: "bi-lightning-charge", label: "Speed", value: stats ? `${stats.tps.toFixed(1)}/s` : "–" },
  ];

  return (
    <motion.aside
      className="hood"
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
    >
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="mb-0 fw-bold"><i className="bi bi-braces me-2 text-gradient" />Under the hood</h6>
        <button className="btn btn-sm btn-glass" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg" /></button>
      </div>
      <p className="small text-secondary">
        The exact request sent to the model. The <b className="text-body">whole conversation</b> goes every time,
        because the model itself has no memory.
      </p>

      <div className="row g-2 mb-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            className="col-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i + 0.1 }}
          >
            <div className="stat-card">
              <i className={`bi ${c.icon} text-secondary`} />
              {/* key makes the number re-animate whenever it changes */}
              <motion.div key={String(c.value)} className="stat-value" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                {c.value}
              </motion.div>
              <div className="small text-secondary">{c.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {search && (
        <motion.div className="hood-search mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="section-label mb-2"><i className="bi bi-globe2 me-1" />Web search (RAG)</div>
          <div className="small mb-1">
            <span className="text-secondary">1. Model wrote the query:</span> <b>“{search.query}”</b>
          </div>
          <div className="small mb-1">
            <span className="text-secondary">2. Searched</span> <b>{search.provider}</b>
            <span className="text-secondary">, found</span> <b>{search.results.length}</b> <span className="text-secondary">results</span>
          </div>
          <div className="small text-secondary">
            3. Results were pasted into the prompt as an extra <code>system</code> message (see below). The model reads them
            and answers with [1] [2] citations.
          </div>
        </motion.div>
      )}

      <div className="section-label mb-2">Request JSON</div>
      <pre className="raw">{sent ? JSON.stringify(sent, null, 2) : "Send a message to see it here."}</pre>
    </motion.aside>
  );
}
