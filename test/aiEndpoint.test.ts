import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AI_ENDPOINT,
  DEFAULT_AI_MODEL,
  getAIEndpoint,
  getAIModel,
  setAIEndpoint,
  setAIModel,
} from "../src/ai/aiEndpoint";

const ENDPOINT_KEY = "sketchlab:ai-endpoint";
const MODEL_KEY = "sketchlab:ai-model";

// The project's vitest runs in the node environment (no jsdom). Provide a thin
// in-memory localStorage stub so the module's storage path is exercised.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
});

describe("AI endpoint persistence", () => {
  it("defaults to the OpenAI responses endpoint", () => {
    expect(getAIEndpoint()).toBe(DEFAULT_AI_ENDPOINT);
  });

  it("returns the default when nothing is stored", () => {
    expect(localStorage.getItem(ENDPOINT_KEY)).toBeNull();
    expect(getAIEndpoint()).toBe(DEFAULT_AI_ENDPOINT);
  });

  it("persists a custom endpoint to localStorage", () => {
    setAIEndpoint("http://localhost:11434/v1");
    expect(localStorage.getItem(ENDPOINT_KEY)).toBe("http://localhost:11434/v1");
    expect(getAIEndpoint()).toBe("http://localhost:11434/v1");
  });

  it("survives a storage round-trip like other prefs", () => {
    setAIEndpoint("http://ollama:11434/v1");
    expect(getAIEndpoint()).toBe("http://ollama:11434/v1");
    expect(localStorage.getItem(ENDPOINT_KEY)).toBe("http://ollama:11434/v1");
  });

  it("strips surrounding whitespace before persisting", () => {
    setAIEndpoint("  http://localhost:11434/v1  ");
    expect(localStorage.getItem(ENDPOINT_KEY)).toBe("http://localhost:11434/v1");
  });

  it("keeps the default when set to the default", () => {
    setAIEndpoint(DEFAULT_AI_ENDPOINT);
    expect(getAIEndpoint()).toBe(DEFAULT_AI_ENDPOINT);
  });
});

describe("AI model persistence", () => {
  it("defaults to the OpenAI diagram model", () => {
    expect(getAIModel()).toBe(DEFAULT_AI_MODEL);
  });

  it("returns the default when nothing is stored", () => {
    expect(localStorage.getItem(MODEL_KEY)).toBeNull();
    expect(getAIModel()).toBe(DEFAULT_AI_MODEL);
  });

  it("persists a custom model to localStorage", () => {
    setAIModel("llama3.1");
    expect(localStorage.getItem(MODEL_KEY)).toBe("llama3.1");
    expect(getAIModel()).toBe("llama3.1");
  });

  it("survives a storage round-trip like other prefs", () => {
    setAIModel("qwen2.5:7b");
    expect(getAIModel()).toBe("qwen2.5:7b");
    expect(localStorage.getItem(MODEL_KEY)).toBe("qwen2.5:7b");
  });

  it("strips surrounding whitespace before persisting", () => {
    setAIModel("  llama3.1:8b  ");
    expect(localStorage.getItem(MODEL_KEY)).toBe("llama3.1:8b");
  });
});
