import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PROVIDERS,
  providerApiKey,
  providerBaseUrl,
  providerModel,
  resolveProviderId,
} from "@/lib/ai/providers";

const KEYS = [
  "AI_PROVIDER",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "GROQ_API_KEY",
  "XAI_API_KEY",
  "GROK_API_KEY",
  "OPENROUTER_API_KEY",
  "MISTRAL_API_KEY",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("provider resolution", () => {
  it("defaults to Anthropic when nothing is configured", () => {
    expect(resolveProviderId()).toBe("anthropic");
  });

  it("auto-selects the provider whose key is present", () => {
    process.env.GEMINI_API_KEY = "test-key";
    expect(resolveProviderId()).toBe("gemini");
  });

  it("auto-selects Groq from its key", () => {
    process.env.GROQ_API_KEY = "test-key";
    expect(resolveProviderId()).toBe("groq");
  });

  it("honours an explicit AI_PROVIDER over key presence", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.AI_PROVIDER = "groq";
    expect(resolveProviderId()).toBe("groq");
  });

  it("ignores an unknown AI_PROVIDER rather than crashing", () => {
    process.env.AI_PROVIDER = "not-a-provider";
    expect(resolveProviderId()).toBe("anthropic");
  });

  it("is case-insensitive", () => {
    process.env.AI_PROVIDER = "GEMINI";
    expect(resolveProviderId()).toBe("gemini");
  });
});

describe("provider credentials and endpoints", () => {
  it("reads a provider-specific key", () => {
    process.env.GROQ_API_KEY = "groq-key";
    expect(providerApiKey("groq")).toBe("groq-key");
  });

  it("falls back to the generic AI_API_KEY", () => {
    process.env.AI_API_KEY = "generic-key";
    expect(providerApiKey("xai")).toBe("generic-key");
  });

  it("prefers the provider-specific key over the generic one", () => {
    process.env.AI_API_KEY = "generic-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    expect(providerApiKey("gemini")).toBe("gemini-key");
  });

  it("returns undefined when no key is set", () => {
    expect(providerApiKey("mistral")).toBeUndefined();
  });

  it("exposes an OpenAI-compatible base URL for non-Anthropic providers", () => {
    for (const id of ["gemini", "groq", "xai", "openrouter", "mistral"] as const) {
      expect(providerBaseUrl(id)).toMatch(/^https:\/\//);
    }
  });

  it("has no base URL for Anthropic, which uses its native SDK", () => {
    expect(providerBaseUrl("anthropic")).toBeNull();
  });

  it("takes the base URL from AI_BASE_URL for a custom endpoint", () => {
    process.env.AI_BASE_URL = "https://example.test/v1/";
    expect(providerBaseUrl("custom")).toBe("https://example.test/v1");
  });
});

describe("model selection", () => {
  it("uses each provider's default model", () => {
    expect(providerModel("gemini")).toBe(PROVIDERS.gemini.defaultModel);
    expect(providerModel("groq")).toBe(PROVIDERS.groq.defaultModel);
  });

  it("lets AI_MODEL override the default", () => {
    process.env.AI_MODEL = "some-other-model";
    expect(providerModel("gemini")).toBe("some-other-model");
  });

  it("still honours the legacy ANTHROPIC_MODEL variable", () => {
    process.env.ANTHROPIC_MODEL = "claude-legacy";
    expect(providerModel("anthropic")).toBe("claude-legacy");
    // ...but only for Anthropic.
    expect(providerModel("groq")).toBe(PROVIDERS.groq.defaultModel);
  });
});

describe("provider catalogue", () => {
  it("gives every provider a key variable and console link", () => {
    for (const [id, p] of Object.entries(PROVIDERS)) {
      expect(p.keyVars.length, `${id} needs at least one key variable`).toBeGreaterThan(0);
      if (id !== "custom") {
        expect(p.console, `${id} needs a console URL`).toMatch(/^https:\/\//);
        expect(p.defaultModel, `${id} needs a default model`).not.toBe("");
      }
    }
  });
});
