import { eq, isNull, and, gt, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { completeRaw, isAiConfigured } from "@/lib/ai";

/**
 * Headline translation (brief §9).
 *
 * Populates `translatedTitle` with an AI-assisted rendering in the other
 * language (EN ↔ 繁 zh-HK). The original headline is never modified and the
 * UI always labels the translation as AI-assisted — it is never attributed
 * to the publisher.
 *
 * Bounded per ingest run to respect free-tier rate limits; top-ranked
 * stories first, so what Tony actually sees is translated soonest. The
 * translations also enable cross-language story clustering.
 */

const SYSTEM = `You translate news headlines between English and Hong Kong Traditional Chinese (zh-HK) for a private dashboard.

RULES:
- Translate faithfully. Never add, remove or soften information.
- Preserve names, numbers, percentages, stock codes and dates exactly.
- For Chinese output use Traditional Chinese with Hong Kong conventions.
- For company names, use the widely used name in the target language when one exists; otherwise keep the original name unchanged.
- Respond with ONLY the translated headline. No quotes, no explanation.`;

export async function translateHeadline(
  title: string,
  from: "en" | "zh-HK",
): Promise<string | null> {
  const target = from === "en" ? "Hong Kong Traditional Chinese (zh-HK)" : "English";
  try {
    const out = (
      await completeRaw(SYSTEM, `Translate into ${target}:\n\n${title}`, 200)
    ).trim();
    if (!out || out.length > 300) return null;
    // A translation that is byte-identical to the input adds nothing.
    return out === title ? null : out;
  } catch {
    return null;
  }
}

const TRANSLATE_PER_RUN = 15;
const WINDOW_MS = 48 * 60 * 60 * 1000;

/** Translate the top-ranked recent headlines that lack a translation. */
export async function translateRecentHeadlines(
  limit = TRANSLATE_PER_RUN,
): Promise<number> {
  if (!isAiConfigured()) return 0;
  const db = await getDb();
  const pending = await db
    .select()
    .from(schema.articles)
    .where(
      and(
        gt(schema.articles.fetchedAt, Date.now() - WINDOW_MS),
        isNull(schema.articles.translatedTitle),
      ),
    )
    .orderBy(desc(schema.articles.score))
    .limit(limit)
    .all();

  let translated = 0;
  for (const article of pending) {
    const from = article.originalLanguage === "zh-HK" ? "zh-HK" : "en";
    const result = await translateHeadline(article.originalTitle, from);
    if (!result) continue;
    await db
      .update(schema.articles)
      .set({ translatedTitle: result })
      .where(eq(schema.articles.id, article.id))
      .run();
    translated++;
  }
  return translated;
}
