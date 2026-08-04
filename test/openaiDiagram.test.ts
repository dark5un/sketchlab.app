import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateDiagramWithOpenAI,
  OPENAI_DIAGRAM_MODEL,
} from "../src/ai/openaiDiagram";

const originalFetch = globalThis.fetch;

const validGraph = {
  name: "Demo",
  layers: [],
  nodes: [{ id: "api", label: "API", kind: "icon", icon: "microservice", color: "#0f2740", layer: 0 }],
  edges: [],
};

// A realistic Chat Completions success response wrapping validGraph.
const chatCompletion = {
  choices: [{ message: { role: "assistant", content: JSON.stringify(validGraph) } }],
};

type FetchSetup = {
  body?: unknown;
  status?: number;
  perCall?: unknown[];
};

function mockFetch(setup: FetchSetup = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let callIndex = 0;
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const body = setup.perCall?.[callIndex++] ?? setup.body ?? chatCompletion;
    return new Response(
      typeof body === "string" ? body : JSON.stringify(body),
      { status: setup.status ?? 200 },
    );
  };
  Object.assign(fn, { calls });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("generateDiagramWithOpenAI (Chat Completions)", () => {
  it("posts to the endpoint with a messages array (system + user)", async () => {
    const fn = mockFetch();
    await generateDiagramWithOpenAI({ prompt: "a CDN and API", endpoint: "http://localhost:11435/v1/chat/completions" });
    const { url, init } = fn.calls[0];
    expect(url).toBe("http://localhost:11435/v1/chat/completions");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(Array.isArray(body.messages)).toBe(true);
    const messages = body.messages as Array<{ role: string }>;
    expect(messages.some((m) => m.role === "system")).toBe(true);
    expect(messages.some((m) => m.role === "user")).toBe(true);
  });

  it("sends the configured model and a json_object response_format", async () => {
    const fn = mockFetch();
    await generateDiagramWithOpenAI({ prompt: "redis cache", endpoint: "http://localhost:11435/v1", model: "Gemma4-Test-GGUFs-Q4_K_M" });
    const body = JSON.parse(String(fn.calls[0].init.body)) as Record<string, unknown>;
    expect(body.model).toBe("Gemma4-Test-GGUFs-Q4_K_M");
    const format = body.response_format as { type?: string };
    expect(format?.type).toBe("json_object");
  });

  it("omits Authorization when no API key is provided", async () => {
    const fn = mockFetch();
    await generateDiagramWithOpenAI({ prompt: "no key", endpoint: "http://localhost:11435/v1" });
    const headers = fn.calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("sends Authorization when an API key is provided", async () => {
    const fn = mockFetch();
    await generateDiagramWithOpenAI({ prompt: "with key", apiKey: "sk-test", endpoint: "http://localhost:11435/v1" });
    const headers = fn.calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
  });

  it("parses choices[0].message.content into a GeneratedGraph", async () => {
    mockFetch({ body: { choices: [{ message: { role: "assistant", content: JSON.stringify(validGraph) } }] } });
    const graph = await generateDiagramWithOpenAI({ prompt: "parse me", endpoint: "http://localhost:11435/v1" });
    expect(graph.name).toBe("Demo");
    expect(graph.nodes[0].label).toBe("API");
  });

  it("parses a Content-array message for OpenAI-style responses", async () => {
    mockFetch({
      body: {
        choices: [{
          message: { role: "assistant", content: [{ type: "text", text: JSON.stringify(validGraph) }] },
        }],
      },
    });
    const graph = await generateDiagramWithOpenAI({ prompt: "array content", endpoint: "http://localhost:11435/v1" });
    expect(graph.nodes[0].label).toBe("API");
  });

  it("throws a descriptive error on a non-OK response", async () => {
    mockFetch({ status: 429, body: { error: { message: "rate limited" } } });
    await expect(
      generateDiagramWithOpenAI({ prompt: "boom", endpoint: "http://localhost:11435/v1" }),
    ).rejects.toThrow(/rate limited/);
  });

  it("throws when the assistant content is not valid diagram JSON", async () => {
    mockFetch({ body: { choices: [{ message: { role: "assistant", content: "not json at all" } }] } });
    await expect(
      generateDiagramWithOpenAI({ prompt: "bad", endpoint: "http://localhost:11435/v1" }),
    ).rejects.toThrow(/invalid diagram JSON/i);
  });

  it("defaults the endpoint to the OpenAI Chat Completions URL", async () => {
    const fn = mockFetch();
    await generateDiagramWithOpenAI({ prompt: "defaults" });
    expect(fn.calls[0].url).toBe("https://api.openai.com/v1/chat/completions");
    expect(OPENAI_DIAGRAM_MODEL).toBeTruthy();
  });
});
