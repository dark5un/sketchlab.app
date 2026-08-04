import { afterEach, describe, expect, it } from "vitest";
import { deriveModelsUrl, listAIModels } from "../src/ai/listModels";

const originalFetch = globalThis.fetch;

const fetchMock = (overrides: { ok?: boolean; json?: unknown } = {}) => {
  const calls: string[] = [];
  const fn = async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(
      overrides.json !== undefined ? JSON.stringify(overrides.json) : "{}",
      { status: overrides.ok === false ? 500 : 200 },
    );
  };
  const mock = Object.assign(fn, { calls });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("deriveModelsUrl", () => {
  it("turns a /v1/responses endpoint into its sibling /v1/models endpoint", () => {
    expect(deriveModelsUrl("https://api.openai.com/v1/responses")).toBe(
      "https://api.openai.com/v1/models",
    );
  });

  it("handles a bare /v1 endpoint by appending /models", () => {
    expect(deriveModelsUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1/models",
    );
  });

  it("keeps an endpoint that already ends in /models", () => {
    expect(deriveModelsUrl("http://localhost:11434/v1/models")).toBe(
      "http://localhost:11434/v1/models",
    );
  });

  it("handles a trailing slash", () => {
    expect(deriveModelsUrl("http://localhost:11434/v1/responses/")).toBe(
      "http://localhost:11434/v1/models",
    );
  });
});

describe("listAIModels", () => {
  it("returns the list of model ids from an OpenAI-compatible /models response", async () => {
    const mock = fetchMock({
      json: {
        object: "list",
        data: [
          { id: "llama3.1", object: "model" },
          { id: "qwen2.5:7b", object: "model" },
        ],
      },
    });
    const models = await listAIModels("http://localhost:11434/v1/responses");
    expect(models).toEqual(["llama3.1", "qwen2.5:7b"]);
    expect(mock.calls[0]).toBe("http://localhost:11434/v1/models");
  });

  it("throws a descriptive error when the request fails", async () => {
    fetchMock({ ok: false, json: { error: { message: "boom" } } });
    await expect(
      listAIModels("http://localhost:11434/v1/responses"),
    ).rejects.toThrow(/could not load models/i);
  });
});
