import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function Header({
  models, model, onModel, personas, persona, onPersona,
  temperature, onTemperature, showHood, onToggleHood, onMenu, sidebarHidden, onToggleSidebar,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const wrapRef = useRef(null);

  // Close the settings popover when clicking anywhere else.
  useEffect(() => {
    const close = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setShowSettings(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <header className="topbar d-flex align-items-center gap-2">
      <button className="btn btn-glass d-lg-none" onClick={onMenu} aria-label="Open menu">
        <i className="bi bi-list" />
      </button>
      <button
        className="btn btn-glass d-none d-lg-inline-flex"
        onClick={onToggleSidebar}
        title={sidebarHidden ? "Show sidebar" : "Hide sidebar (more space for chat)"}
      >
        <i className={`bi ${sidebarHidden ? "bi-layout-sidebar" : "bi-layout-sidebar-inset"}`} />
      </button>

      <div className="select-pill">
        <i className="bi bi-cpu" />
        <select className="form-select form-select-sm" value={model} onChange={(e) => onModel(e.target.value)}>
          {models.length === 0 && <option>no model</option>}
          {models.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="select-pill">
        <span>{persona?.emoji}</span>
        <select className="form-select form-select-sm" value={persona?.id ?? ""} onChange={(e) => onPersona(e.target.value)}>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="ms-auto d-flex gap-2">
        <div className="position-relative" ref={wrapRef}>
          <motion.button
            className={`btn btn-glass ${showSettings ? "on" : ""}`}
            onClick={() => setShowSettings((s) => !s)}
            whileTap={{ scale: 0.92 }}
            title="Settings"
          >
            <motion.i className="bi bi-sliders" animate={{ rotate: showSettings ? 90 : 0 }} />
          </motion.button>
          <AnimatePresence>
            {showSettings && (
              <motion.div
                className="popover-card"
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.16 }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-semibold small">Temperature</span>
                  <span className="badge rounded-pill temp-badge">{Number(temperature).toFixed(1)}</span>
                </div>
                <input
                  type="range" className="form-range" min="0" max="1.5" step="0.1"
                  value={temperature} onChange={(e) => onTemperature(parseFloat(e.target.value))}
                />
                <div className="d-flex justify-content-between small text-secondary mb-2">
                  <span>🎯 Focused</span><span>🎨 Creative</span>
                </div>
                <p className="small text-secondary mb-0">
                  How randomly the model picks each next word. Ask the same question at 0 and at 1.5 and compare.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          className={`btn btn-glass ${showHood ? "on" : ""}`}
          onClick={onToggleHood}
          whileTap={{ scale: 0.95 }}
          title="Under the hood"
        >
          <i className="bi bi-braces" /><span className="d-none d-md-inline ms-2">Under the hood</span>
        </motion.button>
      </div>
    </header>
  );
}
