import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractProviderMessage,
  isFailoverWorthy,
  providerChain,
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
  it("falls back to a free-tier provider when nothing is configured", () => {
    // Guidance shown to the operator names this provider, so the default
    // must point at a free tier rather than a paid one.
    expect(resolveProviderId()).toBe("gemini");
    expect(PROVIDERS.gemini.freeTier).toMatch(/free/i);
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
    expect(resolveProviderId()).toBe("gemini");
  });

  it("still selects Anthropic when its key is the one present", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
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

describe("provider failover chain", () => {
  it("is just the primary when only one key exists", () => {
    process.env.GEMINI_API_KEY = "k";
    expect(providerChain()).toEqual(["gemini"]);
  });

  it("falls back to other configured free tiers, Gemini first", () => {
    process.env.GROQ_API_KEY = "k";
    process.env.GEMINI_API_KEY = "k";
    const chain = providerChain();
    expect(chain[0]).toBe("gemini");
    expect(chain).toContain("groq");
  });

  it("never includes a provider without a key", () => {
    process.env.GROQ_API_KEY = "k";
    const chain = providerChain();
    expect(chain).toEqual(["groq"]);
    expect(chain).not.toContain("mistral");
  });

  it("respects an explicit AI_PROVIDER and does not fail over", () => {
    process.env.GEMINI_API_KEY = "k";
    process.env.GROQ_API_KEY = "k";
    process.env.AI_PROVIDER = "groq";
    expect(providerChain()).toEqual(["groq"]);
  });
});

describe("isFailoverWorthy", () => {
  it("retries elsewhere on quota and rate limits", () => {
    expect(isFailoverWorthy(new Error("AI quota reached for now"))).toBe(true);
    expect(isFailoverWorthy(new Error("rate limit reached"))).toBe(true);
  });

  it("retries on transient server and network faults", () => {
    expect(isFailoverWorthy(new Error("AI provider error (HTTP 503)"))).toBe(true);
    expect(isFailoverWorthy(new Error("The AI provider could not be reached."))).toBe(true);
  });

  it("does NOT retry a rejected key — it would fail identically elsewhere", () => {
    expect(
      isFailoverWorthy(new Error("The AI provider rejected the API key. Check the key is current.")),
    ).toBe(false);
  });

  it("does not retry ordinary bad requests", () => {
    expect(isFailoverWorthy(new Error("AI provider error (HTTP 400): bad model"))).toBe(false);
  });
});

describe("extractProviderMessage", () => {
  it("reads the OpenAI-style error shape", () => {
    expect(
      extractProviderMessage(JSON.stringify({ error: { message: "Invalid API key." } })),
    ).toBe("Invalid API key.");
  });

  it("reads Gemini's array-wrapped shape", () => {
    // The live payload that leaked raw JSON into the UI.
    const body = JSON.stringify([
      {
        error: {
          code: 429,
          message:
            "You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.",
        },
      },
    ]);
    const message = extractProviderMessage(body);
    expect(message).toBe("You exceeded your current quota, please check your plan and billing details.");
    expect(message).not.toContain("{");
    expect(message).not.toContain("http");
  });

  it("returns nothing rather than raw JSON for unknown shapes", () => {
    expect(extractProviderMessage('{"weird":true}')).toBe("");
    expect(extractProviderMessage("<html>gateway error</html>")).toBe("");
  });

  it("caps very long provider messages", () => {
    const long = JSON.stringify({ error: { message: "x".repeat(500) } });
    expect(extractProviderMessage(long).length).toBeLessThanOrEqual(160);
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
