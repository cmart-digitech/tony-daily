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

const ResponseSchema = z.object({
  project: z.string().trim().min(1).max(200).nullable(),
  location: z.string().trim().min(1).max(200).nullable(),
  developer: z.string().trim().min(1).max(200).nullable(),
  architect: z.string().trim().min(1).max(200).nullable(),
  landUse: z.string().trim().min(1).max(200).nullable(),
  status: z.string().trim().min(1).max(200).nullable(),
  keyFacts: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
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

/** Strip accidental code fences before parsing. */
function parseModelJson(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

/** A typed field is kept only if it appears verbatim in the source text. */
function groundedOrNull(value: string | null, sourceText: string): string | null {
  if (!value) return null;
  return sourceText.toLowerCase().includes(value.toLowerCase()) ? value : null;
}

export async function getOrExtractFacts(
  article: ArticleRow,
): Promise<ArticleFactsRow | null> {
  const db = await getDb();
  const cached = await db
    .select()
    .from(schema.articleFacts)
    .where(eq(schema.articleFacts.articleId, article.id))
    .get();
  if (cached) return cached;

  if (!factsApplicable(article) || !isAiConfigured()) return null;

  const members = await clusterMembers(article);
  const sourceText = members
    .map((m) => `${m.originalTitle}\n${m.excerpt ?? ""}`)
    .join("\n\n")
    .slice(0, 6000);

  let parsed: z.infer<typeof ResponseSchema>;
  try {
    const raw = await completeRaw(SYSTEM, `TEXT:\n\n${sourceText}`, 800);
    parsed = ResponseSchema.parse(parseModelJson(raw));
  } catch {
    return null; // extraction is an enhancement; failures stay silent
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
  return (
    (await db
      .select()
      .from(schema.articleFacts)
      .where(eq(schema.articleFacts.articleId, article.id))
      .get()) ?? null
  );
}
