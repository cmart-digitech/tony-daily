import { desc, eq, gt, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dedupeByCluster, toContext, type ArticleRow } from "@/lib/retrieval";
import { isAiConfigured, writeBriefOverview, aiModelId, type Citation } from "@/lib/ai";
import { buildSourceBlock } from "@/lib/ai";
import { getPreferences } from "@/lib/prefs";

const BRIEF_WINDOW_MS = 36 * 60 * 60 * 1000;

export interface BriefSection {
  key: string;
  articleIds: number[];
}

export interface DailyBriefContent {
  overview: string | null;
  overviewCitations: Citation[];
  sections: BriefSection[];
}

export function hkDateKey(now = new Date()): string {
  const tz = process.env.APP_TIMEZONE ?? "Asia/Hong_Kong";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // YYYY-MM-DD
}

function pickSection(
  pool: ArticleRow[],
  used: Set<number>,
  filter: (a: ArticleRow) => boolean,
  max: number,
): number[] {
  const picked: number[] = [];
  for (const a of pool) {
    if (picked.length >= max) break;
    if (used.has(a.id)) continue;
    if (!filter(a)) continue;
    used.add(a.id);
    picked.push(a.id);
  }
  return picked;
}

/**
 * Build (or rebuild) today's Daily Brief. Section membership is deterministic
 * — top-ranked, cluster-deduped stories per category — so every story shown
 * traces to real indexed articles. The AI only writes the grounded overview,
 * and only when ANTHROPIC_API_KEY is configured.
 */
export async function generateDailyBrief(): Promise<{
  dateKey: string;
  content: DailyBriefContent;
}> {
  const db = await getDb();
  const cutoff = Date.now() - BRIEF_WINDOW_MS;
  const recent = dedupeByCluster(
    await db
      .select()
      .from(schema.articles)
      .where(gt(schema.articles.fetchedAt, cutoff))
      .orderBy(desc(schema.articles.score))
      .limit(400)
      .all(),
  );

  const watch = await db.select().from(schema.watchlistItems).all();
  const watchSymbols = new Set(watch.map((w) => w.symbol.toUpperCase()));
  const entityRows = recent.length
    ? await db
        .select()
        .from(schema.articleEntities)
        .where(inArray(schema.articleEntities.articleId, recent.map((a) => a.id)))
        .all()
    : [];
  const watchArticleIds = new Set<number>();
  for (const e of entityRows) {
    if (e.entityType === "ticker" && watchSymbols.has(e.entity.toUpperCase())) {
      watchArticleIds.add(e.articleId);
    }
  }

  const used = new Set<number>();
  const sections: BriefSection[] = [
    { key: "watchlist", articleIds: pickSection(recent, used, (a) => watchArticleIds.has(a.id), 4) },
    { key: "hk", articleIds: pickSection(recent, used, (a) => a.region === "hk" && a.category !== "property" && a.category !== "architecture", 3) },
    { key: "property", articleIds: pickSection(recent, used, (a) => a.category === "property", 3) },
    { key: "architecture", articleIds: pickSection(recent, used, (a) => a.category === "architecture" || a.category === "infrastructure", 3) },
    { key: "china", articleIds: pickSection(recent, used, (a) => a.region === "china" || a.region === "apac", 2) },
    { key: "global", articleIds: pickSection(recent, used, (a) => a.region === "global", 2) },
  ].filter((s) => s.articleIds.length > 0);

  let overview: string | null = null;
  let overviewCitations: Citation[] = [];
  const topIds = sections.flatMap((s) => s.articleIds).slice(0, 12);
  if (isAiConfigured() && topIds.length > 0) {
    const topArticles = recent.filter((a) => topIds.includes(a.id));
    const prefs = await getPreferences();
    const tz = process.env.APP_TIMEZONE ?? "Asia/Hong_Kong";
    const dateLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric",
    }).format(new Date());
    try {
      const contexts = topArticles.map(toContext);
      overview = await writeBriefOverview({
        articles: contexts,
        language: prefs.language === "zh" ? "zh-HK" : "en",
        dateLabel,
      });
      const { citations } = buildSourceBlock(contexts);
      const usedNums = new Set([...overview.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
      overviewCitations = citations.filter((c) => usedNums.has(c.n));
    } catch {
      overview = null; // brief still works without AI — honest omission
    }
  }

  const content: DailyBriefContent = { overview, overviewCitations, sections };
  const dateKey = hkDateKey();
  const existing = await db
    .select()
    .from(schema.dailyBriefs)
    .where(eq(schema.dailyBriefs.dateKey, dateKey))
    .get();
  if (existing) {
    await db
      .update(schema.dailyBriefs)
      .set({ generatedAt: Date.now(), content: JSON.stringify(content), model: overview ? aiModelId() : null })
      .where(eq(schema.dailyBriefs.dateKey, dateKey))
      .run();
  } else {
    await db
      .insert(schema.dailyBriefs)
      .values({
        dateKey,
        generatedAt: Date.now(),
        model: overview ? aiModelId() : null,
        content: JSON.stringify(content),
      })
      .run();
  }
  return { dateKey, content };
}

export async function getTodaysBrief(): Promise<{
  dateKey: string;
  generatedAt: number;
  content: DailyBriefContent;
} | null> {
  const db = await getDb();
  const row = await db
    .select()
    .from(schema.dailyBriefs)
    .where(eq(schema.dailyBriefs.dateKey, hkDateKey()))
    .get();
  if (!row) return null;
  try {
    return {
      dateKey: row.dateKey,
      generatedAt: row.generatedAt,
      content: JSON.parse(row.content) as DailyBriefContent,
    };
  } catch {
    return null;
  }
}
