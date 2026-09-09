/**
 * AI provider abstraction.
 *
 * The grounding rules, retrieval and citation handling live in
 * src/lib/ai/index.ts and are provider-independent. This module only knows
 * how to turn (system prompt, messages) into text, so the model behind
 * Tony Daily can be swapped with configuration rather than code.
 *
 * Most vendors expose an OpenAI-compatible /chat/completions endpoint, so a
 * single adapter covers Gemini, Groq, xAI, OpenRouter and Mistral. Anthropic
 * keeps its native SDK adapter.
 */

export type ProviderId =
  | "anthropic"
  | "gemini"
  | "groq"
  | "xai"
  | "openrouter"
  | "mistral"
  | "custom";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  /** OpenAI-compatible base URL; null for providers with a native adapter. */
  baseUrl: string | null;
  defaultModel: string;
  /** Environment variables checked for this provider's key, in order. */
  keyVars: string[];
  /** Where to get a key, shown in setup guidance. */
  console: string;
  freeTier: string;
  /**
   * Largest max_tokens this provider's free tier will actually serve in one
   * request. Omitted where the tier is generous enough not to matter. A
   * request above the ceiling is clamped rather than rejected: a slightly
   * shorter briefing beats no briefing, and truncated tails are dropped.
   */
  maxTokens?: number;
}

export const PROVIDERS: Record<ProviderId, ProviderPreset> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    baseUrl: null, // native SDK
    defaultModel: "claude-sonnet-5",
    keyVars: ["ANTHROPIC_API_KEY", "AI_API_KEY"],
    console: "https://platform.claude.com",
    freeTier: "~$5 starter credits, then paid",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-3.6-flash",
    keyVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "AI_API_KEY"],
    console: "https://aistudio.google.com/apikey",
    freeTier: "Free tier, no credit card",
  },
  groq: {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    // llama-3.3-70b-versatile was retired and now 404s. Checked the live
    // model list on 10 Sept 2026 and compared the general-purpose
    // candidates on a Traditional Chinese task, because this provider is
    // the fallback for zh-HK work: gpt-oss-120b and qwen3.8-27b both
    // rendered "Northern Metropolis" correctly as 北部都會區, while
    // gpt-oss-20b produced 北方都市. The 120b is the larger model and used
    // natural HK phrasing, so it takes the default.
    defaultModel: "openai/gpt-oss-120b",
    keyVars: ["GROQ_API_KEY", "AI_API_KEY"],
    console: "https://console.groq.com/keys",
    freeTier: "Free tier, no credit card (8,000 tokens/min)",
    // Measured 10 Sept 2026: every general-purpose model on the free tier
    // reports x-ratelimit-limit-tokens: 8000 per minute. A deep briefing
    // asks for 16,000 and was rejected outright ("Limit 8000, Used 4335,
    // Requested 6588"). Clamp below the ceiling so the fallback produces a
    // shorter briefing instead of nothing.
    maxTokens: 7000,
  },
  xai: {
    id: "xai",
    label: "xAI Grok",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4-fast",
    keyVars: ["XAI_API_KEY", "GROK_API_KEY", "AI_API_KEY"],
    console: "https://console.x.ai",
    freeTier: "Credit-based; check current offer",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.0-flash-exp:free",
    keyVars: ["OPENROUTER_API_KEY", "AI_API_KEY"],
    console: "https://openrouter.ai/keys",
    freeTier: "Free models available (low daily cap)",
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    keyVars: ["MISTRAL_API_KEY", "AI_API_KEY"],
    console: "https://console.mistral.ai",
    freeTier: "Free experiment tier",
  },
  custom: {
    id: "custom",
    label: "Custom OpenAI-compatible endpoint",
    baseUrl: null, // taken from AI_BASE_URL
    defaultModel: "",
    keyVars: ["AI_API_KEY"],
    console: "",
    freeTier: "",
  },
};

