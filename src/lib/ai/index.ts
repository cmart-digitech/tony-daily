import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSource } from "@/lib/sources/registry";
import type { Quote } from "@/lib/market/types";
import {
  AiNotConfiguredError,
  completeOpenAiCompatible,
  providerApiKey,
  providerBaseUrl,
  providerModel,
  PROVIDERS,
  resolveProviderId,
  type ChatMessage,
} from "./providers";

export type SummaryLevel = "30s" | "2min" | "deep";
export type SummaryLanguage = "en" | "zh-HK";

export function isAiConfigured(): boolean {
  const id = resolveProviderId();
  if (!providerApiKey(id)) return false;
  // A custom endpoint additionally needs its base URL and model.
  if (id === "custom") return Boolean(providerBaseUrl(id) && providerModel(id));
  return true;
}

/** Model identifier used for summary cache keys and brief attribution. */
export function aiModelId(): string {
  return `${resolveProviderId()}:${providerModel(resolveProviderId())}`;
}

/** Human-readable provider name, for setup guidance and error messages. */
export function aiProviderLabel(): string {
  return PROVIDERS[resolveProviderId()].label;
}

/**
 * Single completion entry point. Anthropic uses its native SDK; every other
 * provider speaks the OpenAI-compatible chat-completions API.
 */
