import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Composer({
  hero = false, streaming, disabled, personaName, onSend, onStop, webOn, webProvider, onToggleWeb,
}) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  // Grow the box as you type (up to a limit set in CSS).
  useEffect(() => {
    const t = ref.current;
    t.style.height = "auto";
    if (text) t.style.height = t.scrollHeight + "px"; // empty box stays one line
  }, [text]);

  // Focus the box when the page opens and after each answer.
  useEffect(() => { if (!streaming) ref.current?.focus(); }, [streaming]);

  function submit() {
    if (streaming) return onStop();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }

  const canSend = streaming || text.trim();

  return (
    <div className={`composer-wrap ${hero ? "hero" : ""}`}>
      {/* layoutId: Framer Motion animates this box from the middle to the bottom when it moves */}
      <motion.div
        layoutId="composer"
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        className={`composer ${hero ? "hero" : ""} ${streaming ? "busy" : ""}`}
      >
        {/* 🌐 internet toggle */}
        <motion.button
          type="button"
          className={`web-toggle ${webOn ? "on" : ""}`}
          onClick={onToggleWeb}
          whileTap={{ scale: 0.9 }}
          title={webOn ? `Web search ON (${webProvider}). Click to turn off` : "Web search OFF. Click to search the internet"}
        >
          <i className="bi bi-globe2" />
          <AnimatePresence initial={false}>
            {webOn && (
              <motion.span
                className="web-label"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
              >
                Web
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
        <textarea
          ref={ref}
          rows={hero ? 2 : 1}
          value={text}
          disabled={disabled}
          placeholder={
            disabled ? "No model available"
              : webOn ? `Ask ${personaName} anything. It will search the web first…`
              : `Message ${personaName}…  (Shift + Enter for a new line)`
          }
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
        />
        <motion.button
          className={`send-btn ${streaming ? "stop" : ""} ${canSend ? "ready" : ""}`}
          onClick={submit}
          disabled={!canSend}
          whileHover={canSend ? { scale: 1.08 } : {}}
          whileTap={canSend ? { scale: 0.9 } : {}}
          title={streaming ? "Stop" : "Send"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.i
              key={streaming ? "stop" : "send"}
              className={`bi ${streaming ? "bi-stop-fill" : "bi-arrow-up"}`}
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.15 }}
            />
          </AnimatePresence>
        </motion.button>
      </motion.div>
      <AnimatePresence>
        {webOn && (
          <motion.div
            className="web-note"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <i className="bi bi-globe2 me-1" />Web search is on ({webProvider}). Your question is sent to the search service.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