/** The configured provider, defaulting to whichever key is present. */
export function resolveProviderId(): ProviderId {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit && explicit in PROVIDERS) return explicit as ProviderId;

  // No explicit choice: pick the first provider that has a key configured,
  // so adding a single environment variable is enough to switch models.
  for (const id of Object.keys(PROVIDERS) as ProviderId[]) {
    if (id === "custom") continue;
    const preset = PROVIDERS[id];
    if (preset.keyVars.some((v) => v !== "AI_API_KEY" && process.env[v])) return id;
  }
  // Nothing configured: fall back to the provider this product actually
  // runs on, so guidance points at a free tier rather than a paid one.
  return "gemini";
}

/**
 * Providers to try, in order: the resolved primary first, then every other
 * provider that has a key. A free tier that has run out for the day should
 * degrade to another free tier rather than taking the whole product down.
 * Order is deliberate — Gemini first for Traditional Chinese quality, then
 * the high-volume free tiers.
 */
const FAILOVER_ORDER: ProviderId[] = [
  "gemini",
  "groq",
  "openrouter",
  "mistral",
  "xai",
  "anthropic",
];

/**
 * Providers we know are rate-limited right now, and the moment they are
 * worth trying again.
 *
 * Without this, a chain of [gemini, groq] spends a doomed call on Gemini
 * before every single fallback for as long as Gemini's quota is spent —
 * slow, and it keeps the exhausted provider pinned at its limit. Rate-limit
 * replies carry their own "retry in 41.4s", so honour it: the two providers
 * genuinely take turns instead of one always going first.
 *
 * In-memory and per-instance on purpose. It is a hint, never a gate — a
 * cooling provider is still tried if it is the only one left.
 */
const coolingUntil = new Map<ProviderId, number>();

/** Seconds until this provider is worth trying again; 0 when it is ready. */
export function providerCoolingFor(id: ProviderId, now = Date.now()): number {
  const until = coolingUntil.get(id);
  if (until == null) return 0;
  if (until <= now) {
    coolingUntil.delete(id);
    return 0;
  }
  return Math.ceil((until - now) / 1000);
}

export function markProviderCooling(id: ProviderId, seconds: number, now = Date.now()): void {
  // Clamped: a provider is never parked for more than five minutes, so a
  // misparsed number cannot take a provider out of rotation for the day.
  const s = Math.max(1, Math.min(300, Math.ceil(seconds)));
  coolingUntil.set(id, now + s * 1000);
}

/** Test seam — no production caller clears the whole map. */
export function resetProviderCooling(): void {
  coolingUntil.clear();
}

/**
 * Providers state their own backoff: Gemini says "Please retry in 41.46s",
 * Groq says "try again in 21.9225s". Use it when present so we wait exactly
 * as long as we were asked to, and no longer.
 */
export function retryAfterSeconds(message: string, fallback = 60): number {
  const m = /(?:retry|try again) in ([0-9]+(?:\.[0-9]+)?)\s*s/i.exec(message);
  return m ? Math.ceil(Number(m[1])) : fallback;
}

export function providerChain(): ProviderId[] {
  const primary = resolveProviderId();
  const chain = [primary];
  // An explicit AI_PROVIDER choice means "use this one"; only fail over
  // when the choice was inferred from whichever key happened to be present.
  if (process.env.AI_PROVIDER?.trim()) return chain;

  for (const id of FAILOVER_ORDER) {
    if (id === primary || chain.includes(id)) continue;
    if (providerApiKey(id)) chain.push(id);
  }
  // A provider that just told us it is rate-limited goes to the back rather
  // than being tried first again. sort() is stable, so preference order
  // survives inside each group.
  return chain.sort(
    (a, b) => (providerCoolingFor(a) ? 1 : 0) - (providerCoolingFor(b) ? 1 : 0),
  );
}

/**
 * How large a single request the AI can actually serve right now.
 *
 * A ten-minute briefing needs a big budget. Groq's free tier tops out at
 * 8,000 tokens a minute, so when Gemini is standing down and Groq is
 * carrying the work, asking for 16,000 produces a briefing that stops
 * early — worse than not offering it. This reports the ceiling of the best
 * provider currently in rotation, so the interface can offer only what it
 * can finish.
 *
 * Returns 0 when nothing is available: no key configured, or everything is
 * rate-limited. A provider with no stated ceiling reports NO_CEILING.
 */
