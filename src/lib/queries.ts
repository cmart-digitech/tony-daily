import { desc, eq, gt, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { dedupeByCluster, type ArticleRow } from "@/lib/retrieval";

const WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export async function recentArticles(limit = 300): Promise<ArticleRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.articles)
    .where(gt(schema.articles.fetchedAt, Date.now() - WINDOW_MS))
    .orderBy(desc(schema.articles.score))
    .limit(limit)
    .all();
}

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

export async function getArticle(id: number): Promise<ArticleRow | undefined> {
  const db = await getDb();
  return db.select().from(schema.articles).where(eq(schema.articles.id, id)).get();
}

export async function getArticles(ids: number[]): Promise<ArticleRow[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.articles)
    .where(inArray(schema.articles.id, ids))
    .all();
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
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
  const db = await getDb();
  const myEntities = (await getEntities(article.id)).map(
    (e) => `${e.entityType}:${e.entity}`,
  );
  const pool = (await recentArticles(600)).filter((a) => a.id !== article.id);
  const cluster = pool.filter(
    (a) => article.clusterId != null && a.clusterId === article.clusterId,
  );
  if (myEntities.length === 0) return cluster.slice(0, limit);

  const poolIds = pool.map((a) => a.id);
  const rows = poolIds.length
    ? await db
        .select()
        .from(schema.articleEntities)
        .where(inArray(schema.articleEntities.articleId, poolIds))
        .all()
    : [];
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
  const db = await getDb();
  const items = await watchlist();
  if (items.length === 0) return [];
  const symbols = new Set(items.map((i) => i.symbol.toUpperCase()));
  const recent = await recentArticles(600);
  if (recent.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.articleEntities)
    .where(inArray(schema.articleEntities.articleId, recent.map((a) => a.id)))
    .all();
  const matching = new Set(
    rows
      .filter((r) => r.entityType === "ticker" && symbols.has(r.entity.toUpperCase()))
      .map((r) => r.articleId),
  );
  return dedupeByCluster(recent.filter((a) => matching.has(a.id))).slice(0, limit);
}
