import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Sidebar({ chats, currentId, personas, status, open, hidden, onSelect, onNew, onDelete, onClose }) {
  const [query, setQuery] = useState("");
  const shown = [...chats].reverse().filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="scrim d-lg-none"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar d-flex flex-column gap-3 ${open ? "open" : ""} ${hidden ? "collapsed" : ""}`}>
        <div className="d-flex align-items-center gap-2 px-1">
          <motion.div className="logo" whileHover={{ rotate: -8, scale: 1.06 }}>
            <span className="logo-text">B2</span>
          </motion.div>
          <div className="flex-grow-1 lh-sm">
            <div className="fw-bold fs-6">B2</div>
            <small className="text-secondary">Private AI · runs on my PC</small>
          </div>
          <button className="btn btn-sm btn-link text-secondary d-lg-none" onClick={onClose} aria-label="Close menu">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <motion.button className="btn btn-gradient w-100 py-2" onClick={onNew} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
          <i className="bi bi-plus-lg me-2" />New chat
        </motion.button>

        <div className="input-group input-group-sm search">
          <span className="input-group-text"><i className="bi bi-search" /></span>
          <input className="form-control" placeholder="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="section-label">Recent</div>
        <ul className="list-unstyled chat-list flex-grow-1 mb-0">
          <AnimatePresence initial={false}>
            {shown.length === 0 && (
              <motion.li key="empty" className="text-secondary small px-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                No chats yet. Say hi! 👋
              </motion.li>
            )}
            {shown.map((c) => {
              const p = personas.find((x) => x.id === c.persona);
              const active = c.id === currentId;
              return (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className={`chat-item ${active ? "active" : ""}`}
                  onClick={() => onSelect(c.id)}
                >
                  {active && <motion.span layoutId="activeChat" className="chat-item-bg" />}
                  <span className="chat-emoji">{p?.emoji ?? "💬"}</span>
                  <span className="chat-title">{c.title}</span>
                  <button
                    className="btn btn-sm del"
                    title="Delete chat"
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                  >
                    <i className="bi bi-trash3" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>

        <div className="status-card d-flex align-items-center gap-2">
          <span className={`dot ${status.ok === true ? "ok" : status.ok === false ? "bad" : ""}`} />
          <small className="text-secondary text-truncate">{status.text}</small>
        </div>
      </aside>
    </>
  );
}
