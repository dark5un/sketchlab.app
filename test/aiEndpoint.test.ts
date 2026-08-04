import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AI_ENDPOINT,
  getAIEndpoint,
  setAIEndpoint,
} from "../src/ai/aiEndpoint";

const KEY = "sketchlab:ai-endpoint";

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
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(getAIEndpoint()).toBe(DEFAULT_AI_ENDPOINT);
  });

  it("persists a custom endpoint to localStorage", () => {
    setAIEndpoint("http://localhost:11434/v1");
    expect(localStorage.getItem(KEY)).toBe("http://localhost:11434/v1");
    expect(getAIEndpoint()).toBe("http://localhost:11434/v1");
  });

  it("survives a storage round-trip like other prefs", () => {
    setAIEndpoint("http://ollama:11434/v1");
    expect(getAIEndpoint()).toBe("http://ollama:11434/v1");
    expect(localStorage.getItem(KEY)).toBe("http://ollama:11434/v1");
  });

  it("strips surrounding whitespace before persisting", () => {
    setAIEndpoint("  http://localhost:11434/v1  ");
    expect(localStorage.getItem(KEY)).toBe("http://localhost:11434/v1");
  });

  it("keeps the default when set to the default", () => {
    setAIEndpoint(DEFAULT_AI_ENDPOINT);
    expect(getAIEndpoint()).toBe(DEFAULT_AI_ENDPOINT);
  });
});
