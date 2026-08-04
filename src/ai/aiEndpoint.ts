// Lightweight, localStorage-backed AI endpoint preference. Read synchronously
// at open/build time so the AI panel can prefill it, following the
// inputPrefs.ts pattern. Kept minimal: only the endpoint is configurable.

export const DEFAULT_AI_ENDPOINT = "https://api.openai.com/v1/responses";

const AI_ENDPOINT_KEY = "sketchlab:ai-endpoint";

function readString(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key);
    return raw && raw.trim() ? raw.trim() : fallback;
  } catch {
    return fallback; // private mode / disabled storage — fall back to the default
  }
}

function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value.trim());
  } catch {
    /* ignore — preference just won't persist across reloads */
  }
}

/** The OpenAI-compatible endpoint used for diagram generation. */
export function getAIEndpoint(): string {
  return readString(AI_ENDPOINT_KEY, DEFAULT_AI_ENDPOINT);
}

export function setAIEndpoint(endpoint: string): void {
  writeString(AI_ENDPOINT_KEY, endpoint.trim());
}
