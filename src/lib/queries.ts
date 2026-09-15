import { cache } from "react";
import { and, desc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dedupeByCluster, type ArticleRow } from "@/lib/retrieval";
import { SOURCES, getSource } from "@/lib/sources/registry";

const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
/** One page render never needs more than this many candidates. */
const POOL_SIZE = 400;

/**
 * The recent-article pool, fetched at most once per request.
 *
 * Pages previously issued this query several times over (top stories, the
 * hero, each section, related items). With a remote database each repeat
 * was a full network round trip, so the render cost scaled with the number
 * of modules on the page. React's `cache` dedupes it within one render.
 */
const articlePool = cache(async (): Promise<ArticleRow[]> => {
  const db = await getDb();
  return db
    .select()
    .from(schema.articles)
    .where(gt(schema.articles.fetchedAt, Date.now() - WINDOW_MS))
    .orderBy(desc(schema.articles.score))
    .limit(POOL_SIZE)
    .all();
});

export async function recentArticles(limit = 300): Promise<ArticleRow[]> {
  return (await articlePool()).slice(0, limit);
}

/** Entities for the cached pool, also fetched at most once per request. */
const poolEntities = cache(async () => {
  const pool = await articlePool();
  if (pool.length === 0) return [] as (typeof schema.articleEntities.$inferSelect)[];
  const db = await getDb();
  return db
    .select()
    .from(schema.articleEntities)
    .where(inArray(schema.articleEntities.articleId, pool.map((a) => a.id)))
    .all();
});

export async function topStories(limit = 30): Promise<ArticleRow[]> {
  return dedupeByCluster(await recentArticles(400)).slice(0, limit);
}

export async function articlesByCategory(
  categories: string[],
  limit = 24,
): Promise<ArticleRow[]> {
  return dedupeByCluster(
    (await recentArticles(600)).filter((a) => categories.includes(a.category)),
  ).slice(0, limit);
}

export type VideoGroupKey = "hk" | "international" | "design";

/** Which shelf of the Video page a channel belongs on. */
export function videoGroupFor(sourceId: string): VideoGroupKey {
  const source = getSource(sourceId);
  if (source?.categories.includes("architecture")) return "design";
  return source?.region === "hk" ? "hk" : "international";
}

/**
 * The Video page in three shelves -- Hong Kong, International, Architecture
 * & Design -- each newest first, with no channel holding more than
 * `perSource` places.
 *
 * One newest-first list does not work: in the 15 Sept audit its first 30
 * places were all Reuters, Bloomberg, BBC and RTHK, because wire and
 * business channels post dozens of clips a day. TVB, Now, SCMP and both
 * architecture channels -- the video most relevant here -- never appeared.
 * Channels also re-upload a clip under the same title, so identical titles
 * within a channel show once.
 */
export function groupVideos(
  rows: ArticleRow[],
  perSource = 3,
  perGroup = 12,
): Record<VideoGroupKey, ArticleRow[]> {
  const groups: Record<VideoGroupKey, ArticleRow[]> = { hk: [], international: [], design: [] };
  const perSourceCount = new Map<string, number>();
  const seenTitles = new Set<string>();
  const newestFirst = [...rows].sort(
    (a, b) => (b.publishedAt ?? b.fetchedAt) - (a.publishedAt ?? a.fetchedAt),
  );
  for (const a of newestFirst) {
    if (!a.videoId) continue;
    // A channel taken out of the registry -- as two wrong ones were -- stops
    // appearing at once, rather than lingering until its clips age out.
    if (!getSource(a.sourceId)) continue;
    const titleKey = `${a.sourceId}|${a.originalTitle.trim().toLowerCase()}`;
    if (seenTitles.has(titleKey)) continue;
    const used = perSourceCount.get(a.sourceId) ?? 0;
    if (used >= perSource) continue;
    const group = groups[videoGroupFor(a.sourceId)];
    if (group.length >= perGroup) continue;
    seenTitles.add(titleKey);
    perSourceCount.set(a.sourceId, used + 1);
    group.push(a);
  }
  return groups;
}

/**
 * Stories that carry a video, shelved for the Video page.
 *
 * Video is an attribute rather than a category, so this filters on the
 * attribute and leaves categorisation alone: the same item can be Hong Kong
 * news AND a video. Cluster de-duplication still applies, so each cluster
 * keeps its best-scored video.
 */