async function callModel(options: {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<string> {
  const { system, messages, maxTokens } = options;
  const id = resolveProviderId();
  const apiKey = providerApiKey(id);
  if (!apiKey) {
    throw new AiNotConfiguredError(
      `AI is not configured. Set ${PROVIDERS[id].keyVars[0]} for ${PROVIDERS[id].label}.`,
    );
  }
  const model = providerModel(id);

  if (id === "anthropic") {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  const baseUrl = providerBaseUrl(id);
  if (!baseUrl) {
    throw new AiNotConfiguredError(
      "AI_BASE_URL must be set when AI_PROVIDER is 'custom'.",
    );
  }
  return completeOpenAiCompatible({ baseUrl, apiKey, model, system, messages, maxTokens });
}

const GROUNDING_RULES = `You are the research assistant inside TONY DAILY, a private news and market intelligence dashboard for Tony Wong, a retired Hong Kong architect who follows markets, property, architecture and urban development.

NON-NEGOTIABLE RULES:
- Use ONLY the source material provided in this conversation. Never rely on your own memory for news, prices, statistics, dates or events.
- If the provided material does not contain the answer, say exactly that the information is unavailable from the currently connected sources. Never guess or fill gaps.
- Never invent a cause for a market movement. If sources do not state a cause, say the available sources do not establish one.
- Separate FACT (from sources) from INTERPRETATION (your reading). Label interpretation explicitly, e.g. "Interpretation:".
- Cite sources inline using bracketed numbers like [1], [2] that refer to the numbered source list you were given.
- Preserve names, numbers, stock codes and dates exactly as in the sources.
- Never give personalised buy/sell advice. If asked, explain you provide information, not financial advice.
- If the user writes in Cantonese/Traditional Chinese, reply in natural Hong Kong written Traditional Chinese (繁體中文, zh-HK). If they write in English, reply in English.

FORMATTING:
- Write clean, calm editorial prose. Do NOT use Markdown syntax: no #, ##, ###, **, *, ---, tables or code fences.
- Prefer short paragraphs. If you must enumerate, use a simple hyphen at the start of the line and keep each item to one sentence.
- Do not add a title or heading unless the user asked for a structured briefing.
- Keep [1] style citation markers exactly as they are.`;

export interface ArticleForContext {
  id: number;
  title: string;
  excerpt: string | null;
  sourceId: string;
  publishedAt: number | null;
  canonicalUrl: string;
  verificationStatus: string;
}

export interface Citation {
  n: number;
  articleId: number;
  title: string;
  source: string;
  url: string;
  publishedAt: number | null;
}

export function buildSourceBlock(articles: ArticleForContext[]): {
  block: string;
  citations: Citation[];
} {
  const citations: Citation[] = articles.map((a, i) => ({
    n: i + 1,
    articleId: a.id,
    title: a.title,
    source: getSource(a.sourceId)?.name ?? a.sourceId,
    url: a.canonicalUrl,
    publishedAt: a.publishedAt,
  }));
  const block = articles
    .map((a, i) => {
      const src = getSource(a.sourceId);
      const date = a.publishedAt ? new Date(a.publishedAt).toISOString() : "unknown date";
      return `[${i + 1}] ${a.title}
Source: ${src?.name ?? a.sourceId} (authority tier ${src?.tier ?? "?"}) · Published: ${date} · Verification: ${a.verificationStatus}
${a.excerpt ? `Excerpt: ${a.excerpt}` : "(headline + metadata only)"}`;
    })
    .join("\n\n");
  return { block, citations };
}

async function complete(system: string, user: string, maxTokens = 1200): Promise<string> {
  return callModel({
    system,
    messages: [{ role: "user", content: user }],
    maxTokens,
  });
}

/** Summarise one article (or a cluster of sources for the same story). Cached. */
export async function summarizeArticle(options: {
  contentHash: string;
  articles: ArticleForContext[];
  level: SummaryLevel;
  language: SummaryLanguage;
}): Promise<string> {
  const { contentHash, articles, level, language } = options;
  const db = await getDb();
  const cached = await db
    .select()
    .from(schema.aiSummaries)
    .where(
      and(
        eq(schema.aiSummaries.contentHash, contentHash),
        eq(schema.aiSummaries.language, language),
        eq(schema.aiSummaries.level, level),
        eq(schema.aiSummaries.model, aiModelId()),
      ),
    )
    .get();
  if (cached) return cached.summary;

  const { block } = buildSourceBlock(articles);
  const levelInstruction =
    level === "30s"
      ? "Write a 30-second summary: 2–3 short factual bullet points only."
      : level === "2min"
        ? "Write a concise 2-minute summary: one tight paragraph (4–6 sentences) covering the essentials and why it matters."
        : "Write a deep-dive synthesis using every provided source: what happened, verified details, differences between sources, and clearly-labelled interpretation. Use short sections.";
  const langInstruction =
    language === "zh-HK"
      ? "Respond in Traditional Chinese as used in Hong Kong (繁體中文). Keep company names, stock codes and figures exactly as in the sources."
      : "Respond in English.";

  const summary = await complete(
    GROUNDING_RULES,
    `${levelInstruction}\n${langInstruction}\nThis is an AI-assisted summary of the sources below — do not add information that is not in them. Write plain prose with no Markdown, no headings and no bold. Do not end mid-sentence.\n\nSOURCES:\n\n${block}`,
    // Headroom for models that spend part of the budget reasoning.
    level === "deep" ? 3000 : 1500,
  );

  await db
    .insert(schema.aiSummaries)
    .values({
      contentHash,
      language,
      level,
      model: aiModelId(),
      summary,
      createdAt: Date.now(),
    })
    .run();
  return summary;
}

/** Grounded Q&A for Ask Tony Daily. */
export async function answerQuestion(options: {
  question: string;
  articles: ArticleForContext[];
  quotes: Quote[];
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<{ text: string; citations: Citation[] }> {
  const { question, articles, quotes, history } = options;
  const { block, citations } = buildSourceBlock(articles);

  const quoteBlock = quotes.length
    ? quotes
        .map((q) => {
          const price = q.price != null ? `${q.currency ?? ""} ${q.price}` : "price unavailable";
          const chg =
            q.percentChange != null
              ? `${q.percentChange > 0 ? "+" : ""}${q.percentChange.toFixed(2)}%`
              : "change unavailable";
          return `${q.symbol} (${q.name ?? "?"}): ${price}, ${chg}, ${q.entitlement} data fetched ${new Date(q.fetchedAt).toISOString()}`;
        })
        .join("\n")
    : "No market data available for this question.";

  const user = `INDEXED NEWS SOURCES (the only news you may use):

${block || "No relevant articles found in the currently connected sources."}

MARKET DATA (${quotes.length ? "delayed/end-of-day as labelled" : "none available"}):
${quoteBlock}

QUESTION:
${question}

HOW TO ANSWER
- Use only the material above. If it is insufficient, say so plainly.
- MANDATORY: every sentence containing a fact from the sources must end with
  its citation marker — [1], [2], and so on — before the full stop or after it.
  An answer with no [n] markers is treated as unsourced and is not acceptable.
- Write flowing prose in complete sentences. No Markdown, no headings, no
  bullet characters, no bold. Do not end mid-sentence.`;

  const text = await callModel({
    system: GROUNDING_RULES,
    messages: [
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: user },
    ],
    // Generous, because some models spend part of the budget on internal
    // reasoning and would otherwise return a truncated answer.
    maxTokens: 3000,
  });

  // Only keep citations actually referenced in the answer.
  const used = new Set(
    [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
  );
  return { text, citations: citations.filter((c) => used.has(c.n)) };
}

/** Short grounded editor's overview for the Daily Brief. */
export async function writeBriefOverview(options: {
  articles: ArticleForContext[];
  language: SummaryLanguage;
  dateLabel: string;
}): Promise<string> {
  const { articles, language, dateLabel } = options;
  const { block } = buildSourceBlock(articles);
  const langInstruction =
    language === "zh-HK" ? "Write in Traditional Chinese (香港繁體中文)." : "Write in English.";
  return complete(
    GROUNDING_RULES,
    `Write a calm 3–5 sentence morning overview for Tony's Daily Brief for ${dateLabel}, weaving together only the most important of the sources below. ${langInstruction} Every sentence carrying a fact must end with its [n] citation marker. No hype, no speculation, no advice. Plain prose only — no Markdown, no headings, no bullets, no bold. Do not end mid-sentence.\n\nSOURCES:\n\n${block}`,
    1500,
  );
}

