import { describe, expect, it } from "vitest";
import { toChatCompletionsUrl, toModelsUrl } from "../src/ai/endpointPath";

describe("toChatCompletionsUrl", () => {
  it("appends /v1/chat/completions to a bare host:port", () => {
    expect(toChatCompletionsUrl("http://127.0.0.1:11435")).toBe(
      "http://127.0.0.1:11435/v1/chat/completions",
    );
  });

  it("handles a bare host:port with a trailing slash", () => {
    expect(toChatCompletionsUrl("http://127.0.0.1:11435/")).toBe(
      "http://127.0.0.1:11435/v1/chat/completions",
    );
  });

  it("appends /chat/completions to a base ending in /v1", () => {
    expect(toChatCompletionsUrl("http://127.0.0.1:11435/v1")).toBe(
      "http://127.0.0.1:11435/v1/chat/completions",
    );
  });

  it("keeps an endpoint that already ends in /v1/chat/completions", () => {
    expect(toChatCompletionsUrl("http://127.0.0.1:11435/v1/chat/completions")).toBe(
      "http://127.0.0.1:11435/v1/chat/completions",
    );
  });

  it("migrates a leftover /v1/responses endpoint to /v1/chat/completions", () => {
    expect(toChatCompletionsUrl("http://127.0.0.1:11435/v1/responses")).toBe(
      "http://127.0.0.1:11435/v1/chat/completions",
    );
  });

  it("keeps the OpenAI default unchanged", () => {
    expect(toChatCompletionsUrl("https://api.openai.com/v1/chat/completions")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("accepts a bare host:port without a scheme (defaults to http)", () => {
    expect(toChatCompletionsUrl("127.0.0.1:11435")).toBe(
      "http://127.0.0.1:11435/v1/chat/completions",
    );
  });
});

describe("toModelsUrl", () => {
  it("derives /v1/models from a bare host:port", () => {
    expect(toModelsUrl("http://127.0.0.1:11435")).toBe(
      "http://127.0.0.1:11435/v1/models",
    );
  });

  it("derives /v1/models from a full chat/completions endpoint", () => {
    expect(toModelsUrl("http://127.0.0.1:11435/v1/chat/completions")).toBe(
      "http://127.0.0.1:11435/v1/models",
    );
  });

  it("derives /v1/models from a /v1/responses endpoint", () => {
    expect(toModelsUrl("http://127.0.0.1:11435/v1/responses")).toBe(
      "http://127.0.0.1:11435/v1/models",
    );
  });
});
