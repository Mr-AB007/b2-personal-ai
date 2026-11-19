import { useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-sm action-btn"
      title="Copy"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1300);
      }}
    >
      <i className={`bi ${done ? "bi-check2 text-success" : "bi-copy"}`} />
      {label && <span className="ms-1">{done ? "Copied" : label}</span>}
    </button>
  );
}

// Code blocks get a mac-style header with the language and a copy button.
function CodeBlock({ className, children }) {
  const lang = /language-(\w+)/.exec(className || "")?.[1] ?? "code";
  const code = String(children).replace(/\n$/, "");
  return (
    <div className="codeblock">
      <div className="codeblock-head">
        <span className="dots"><i /><i /><i /></span>
        <span className="lang">{lang}</span>
        <CopyButton text={code} label="Copy" />
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

const markdownComponents = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }) =>
    className || String(children).includes("\n")
      ? <CodeBlock className={className}>{children}</CodeBlock>
      : <code className="inline" {...props}>{children}</code>,
  a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: (props) => <div className="table-responsive"><table className="table table-sm table-bordered" {...props} /></div>,
};

// Animated "Searching the web…" line shown before the answer starts.
function SearchingStatus({ searching, count }) {
  return (
    <div className="searching">
      <span className="search-globe"><i className="bi bi-globe2" /></span>
      <span>
        {searching.reading ? (
          <>Reading {count || 0} result{count === 1 ? "" : "s"}…</>
        ) : searching.query ? (
          <>Searching for <b>“{searching.query}”</b>…</>
        ) : (
          <>Thinking of a search…</>
        )}
      </span>
      <span className="shimmer" />
    </div>
  );
}

// Numbered source cards under a web answer. [1] in the text = card 1.
function Sources({ sources }) {
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  return (
    <div className="sources">
      <div className="sources-label"><i className="bi bi-globe2 me-1" />Sources</div>
      <div className="sources-row">
        {sources.map((s, i) => (
          <motion.a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-card"
            title={s.snippet}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ y: -3 }}
          >
            <span className="source-num">{i + 1}</span>
            <span className="source-text">
              <span className="source-title">{s.title}</span>
              <span className="source-host">{host(s.url)}</span>
            </span>
          </motion.a>
        ))}
      </div>
    </div>
  );
}

export default function Message({ message, persona, isLast, canRegenerate, onRegenerate }) {
  const { role, content, streaming, stats, error, searching, sources, searchError } = message;
  const isUser = role === "user";

  return (
    <motion.div
      className={`msg ${role}`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      {!isUser && (
        <div className={`avatar ${streaming ? "pulsing" : ""}`}>{persona?.emoji ?? "✨"}</div>
      )}

      <div className="msg-body">
        {!isUser && <div className="msg-name">{persona?.name ?? "B2"}</div>}
        <div className="bubble">
          {isUser ? (
            content
          ) : streaming && !content && searching ? (
            <SearchingStatus searching={searching} count={sources?.length} />
          ) : streaming && !content ? (
            <span className="thinking"><i /><i /><i /><span className="ms-2 small text-secondary">thinking</span></span>
          ) : (
            <div className={`md ${streaming ? "typing" : ""}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
            </div>
          )}
          {searchError && <div className="small text-warning mt-2"><i className="bi bi-wifi-off me-1" />{searchError}</div>}
          {sources?.length > 0 && content && <Sources sources={sources} />}
          {error && <div className="alert alert-danger py-2 px-3 mt-2 mb-0 small"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}
        </div>

        {!isUser && !streaming && content && (
          <motion.div className="msg-actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            <CopyButton text={content} />
            {isLast && canRegenerate && (
              <button className="btn btn-sm action-btn" onClick={onRegenerate} title="Ask again">
                <i className="bi bi-arrow-repeat" />
              </button>
            )}
            {stats && (
              <span className="meta">
                <i className="bi bi-lightning-charge-fill me-1" />
                {stats.tps.toFixed(1)} tok/s · {stats.tokens} tokens · {stats.seconds.toFixed(1)}s
              </span>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
