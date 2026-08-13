import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { clusterMembers, type ArticleRow } from "@/lib/retrieval";
import { aiModelId, completeRaw, isAiConfigured } from "@/lib/ai";

/**
 * Structured built-environment metadata (brief §57–58).
 *
 * Extraction runs once per article (cached in article_facts) over the
 * article's own retained text plus its cluster siblings. The rules mirror
 * the product's grounding rules, then go one step further: after the model
 * answers, every typed field is VALIDATED to appear literally in the source
 * text (case-insensitive). A value the model paraphrased or invented is
 * dropped rather than stored. Key facts are sentences, so they cannot be
 * substring-checked — they are stored separately and always labelled
 * AI-assisted in the UI.
 */

/**
 * Tolerant of the ways models actually answer: an omitted key, an explicit
 * null, or junk in one field must not discard the whole extraction.
 */
const field = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .nullish()
  .catch(null)
  .transform((v) => v ?? null);

const ResponseSchema = z.object({
  project: field,
  location: field,
  developer: field,
  architect: field,
  landUse: field,
  status: field,
  keyFacts: z.array(z.string().trim().min(1).max(300)).max(5).catch([]).default([]),
});

export type ArticleFactsRow = typeof schema.articleFacts.$inferSelect;

const SYSTEM = `You extract structured facts from Hong Kong property and architecture news for a private dashboard.

RULES — absolute:
- Use ONLY the text provided. Never use outside knowledge, even when you are confident.
- Fill a field ONLY when the text states it explicitly. Otherwise use null.
- Copy names EXACTLY as written in the text (same spelling, same language). Do not translate, expand or normalise them.
- Never estimate values, dates, prices or completion status.
- keyFacts: up to 5 short factual statements, each fully supported by the text. No interpretation, no speculation.
- Respond with ONLY a JSON object, no markdown fences, in this shape:
{"project": string|null, "location": string|null, "developer": string|null, "architect": string|null, "landUse": string|null, "status": string|null, "keyFacts": string[]}`;

const CATEGORIES_WITH_FACTS = new Set(["property", "architecture", "infrastructure"]);

export function factsApplicable(article: ArticleRow): boolean {
  return CATEGORIES_WITH_FACTS.has(article.category);
}

/**
 * Models wrap JSON in fences or prose despite instructions; parse the first
 * complete object found rather than requiring a perfectly bare response.
 */
function parseModelJson(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** A typed field is kept only if it appears verbatim in the source text. */
function groundedOrNull(value: string | null, sourceText: string): string | null {
  if (!value) return null;
  return sourceText.toLowerCase().includes(value.toLowerCase()) ? value : null;
}

export interface FactsResult {
  facts: ArticleFactsRow | null;
  /** Why extraction produced nothing — diagnostic text, never secret. */
  reason?: string;
}

export async function getOrExtractFacts(article: ArticleRow): Promise<FactsResult> {
  const db = await getDb();
  const cached = await db
    .select()
    .from(schema.articleFacts)
    .where(eq(schema.articleFacts.articleId, article.id))
    .get();
  if (cached) return { facts: cached };

  if (!factsApplicable(article)) return { facts: null, reason: "not-applicable" };
  if (!isAiConfigured()) return { facts: null, reason: "ai-not-configured" };

  const members = await clusterMembers(article);
  const sourceText = members
    .map((m) => `${m.originalTitle}\n${m.excerpt ?? ""}`)
    .join("\n\n")
    .slice(0, 6000);

  let parsed: z.infer<typeof ResponseSchema>;
  try {
    // Generous budget: reasoning models spend tokens before emitting JSON,
    // and a truncated object parses as nothing at all.
    const raw = await completeRaw(SYSTEM, `TEXT:\n\n${sourceText}`, 2000);
    parsed = ResponseSchema.parse(parseModelJson(raw));
  } catch (err) {
    // Extraction is an enhancement — the page works without it — but the
    // failure reason must be visible, not swallowed.
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`facts extraction failed for article ${article.id}: ${reason}`);
    return { facts: null, reason: reason.slice(0, 300) };
  }

  const row: typeof schema.articleFacts.$inferInsert = {
    articleId: article.id,
    project: groundedOrNull(parsed.project, sourceText),
    location: groundedOrNull(parsed.location, sourceText),
    developer: groundedOrNull(parsed.developer, sourceText),
    architect: groundedOrNull(parsed.architect, sourceText),
    landUse: groundedOrNull(parsed.landUse, sourceText),
    status: groundedOrNull(parsed.status, sourceText),
    keyFacts: JSON.stringify(parsed.keyFacts.slice(0, 5)),
    model: aiModelId(),
    createdAt: Date.now(),
  };
  try {
    await db.insert(schema.articleFacts).values(row).run();
  } catch {
    // a concurrent request may have inserted first; read whichever won
  }
  const stored =
    (await db
      .select()
      .from(schema.articleFacts)
      .where(eq(schema.articleFacts.articleId, article.id))
      .get()) ?? null;
  return { facts: stored, reason: stored ? undefined : "store-failed" };
}
