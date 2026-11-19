import { motion } from "framer-motion";

const SUGGESTIONS = [
  { icon: "bi-cpu", color: "#a78bfa", title: "How do you work?", text: "Explain how you work, step by step, like I'm a beginner" },
  { icon: "bi-bug", color: "#34d399", title: "Debug my code", text: "Find the bug: def add(a, b): return a - b" },
  { icon: "bi-calendar-check", color: "#60a5fa", title: "Plan my week", text: "Make me a 7-day study plan to learn DSA" },
  { icon: "bi-emoji-laughing", color: "#f472b6", title: "Roast a bio", text: "Roast this Instagram bio: 'Living my best life ✨ | Foodie | Wanderlust'" },
];

// Children appear one after another (stagger) when the screen loads.
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function Welcome({ personas, persona, onPersona, onAsk, children }) {
  return (
    <motion.div className="welcome container text-center" variants={container} initial="hidden" animate="show">
      <motion.div variants={item} className="hero-orb mx-auto">
        <div className="orb-ring" />
        <div className="orb-core"><span className="logo-text">B2</span></div>
      </motion.div>

      <motion.h1 variants={item} className="hero-title">
        Hi, I'm <span className="text-gradient">{persona?.name ?? "B2"}</span>
      </motion.h1>
      <motion.p variants={item} className="text-secondary mb-4">
        Your private AI, running locally with Ollama. Nothing leaves this computer.
      </motion.p>

      {/* the big chat box (passed in from App) */}
      <div className="mb-3">{children}</div>

      <motion.div variants={item} className="d-flex flex-wrap justify-content-center gap-2 mb-3">
        {personas.map((p) => (
          <motion.button
            key={p.id}
            className={`persona-chip ${p.id === persona?.id ? "active" : ""}`}
            onClick={() => onPersona(p.id)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="me-1">{p.emoji}</span>{p.name}
          </motion.button>
        ))}
      </motion.div>

      <div className="row g-3 text-start">
        {SUGGESTIONS.map((s) => (
          <motion.div key={s.text} variants={item} className="col-12 col-md-6">
            <motion.button
              className="suggestion w-100"
              onClick={() => onAsk(s.text)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="sugg-icon" style={{ color: s.color, background: s.color + "1f" }}>
                <i className={`bi ${s.icon}`} />
              </span>
              <span>
                <span className="d-block fw-semibold">{s.title}</span>
                <span className="d-block small text-secondary">{s.text}</span>
              </span>
              <i className="bi bi-arrow-up-right ms-auto sugg-arrow" />
            </motion.button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