export const NO_CEILING = Number.MAX_SAFE_INTEGER;

export function availableTokenCapacity(): number {
  const chain = providerChain();
  for (const id of chain) {
    if (!providerApiKey(id)) continue;
    if (providerCoolingFor(id) > 0) continue; // rate-limited: not usable now
    return PROVIDERS[id].maxTokens ?? NO_CEILING;
  }
  return 0;
}

/** Quota and transient failures are worth retrying elsewhere; a bad key is not. */
export function isFailoverWorthy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/rejected the API key/i.test(message)) return false;
  return /quota|rate limit|HTTP 5\d\d|could not be reached|unreachable|network|timed? ?out|empty response/i.test(
    message,
  );
}

export function providerApiKey(id: ProviderId): string | undefined {
  for (const v of PROVIDERS[id].keyVars) {
    const value = process.env[v];
    if (value) return value;
  }
  return undefined;
}

export function providerBaseUrl(id: ProviderId): string | null {
  if (id === "custom") return process.env.AI_BASE_URL?.replace(/\/$/, "") ?? null;
  return PROVIDERS[id].baseUrl;
}

export function providerModel(id: ProviderId): string {
  return (
    process.env.AI_MODEL?.trim() ||
    // Kept for backwards compatibility with earlier deployments.
    (id === "anthropic" ? process.env.ANTHROPIC_MODEL?.trim() : undefined) ||
    PROVIDERS[id].defaultModel
  );
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * A provider that is temporarily out of quota, carrying the wait it asked
 * for. The message stays reader-safe; retryAfter is what the failover uses.
 */
export class RateLimitError extends Error {
  readonly retryAfter: number;
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

/**
 * Pull a readable sentence out of a provider error body.
 *
 * Shapes differ by vendor: OpenAI-style is `{error:{message}}`, Gemini's
 * compatibility endpoint returns `[{error:{message}}]`. Anything else
 * yields an empty string rather than raw JSON — a reader must never be
 * shown a payload dump.
 */
export function extractProviderMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
    const message = (candidate as { error?: { message?: string } })?.error?.message;
    if (typeof message !== "string" || !message.trim()) return "";
    // Trim to the first sentence and drop trailing help URLs.
    const firstSentence = message.split(/(?<=\.)\s/)[0].trim();
    return firstSentence.replace(/\s*https?:\/\/\S+/g, "").slice(0, 160);
  } catch {
    return "";
  }
}

/**
 * Call an OpenAI-compatible /chat/completions endpoint. Uses fetch directly
 * rather than adding an SDK dependency for what is a single POST.
 */
export async function completeOpenAiCompatible(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<string> {
  const { baseUrl, apiKey, model, system, messages, maxTokens } = options;
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.2, // factual work: keep output close to the sources
        messages: [{ role: "system", content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error("The AI provider could not be reached.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = extractProviderMessage(body);
    // The full provider payload goes to server logs; the thrown message is
    // what a reader may see, so it stays short and free of raw JSON.
    console.error(`AI provider HTTP ${res.status}: ${body.slice(0, 500)}`);

    if (res.status === 401 || res.status === 403) {
      throw new Error("The AI provider rejected the API key. Check the key is current.");
    }
    if (res.status === 429) {
      // The reader sees a calm sentence; the retry window is carried on the
      // error so the failover can stand this provider down for exactly as
      // long as it asked, rather than guessing. Parsed from the raw body,
      // which is where the vendors put it.
      throw new RateLimitError(
        "AI quota reached for now — this resets on the provider's own schedule. " +
          "Existing content is unaffected.",
        retryAfterSeconds(body),
      );
    }
    throw new Error(
      `AI provider error (HTTP ${res.status})${detail ? `: ${detail}` : "."}`,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI provider returned an empty response.");
  return text;
}
