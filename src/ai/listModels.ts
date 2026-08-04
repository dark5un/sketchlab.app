// Lists models from an OpenAI-compatible endpoint by querying its /models
// sibling endpoint. Used to populate the AI panel's model dropdown.

function trimTrailing(lower: string): string {
  return lower.endsWith("/") ? lower.slice(0, -1) : lower;
}

/**
 * Derive the sibling /models URL from a generation endpoint. Handles
 * `…/v1/responses` → `…/v1/models`, a bare `…/v1` → `…/v1/models`, and
 * preserves an endpoint that already targets /models.
 */
export function deriveModelsUrl(endpoint: string): string {
  const trimmed = trimTrailing(endpoint.trim());
  const lower = trimmed.toLowerCase();
  if (lower.endsWith("/models")) return trimmed;
  if (lower.endsWith("/v1/responses")) return `${trimmed.slice(0, -"/responses".length)}/models`;
  if (lower.endsWith("/v1/chat/completions")) {
    return `${trimmed.slice(0, -"/chat/completions".length)}/models`;
  }
  return `${trimmed}/models`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Fetch the list of model ids from the endpoint's /models route.
 * Returns the ids in server order; throws a descriptive error on failure.
 */
export async function listAIModels(endpoint: string, signal?: AbortSignal): Promise<string[]> {
  const url = deriveModelsUrl(endpoint);
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error("Could not load models: the endpoint is unreachable.");
  }
  if (!res.ok) throw new Error(`Could not load models (HTTP ${res.status}).`);
  const payload: unknown = await res.json().catch(() => ({}));
  const data = isRecord(payload) ? payload.data : undefined;
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const item of data) {
    if (isRecord(item) && typeof item.id === "string" && item.id.trim()) {
      ids.push(item.id);
    }
  }
  return ids;
}