export async function videoShelves(): Promise<Record<VideoGroupKey, ArticleRow[]>> {
  // Not the Today pool: that is the top 400 stories by score, and the
  // architecture channels -- posting every few days, from lower-authority
  // publishers -- never ranked into it, so their shelf came up empty. Nor
  // one query over all video: the wire channels post hundreds of clips a
  // week and would crowd the others out of any row limit. Each channel's
  // newest few instead, fetched together; the shelf shows three of them.
  const db = await getDb();
  const since = Date.now() - VIDEO_WINDOW_MS;
  const perChannel = await Promise.all(
    SOURCES.filter((s) => s.type === "youtube").map((s) =>
      db
        .select()
        .from(schema.articles)
        .where(
          and(
            eq(schema.articles.sourceId, s.id),
            isNotNull(schema.articles.videoId),
            gt(schema.articles.fetchedAt, since),
          ),
        )
        .orderBy(desc(schema.articles.publishedAt))
        .limit(8)
        .all(),
    ),
  );
  // Score order first, so a cluster keeps its best-scored video.
  const rows = perChannel.flat().sort((a, b) => b.score - a.score);
  return groupVideos(dedupeByCluster(rows));
}

/** Same as the ingest age limit for video (VIDEO_MAX_AGE_MS). */
const VIDEO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function getArticle(id: number): Promise<ArticleRow | undefined> {
  const db = await getDb();
  return db.select().from(schema.articles).where(eq(schema.articles.id, id)).get();
}

export async function getArticles(ids: number[]): Promise<ArticleRow[]> {
  if (ids.length === 0) return [];
  const order = new Map(ids.map((id, i) => [id, i]));

  // Most requested ids are already in the cached pool; only fall back to the
  // database for the remainder, which avoids a round trip per brief section.
  const pool = await articlePool();
  const byId = new Map(pool.map((a) => [a.id, a]));
  const found = ids.map((id) => byId.get(id)).filter((a): a is ArticleRow => Boolean(a));
  const missing = ids.filter((id) => !byId.has(id));

  if (missing.length > 0) {
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.articles)
      .where(inArray(schema.articles.id, missing))
      .all();
    found.push(...rows);
  }
  return found.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getEntities(articleId: number) {
  const db = await getDb();
  return db
    .select()
    .from(schema.articleEntities)
    .where(eq(schema.articleEntities.articleId, articleId))
    .all();
}

/** Related = same cluster first, then shares an entity, newest first. */
export async function relatedArticles(
  article: ArticleRow,
  limit = 6,
): Promise<ArticleRow[]> {
  const myEntities = (await getEntities(article.id)).map(
    (e) => `${e.entityType}:${e.entity}`,
  );
  const pool = (await recentArticles()).filter((a) => a.id !== article.id);
  const cluster = pool.filter(
    (a) => article.clusterId != null && a.clusterId === article.clusterId,
  );
  if (myEntities.length === 0) return cluster.slice(0, limit);

  const rows = await poolEntities();
  const byArticle = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!byArticle.has(r.articleId)) byArticle.set(r.articleId, new Set());
    byArticle.get(r.articleId)!.add(`${r.entityType}:${r.entity}`);
  }
  const shared = pool.filter((a) => {
    if (cluster.some((c) => c.id === a.id)) return false;
    const ents = byArticle.get(a.id);
    return ents ? myEntities.some((e) => ents.has(e)) : false;
  });
  return dedupeByCluster([...cluster, ...shared]).slice(0, limit);
}

export async function savedArticleIds(): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db.select().from(schema.savedArticles).all();
  return new Set(rows.map((s) => s.articleId));
}

export async function watchlist() {
  const db = await getDb();
  const rows = await db.select().from(schema.watchlistItems).all();
  return rows.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** Articles mentioning any watched ticker, for the watchlist news module. */
export async function watchlistNews(limit = 10): Promise<ArticleRow[]> {
  const items = await watchlist();
  if (items.length === 0) return [];
  const symbols = new Set(items.map((i) => i.symbol.toUpperCase()));
  const recent = await recentArticles();
  if (recent.length === 0) return [];
  const rows = await poolEntities();
  const matching = new Set(
    rows
      .filter((r) => r.entityType === "ticker" && symbols.has(r.entity.toUpperCase()))
      .map((r) => r.articleId),
  );
  return dedupeByCluster(recent.filter((a) => matching.has(a.id))).slice(0, limit);
}
