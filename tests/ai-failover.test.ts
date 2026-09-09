/**
 * Proves the behaviour end to end: when the primary provider is out of
 * quota, the next configured provider actually serves the request and its
 * answer is returned — not just that the chain is built correctly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeRaw } from "@/lib/ai";
import {
  markProviderCooling,
  providerChain,
  providerCoolingFor,
  resetProviderCooling,
  retryAfterSeconds,
} from "@/lib/ai/providers";

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
  // Stand-downs are deliberately process-wide in production; each test must
  // still start from a clean slate.
  resetProviderCooling();
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

describe("providers take turns instead of one always going first", () => {
  beforeEach(() => resetProviderCooling());
  afterEach(() => resetProviderCooling());

  it("reads the backoff the provider itself asked for", () => {
    // The real messages, verbatim from both vendors.
    expect(
      retryAfterSeconds("You exceeded your current quota. Please retry in 41.463596087s."),
    ).toBe(42);
    expect(
      retryAfterSeconds("Rate limit reached ... Please try again in 21.9225s. Need more tokens?"),
    ).toBe(22);
  });

  it("falls back to a sane wait when no backoff is given", () => {
    expect(retryAfterSeconds("You exceeded your current quota.")).toBe(60);
  });

  it("never stands a provider down for more than five minutes", () => {
    markProviderCooling("gemini", 99_999);
    expect(providerCoolingFor("gemini")).toBeLessThanOrEqual(300);
  });

  it("clears the stand-down once the wait has passed", () => {
    const t0 = 1_000_000;
    markProviderCooling("gemini", 30, t0);
    expect(providerCoolingFor("gemini", t0 + 10_000)).toBeGreaterThan(0);
    expect(providerCoolingFor("gemini", t0 + 31_000)).toBe(0);
  });

  it("puts a rate-limited provider last in the chain, keeping the rest in order", () => {
    process.env.GEMINI_API_KEY = "g";
    process.env.GROQ_API_KEY = "q";
    expect(providerChain()).toEqual(["gemini", "groq"]);
    markProviderCooling("gemini", 60);
    expect(providerChain()).toEqual(["groq", "gemini"]);
  });

  it("starts the NEXT request with Groq after Gemini reports a quota limit", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.GROQ_API_KEY = "groq-key";
    const called: string[] = [];

    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      called.push(url);
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify([
            { error: { code: 429, message: "You exceeded your current quota. Please retry in 45s." } },
          ]),
          { status: 429, headers: { "content-type": "application/json" } },
        );
      }
      return ok("Answer from Groq.");
    });

    // First request pays the cost of discovering Gemini is out.
    expect(await completeRaw("system", "user", 100)).toBe("Answer from Groq.");
    expect(called).toHaveLength(2);

    // The second must not spend another doomed call on Gemini.
    called.length = 0;
    expect(await completeRaw("system", "user", 100)).toBe("Answer from Groq.");
    expect(called).toHaveLength(1);
    expect(called[0]).toContain("api.groq.com");
  });

  it("stands a provider down for the window it stated, not a guess", async () => {
    // Real Groq 429 body. The reader-facing message is deliberately generic,
    // so the wait has to travel on the error itself or it is lost.
    process.env.GROQ_API_KEY = "groq-key";
    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          error: {
            message:
              "Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): " +
              "Limit 8000, Used 6489, Requested 3590. Please try again in 15.5925s.",
            code: "rate_limit_exceeded",
          },
        }),
        { status: 429, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(completeRaw("system", "user", 100)).rejects.toThrow(/quota/i);
    const cooling = providerCoolingFor("groq");
    expect(cooling).toBeGreaterThan(0);
    expect(cooling).toBeLessThanOrEqual(16); // its number, not the 60s default
  });

  it("asks Groq for no more than its free tier will serve", async () => {
    process.env.GROQ_API_KEY = "groq-key";
    let requested = 0;
    vi.stubGlobal("fetch", async (_i: RequestInfo | URL, init?: RequestInit) => {
      requested = JSON.parse(String(init?.body)).max_tokens;
      return ok("Short brief.");
    });

    // A deep briefing asks for 16000; Groq's free tier tops out at 8000/min.
    await completeRaw("system", "user", 16_000);
    expect(requested).toBeLessThanOrEqual(7_000);
  });

  it("does not clamp a provider that has no stated ceiling", async () => {
    process.env.GEMINI_API_KEY = "gemini-key";
    let requested = 0;
    vi.stubGlobal("fetch", async (_i: RequestInfo | URL, init?: RequestInit) => {
      requested = JSON.parse(String(init?.body)).max_tokens;
      return ok("Full brief.");
    });
    await completeRaw("system", "user", 16_000);
    expect(requested).toBe(16_000);
  });
});
