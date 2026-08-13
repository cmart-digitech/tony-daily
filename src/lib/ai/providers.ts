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
    defaultModel: "llama-3.3-70b-versatile",
    keyVars: ["GROQ_API_KEY", "AI_API_KEY"],
    console: "https://console.groq.com/keys",
    freeTier: "Free tier, no credit card (30 req/min)",
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
  return "anthropic";
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

export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiNotConfiguredError";
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
    // Surface the provider's own message; it explains quota and key problems
    // far better than a generic failure would.
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      /* keep the raw snippet */
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AI provider rejected the API key: ${detail}`);
    }
    if (res.status === 429) {
      throw new Error(`AI provider rate limit reached: ${detail}`);
    }
    throw new Error(`AI provider error (HTTP ${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI provider returned an empty response.");
  return text;
}
