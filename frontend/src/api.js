// All talking to the Python server lives here.

export async function getPersonas() {
  return fetch("/api/personas").then((r) => r.json());
}

export async function getModels() {
  try {
    return await fetch("/api/models").then((r) => r.json());
  } catch {
    return { error: "Python server is offline. Run start.bat" };
  }
}

/**
 * Send the whole conversation and stream the answer back.
 * Ollama replies with one JSON object per line ("NDJSON"):
 *   {"message":{"content":"Hel"},"done":false}
 *   {"message":{"content":"lo"},"done":false}
 *   {"done":true,"eval_count":42,"eval_duration":...}
 * onToken is called for each small piece of text, onDone with the final stats.
 */
export async function getWebStatus() {
  try {
    return await fetch("/api/web-status").then((r) => r.json());
  } catch {
    return { provider: "Wikipedia" };
  }
}

// Besides the answer, the server can send extra lines:
//   {"status":"searching","query":"..."}   -> web search started
//   {"search":{"query","provider","results":[...]}} -> what it found
//   {"prompt":[...messages]}                -> the exact prompt given to the model
// Those go to onEvent.
export async function streamChat(request, { onToken, onDone, onEvent = () => {}, signal }) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // last line may be incomplete, keep it for next round
    for (const line of lines) {
      if (!line.trim()) continue;
      const data = JSON.parse(line);
      if (data.error) throw new Error(data.error);
      if (data.status || data.search || data.prompt) { onEvent(data); continue; }
      if (data.message?.content) onToken(data.message.content);
      if (data.done) onDone(data);
    }
  }
}
