// Endpoint normalization. Users type a bare host (e.g. "127.0.0.1:11435"); the
// app decides the API paths from it. Keeps the AI panel free of API internals.

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

/** Prepend http:// when the host has no scheme, leaving full URLs intact. */
function withScheme(base: string): string {
  const b = base.trim();
  if (!b) return b;
  return /^https?:\/\//i.test(b) ? b : `http://${b}`;
}

function resolveV1(host: string): string {
  const h = trimSlash(withScheme(host));
  const lower = h.toLowerCase();
  if (lower.endsWith("/v1/chat/completions")) return h;
  if (lower.endsWith("/v1/responses")) return `${h.slice(0, -"/responses".length)}/chat/completions`;
  if (lower.endsWith("/v1/models")) return `${h.slice(0, -"/models".length)}/chat/completions`;
  if (lower.endsWith("/v1")) return `${h}/chat/completions`;
  return `${h}/v1/chat/completions`;
}

/** Return the chat-completions URL for a user-supplied endpoint host. */
export function toChatCompletionsUrl(endpoint: string): string {
  return resolveV1(endpoint);
}

/** Return the /models URL for a user-supplied endpoint host. */
export function toModelsUrl(endpoint: string): string {
  const cc = toChatCompletionsUrl(endpoint);
  // chat/completions and /models are siblings under /v1
  return `${cc.replace(/\/chat\/completions$/, "")}/models`;
}
