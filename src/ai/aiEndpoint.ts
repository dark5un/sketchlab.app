// Lightweight, localStorage-backed AI connection preferences. Read synchronously
// so the AI panel can prefill them, following the inputPrefs.ts pattern.
// Kept minimal: endpoint and model are the two configurable connection values.

export const DEFAULT_AI_ENDPOINT = "https://api.openai.com/v1/responses";
export const DEFAULT_AI_MODEL = "gpt-5.5";

const AI_ENDPOINT_KEY = "sketchlab:ai-endpoint";
const AI_MODEL_KEY = "sketchlab:ai-model";

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

/** The model name selected for the AI endpoint. */
export function getAIModel(): string {
  return readString(AI_MODEL_KEY, DEFAULT_AI_MODEL);
}

export function setAIModel(model: string): void {
  writeString(AI_MODEL_KEY, model.trim());
}
