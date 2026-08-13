import { desc, gt, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { tokenize } from "@/lib/ingest/text";
import type { ArticleForContext } from "@/lib/ai";

const SEARCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type ArticleRow = typeof schema.articles.$inferSelect;

export function toContext(a: ArticleRow): ArticleForContext {
  return {
    id: a.id,
    title: a.originalTitle,
    excerpt: a.excerpt,
    sourceId: a.sourceId,
    publishedAt: a.publishedAt,
    canonicalUrl: a.canonicalUrl,
    verificationStatus: a.verificationStatus,
  };
}

/**
 * Lexical retrieval over recent indexed articles: token overlap between the
 * query and title+excerpt+entities, with a mild recency boost. Returns the
 * strongest matches — or, for broad queries, the top-ranked recent stories.
 */
export async function searchArticles(query: string, limit = 12): Promise<ArticleRow[]> {
  const db = await getDb();
  const cutoff = Date.now() - SEARCH_WINDOW_MS;
  const recent = await db
    .select()
    .from(schema.articles)
    .where(gt(schema.articles.fetchedAt, cutoff))
    .orderBy(desc(schema.articles.score))
    .limit(600)
    .all();
  if (recent.length === 0) return [];

  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return recent.slice(0, limit);

  const entityRows = await db
    .select()
    .from(schema.articleEntities)
    .where(inArray(schema.articleEntities.articleId, recent.map((a) => a.id)))
    .all();
  const entityText = new Map<number, string>();
  for (const e of entityRows) {
    entityText.set(e.articleId, `${entityText.get(e.articleId) ?? ""} ${e.entity}`);
  }

  const now = Date.now();
  const scored = recent.map((a) => {
    const text = `${a.originalTitle} ${a.excerpt ?? ""} ${entityText.get(a.id) ?? ""}`;
    const tTokens = new Set(tokenize(text));
    let overlap = 0;
    for (const t of qTokens) if (tTokens.has(t)) overlap++;
    const ageHours = (now - (a.publishedAt ?? a.fetchedAt)) / 3_600_000;
    const recency = Math.max(0, 1 - ageHours / 168);
    return { a, s: overlap * 10 + recency * 2 + a.score / 50 };
  });

  const withOverlap = scored.filter((x) => x.s >= 10);
  const pool = withOverlap.length > 0 ? withOverlap : scored;
  return pool
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.a);
}

/** One representative article per story cluster, keeping the best-scored. */
export function dedupeByCluster(rows: ArticleRow[]): ArticleRow[] {
  const seen = new Set<number>();
  const out: ArticleRow[] = [];
  for (const a of rows) {
    if (a.clusterId != null) {
      if (seen.has(a.clusterId)) continue;
      seen.add(a.clusterId);
    }
    out.push(a);
  }
  return out;
}

/** All articles in the same cluster (for "also reported by" and summaries). */
export async function clusterMembers(article: ArticleRow): Promise<ArticleRow[]> {
  if (article.clusterId == null) return [article];
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.articles)
    .where(inArray(schema.articles.clusterId, [article.clusterId]))
    .all();
  return rows.length ? rows : [article];
}

/** Symbols possibly referenced by a chat question (for market retrieval). */
export function extractQuerySymbols(query: string, watchlistSymbols: string[]): string[] {
  const out = new Set<string>();
  const tickerRe = /\b(\d{4,5})\.HK\b|\b([A-Z]{1,5})\b/g;
  const upper = query.toUpperCase();
  let m: RegExpExecArray | null;
  while ((m = tickerRe.exec(upper)) !== null) {
    if (m[1]) out.add(`${m[1].padStart(4, "0")}.HK`);
  }
  const wl = new Set(watchlistSymbols.map((s) => s.toUpperCase()));
  for (const s of wl) {
    const base = s.split(".")[0] ?? s;
    if (upper.includes(s) || (base.length >= 2 && upper.includes(base))) out.add(s);
  }
  const mentionsWatchlist = /watchlist|my stocks|我的|自選|持倉|股票/i.test(query);
  if (mentionsWatchlist) for (const s of watchlistSymbols) out.add(s);
  return [...out].slice(0, 8);
}
