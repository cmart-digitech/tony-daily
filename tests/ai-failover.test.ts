/**
 * Proves the behaviour end to end: when the primary provider is out of
 * quota, the next configured provider actually serves the request and its
 * answer is returned — not just that the chain is built correctly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeRaw } from "@/lib/ai";

const KEYS = [
  "AI_PROVIDER", "AI_MODEL", "AI_API_KEY", "AI_BASE_URL",
  "GEMINI_API_KEY", "GROQ_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY",
  "MISTRAL_API_KEY", "XAI_API_KEY", "GROK_API_KEY",
];
let saved: Record<string, string | undefined>;

/** A provider reply in OpenAI-compatible shape. */
function ok(text: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
/** Gemini's array-wrapped quota error. */
function quotaExhausted() {
  return new Response(
    JSON.stringify([{ error: { code: 429, message: "You exceeded your current quota." } }]),
    { status: 429, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gemini exhausted → Groq serves the request", () => {
  it("returns Groq's answer when Gemini is out of quota", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    const called: string[] = [];

    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      called.push(url);
      if (url.includes("generativelanguage.googleapis.com")) return quotaExhausted();
      if (url.includes("api.groq.com")) return ok("Answer from the fallback provider.");
      throw new Error(`unexpected host: ${url}`);
    });

    const answer = await completeRaw("system", "user", 100);
    expect(answer).toBe("Answer from the fallback provider.");
    // Gemini was tried first, Groq second — order matters for zh-HK quality.
    expect(called[0]).toContain("generativelanguage.googleapis.com");
    expect(called[1]).toContain("api.groq.com");
  });

  it("uses Gemini alone while it still has quota", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    const called: string[] = [];

    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      called.push(String(input));
      return ok("Answer from Gemini.");
    });

    expect(await completeRaw("system", "user", 100)).toBe("Answer from Gemini.");
    expect(called).toHaveLength(1);
    expect(called[0]).toContain("generativelanguage.googleapis.com");
  });

  it("sends each provider its OWN model name, never the primary's", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    process.env.AI_MODEL = "gemini-3.6-flash"; // pinned for Gemini only
    const models: string[] = [];

    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      models.push(JSON.parse(String(init?.body)).model);
      if (url.includes("generativelanguage.googleapis.com")) return quotaExhausted();
      return ok("Fallback answer.");
    });

    await completeRaw("system", "user", 100);
    expect(models[0]).toBe("gemini-3.6-flash");
    expect(models[1]).not.toBe("gemini-3.6-flash"); // Groq's own default
    expect(models[1]).toMatch(/llama|qwen|gpt|mixtral/i);
  });

  it("stops at a rejected key instead of burning the next provider's quota", async () => {
    process.env.GEMINI_API_KEY = "bad-key";
    process.env.GROQ_API_KEY = "groq-key";
    const called: string[] = [];

    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      called.push(String(input));
      return new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(completeRaw("system", "user", 100)).rejects.toThrow(/rejected the API key/i);
    expect(called).toHaveLength(1); // Groq never contacted
  });

  it("surfaces the last failure when every provider is exhausted", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    vi.stubGlobal("fetch", async () => quotaExhausted());

    await expect(completeRaw("system", "user", 100)).rejects.toThrow(/quota/i);
  });

  it("honours an explicit AI_PROVIDER and does not fall through", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    process.env.AI_PROVIDER = "gemini";
    const called: string[] = [];

    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      called.push(String(input));
      return quotaExhausted();
    });

    await expect(completeRaw("system", "user", 100)).rejects.toThrow(/quota/i);
    expect(called).toHaveLength(1);
  });
});
