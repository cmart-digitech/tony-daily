import Parser from "rss-parser";
import { desc, eq, gt, inArray, isNotNull, isNull, and } from "drizzle-orm";
import { getDb, runBatch, schema } from "@/lib/db";
import { SOURCES, type SourceConfig } from "@/lib/sources/registry";
import { classifyCategory, classifyRegion } from "./classify";
import { extractEntities } from "./entities";
import { fetchOgImages } from "./images";
import { backfillIndex, indexArticles } from "@/lib/search/fts";
import {
  buildIdf,
  canonicalizeUrl,
  contentHash,
  MIN_SHARED_TOKENS,
  stripHtml,
  tokenize,
  weightedSimilarity,
} from "./text";
import { getPreferences } from "@/lib/prefs";
import { scoreArticle } from "@/lib/rank/score";

const SOURCE_COOLDOWN_MS = 15 * 60 * 1000; // be polite to publishers
const FETCH_TIMEOUT_MS = 20_000;
const CLUSTER_WINDOW_MS = 48 * 60 * 60 * 1000;
const RESCORE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Clustering thresholds, calibrated against the live index (see
 * scripts/cluster-probe.mjs). Genuine same-event pairs score ≥0.62 on
 * IDF-weighted containment; the strongest unrelated pair scores 0.56.
 * A shared-entity match lets a slightly weaker headline pair through.
 */
const CLUSTER_SIMILARITY = 0.62;
const CLUSTER_SIMILARITY_WITH_ENTITY = 0.5;
/**
 * Cross-language pairs are compared via AI-translated titles, which adds a
 * translation-noise step — so the bar is higher, and higher still without a
 * shared entity to corroborate the match.
 */
const CROSS_LANG_SIMILARITY = 0.72;
const CROSS_LANG_SIMILARITY_WITH_ENTITY = 0.58;
/** Stub headlines ("Business Daily") carry too little signal to match on. */
const MIN_TITLE_TOKENS = 3;

/**
 * Some publishers omit images from RSS but declare an og:image on the page.
 * Each run tops up a bounded number of image-less articles, so the backlog
 * clears over time without a long request or a burst of traffic to any one
 * publisher.
 */
const OG_ENRICH_PER_RUN = 60;

type FeedItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  creator?: string;
  content?: string;
  contentSnippet?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: { $?: { url?: string; medium?: string } }[];
  mediaThumbnail?: { $?: { url?: string } };
};

const parser = new Parser<Record<string, unknown>, FeedItem>({
  timeout: FETCH_TIMEOUT_MS,
  headers: { "User-Agent": "TonyDaily/0.1 (personal news dashboard)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

function pickImage(item: FeedItem): string | null {
  for (const mc of item.mediaContent ?? []) {
    const url = mc?.$?.url;
    if (url && (!mc.$?.medium || mc.$.medium === "image")) return url;
  }
  const thumb = item.mediaThumbnail?.$?.url;
  if (thumb) return thumb;
  if (item.enclosure?.url && (item.enclosure.type ?? "").startsWith("image")) {
    return item.enclosure.url;
  }
  if (item.enclosure?.url && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(item.enclosure.url)) {
    return item.enclosure.url;
  }
  const m = item.content?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function fetchWithRetry(source: SourceConfig, attempts = 2) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await parser.parseURL(source.feedUrl);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

export interface IngestResult {
  sourceId: string;
  status: "ok" | "error" | "skipped";
  itemsFound: number;
  itemsNew: number;
  message?: string;
}

interface NormalisedItem {
  canonicalUrl: string;
  title: string;
  hash: string;
  excerpt: string;
  publishedAt: number | null;
  imageUrl: string | null;
  author: string | null;
  category: string;
  region: string;
  entities: ReturnType<typeof extractEntities>;
}

/**
 * Ingest one source: fetch feed, normalise, and insert only new items.
 * Round-trip-efficient for hosted DBs: one select for existing URLs/hashes,
 * chunked inserts, one id-lookup select, batched entity inserts.
 */
async function ingestSource(source: SourceConfig): Promise<IngestResult> {
  const db = await getDb();
  const startedAt = Date.now();
  try {
    const feed = await fetchWithRetry(source);
    const items = feed.items ?? [];

    const normalised: NormalisedItem[] = [];
    const seenInFeed = new Set<string>();
    for (const item of items) {
      const rawTitle = (item.title ?? "").trim();
      const link = item.link?.trim();
      if (!rawTitle || !link) continue;
      const canonical = canonicalizeUrl(link);
      if (seenInFeed.has(canonical)) continue;
      seenInFeed.add(canonical);
      const title = stripHtml(rawTitle);
      const excerpt = stripHtml(item.contentSnippet ?? item.content ?? "").slice(0, 500);
      const classifiable = `${title} ${excerpt}`;
      const publishedRaw = item.isoDate ?? item.pubDate;
      normalised.push({
        canonicalUrl: canonical,
        title,
        hash: contentHash([source.id, title, canonical]),
        excerpt,
        publishedAt: publishedRaw ? Date.parse(publishedRaw) || null : null,
        imageUrl: pickImage(item),
        author: item.creator ?? null,
        category: classifyCategory(classifiable, source),
        region: classifyRegion(classifiable, source),
        entities: extractEntities(classifiable),
      });
    }

    // One round trip: which of these URLs/hashes already exist anywhere?
    const urls = normalised.map((n) => n.canonicalUrl);
    const existing = urls.length
      ? await db
          .select({
            canonicalUrl: schema.articles.canonicalUrl,
            contentHash: schema.articles.contentHash,
          })
          .from(schema.articles)
          .where(inArray(schema.articles.canonicalUrl, urls))
          .all()
      : [];
    const existingUrls = new Set(existing.map((e) => e.canonicalUrl));
    const allHashes = normalised.length
      ? await db
          .select({ contentHash: schema.articles.contentHash })
          .from(schema.articles)
          .where(inArray(schema.articles.contentHash, normalised.map((n) => n.hash)))
          .all()
      : [];
    const existingHashes = new Set(allHashes.map((h) => h.contentHash));

    const fresh = normalised.filter(
      (n) => !existingUrls.has(n.canonicalUrl) && !existingHashes.has(n.hash),
    );

    if (fresh.length > 0) {
      const now = Date.now();
      const CHUNK = 40;
      for (let i = 0; i < fresh.length; i += CHUNK) {
        await db
          .insert(schema.articles)
          .values(
            fresh.slice(i, i + CHUNK).map((n) => ({
              sourceId: source.id,
              canonicalUrl: n.canonicalUrl,
              originalTitle: n.title,
              originalLanguage: source.language,
              excerpt: n.excerpt || null,
              author: n.author,
              publishedAt: n.publishedAt,
              fetchedAt: now,
              imageUrl: n.imageUrl,
              imageAttribution: n.imageUrl ? source.name : null,
              contentHash: n.hash,
              verificationStatus: source.primary ? "PRIMARY_VERIFIED" : "SINGLE_SOURCE",
              category: n.category,
              region: n.region,
            })),
          )
          .run();
      }
      // Map fresh URLs back to their new ids in one select.
      const inserted = await db
        .select({ id: schema.articles.id, canonicalUrl: schema.articles.canonicalUrl })
        .from(schema.articles)
        .where(inArray(schema.articles.canonicalUrl, fresh.map((n) => n.canonicalUrl)))
        .all();
      const idByUrl = new Map(inserted.map((r) => [r.canonicalUrl, r.id]));
      const entityValues = fresh.flatMap((n) => {
        const articleId = idByUrl.get(n.canonicalUrl);
        if (!articleId) return [];
        return n.entities.map((e) => ({
          articleId,
          entity: e.entity,
          entityType: e.entityType,
        }));
      });
      for (let i = 0; i < entityValues.length; i += 100) {
        await db
          .insert(schema.articleEntities)
          .values(entityValues.slice(i, i + 100))
          .run();
      }

      // Keep the full-text index in step with the new rows.
      await indexArticles(
        fresh.flatMap((n) => {
          const articleId = idByUrl.get(n.canonicalUrl);
          if (!articleId) return [];
          return [{
            id: articleId,
            title: n.title,
            excerpt: n.excerpt || null,
            entities: n.entities.map((e) => e.entity),
          }];
        }),
      );
    }

    await db
      .insert(schema.syncLogs)
      .values({
        sourceId: source.id, startedAt, finishedAt: Date.now(),
        status: "ok", itemsFound: items.length, itemsNew: fresh.length,
      })
      .run();
    await upsertSourceState(source.id, {
      enabled: true, lastSyncAt: Date.now(), lastStatus: "healthy",
      lastError: null, lastItemCount: items.length,
    });
    return { sourceId: source.id, status: "ok", itemsFound: items.length, itemsNew: fresh.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .insert(schema.syncLogs)
      .values({ sourceId: source.id, startedAt, finishedAt: Date.now(), status: "error", message })
      .run();
    await upsertSourceState(source.id, {
      enabled: true, lastSyncAt: Date.now(), lastStatus: "error", lastError: message,
    });
    return { sourceId: source.id, status: "error", itemsFound: 0, itemsNew: 0, message };
  }
}

export async function runIngest(options?: { force?: boolean }): Promise<IngestResult[]> {
  const db = await getDb();
  const now = Date.now();
  const states = await db.select().from(schema.sourceState).all();
  const stateMap = new Map(states.map((s) => [s.sourceId, s]));

  const due: SourceConfig[] = [];
  const results: IngestResult[] = [];
  for (const source of SOURCES) {
    const state = stateMap.get(source.id);
    const enabled = state ? state.enabled : source.enabled;
    if (!enabled) {
      results.push({ sourceId: source.id, status: "skipped", itemsFound: 0, itemsNew: 0, message: "disabled" });
      continue;
    }
    if (!options?.force && state?.lastSyncAt && now - state.lastSyncAt < SOURCE_COOLDOWN_MS) {
      results.push({ sourceId: source.id, status: "skipped", itemsFound: 0, itemsNew: 0, message: "cooldown" });
      continue;
    }
    due.push(source);
  }

  // Feeds fetch concurrently (bounded) so a full run fits serverless limits.
  const CONCURRENCY = 6;
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const chunk = due.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(chunk.map((s) => ingestSource(s)))));
  }

  await enrichMissingImages();
  await backfillIndex(); // catch up any articles that predate the FTS index
  // NOTE: headline translation deliberately does NOT run here. Ingest fires
  // every ~30 minutes; translating on each run consumed the free AI quota
  // and starved the interactive features (chat, summaries, facts). It runs
  // once daily from the brief cron instead — see /api/cron/brief.
  await reclassifyRecentArticles();
  await clusterRecentArticles();
  await applyCorroboration();
  await rescoreRecentArticles();
  return results;
}

/**
 * Fill in missing images from publishers' own Open Graph previews. Newest
 * first, so what Tony is most likely to see is fixed soonest.
 */
export async function enrichMissingImages(limit = OG_ENRICH_PER_RUN): Promise<number> {
  const db = await getDb();
  const cutoff = Date.now() - RESCORE_WINDOW_MS;
  const pending = await db
    .select({
      id: schema.articles.id,
      url: schema.articles.canonicalUrl,
      sourceId: schema.articles.sourceId,
    })
    .from(schema.articles)
    .where(and(gt(schema.articles.fetchedAt, cutoff), isNull(schema.articles.imageUrl)))
    .orderBy(desc(schema.articles.fetchedAt))
    .limit(limit)
    .all();
  if (pending.length === 0) return 0;

  const images = await fetchOgImages(pending.map((p) => ({ id: p.id, url: p.url })));
  const sourceName = new Map(SOURCES.map((s) => [s.id, s.name]));

  for (const p of pending) {
    const image = images.get(p.id);
    if (!image) continue;
    await db
      .update(schema.articles)
      .set({ imageUrl: image, imageAttribution: sourceName.get(p.sourceId) ?? p.sourceId })
      .where(eq(schema.articles.id, p.id))
      .run();
  }
  return images.size;
}

async function upsertSourceState(
  sourceId: string,
  patch: Partial<typeof schema.sourceState.$inferInsert>,
) {
  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.sourceState)
    .where(eq(schema.sourceState.sourceId, sourceId))
    .get();
  if (existing) {
    await db
      .update(schema.sourceState)
      .set(patch)
      .where(eq(schema.sourceState.sourceId, sourceId))
      .run();
  } else {
    await db
      .insert(schema.sourceState)
      .values({ sourceId, enabled: true, ...patch })
      .run();
  }
}

/**
 * Re-apply classification to already-stored articles.
 *
 * Categories are written once at ingest time, so a rule change would
 * otherwise only affect new items and leave the sections wrong for days —
 * a road accident kept leading the Architecture page after the incident
 * guard was added. Classification is pure string matching, so this is cheap;
 * only rows whose category actually changes are written back.
 */
export async function reclassifyRecentArticles(): Promise<number> {
  const db = await getDb();
  const cutoff = Date.now() - RESCORE_WINDOW_MS;
  const recent = await db
    .select()
    .from(schema.articles)
    .where(gt(schema.articles.fetchedAt, cutoff))
    .all();
  if (recent.length === 0) return 0;

  const sourceById = new Map(SOURCES.map((s) => [s.id, s]));
  let changed = 0;
  for (const a of recent) {
    const source = sourceById.get(a.sourceId);
    if (!source) continue;
    const text = `${a.originalTitle} ${a.excerpt ?? ""}`;
    const category = classifyCategory(text, source);
    const region = classifyRegion(text, source);
    if (category === a.category && region === a.region) continue;
    await db
      .update(schema.articles)
      .set({ category, region })
      .where(eq(schema.articles.id, a.id))
      .run();
    changed++;
  }
  return changed;
}

/**
 * Cluster near-duplicate stories from the last 48h using headline similarity
 * plus shared-entity support, so one event → one card with all sources.
 */
export async function clusterRecentArticles() {
  const db = await getDb();
  const cutoff = Date.now() - CLUSTER_WINDOW_MS;
  const recent = await db
    .select()
    .from(schema.articles)
    .where(gt(schema.articles.fetchedAt, cutoff))
    .orderBy(desc(schema.articles.fetchedAt))
    .all();
  const unclustered = recent.filter((a) => a.clusterId === null);
  if (unclustered.length === 0) return;

  const entityRows = recent.length
    ? await db
        .select()
        .from(schema.articleEntities)
        .where(inArray(schema.articleEntities.articleId, recent.map((a) => a.id)))
        .all()
    : [];
  const entitiesByArticle = new Map<number, Set<string>>();
  for (const row of entityRows) {
    if (!entitiesByArticle.has(row.articleId)) entitiesByArticle.set(row.articleId, new Set());
    entitiesByArticle.get(row.articleId)!.add(`${row.entityType}:${row.entity}`);
  }

  const sharesEntity = (a: number, b: number) => {
    const ea = entitiesByArticle.get(a);
    const eb = entitiesByArticle.get(b);
    if (!ea || !eb) return false;
    for (const e of ea) if (eb.has(e)) return true;
    return false;
  };

  // IDF over the current window so common local vocabulary is discounted.
  const idf = buildIdf(recent.map((a) => a.originalTitle));
  // English forms enable cross-language comparison: an article's own title
  // when English, its AI translation when Chinese (may be absent).
  const englishForm = (a: (typeof recent)[number]) =>
    a.originalLanguage === "en" ? a.originalTitle : a.translatedTitle;
  const idfEn = buildIdf(
    recent.map(englishForm).filter((t): t is string => Boolean(t)),
  );
  const tokenCount = new Map(recent.map((a) => [a.id, new Set(tokenize(a.originalTitle)).size]));

  for (const article of unclustered) {
    if ((tokenCount.get(article.id) ?? 0) < MIN_TITLE_TOKENS) continue;
    for (const other of recent) {
      if (other.id === article.id) continue;
      // Same-source items are usually distinct stories, not corroboration.
      if (other.sourceId === article.sourceId) continue;
      if ((tokenCount.get(other.id) ?? 0) < MIN_TITLE_TOKENS) continue;

      const sameLanguage = other.originalLanguage === article.originalLanguage;
      let score: number;
      let sharedTokens: number;
      let threshold: number;
      if (sameLanguage) {
        ({ score, sharedTokens } = weightedSimilarity(
          article.originalTitle,
          other.originalTitle,
          idf,
        ));
        threshold = sharesEntity(article.id, other.id)
          ? CLUSTER_SIMILARITY_WITH_ENTITY
          : CLUSTER_SIMILARITY;
      } else {
        // Cross-language: only comparable once both sides have English forms.
        const a = englishForm(article);
        const b = englishForm(other);
        if (!a || !b) continue;
        ({ score, sharedTokens } = weightedSimilarity(a, b, idfEn));
        threshold = sharesEntity(article.id, other.id)
          ? CROSS_LANG_SIMILARITY_WITH_ENTITY
          : CROSS_LANG_SIMILARITY;
      }
      if (sharedTokens < MIN_SHARED_TOKENS) continue;
      if (score < threshold) continue;

      let assigned: number;
      if (other.clusterId != null) {
        assigned = other.clusterId;
      } else {
        const cluster = await db
          .insert(schema.storyClusters)
          .values({ repArticleId: other.id, createdAt: Date.now(), updatedAt: Date.now() })
          .run();
        assigned = Number(cluster.lastInsertRowid);
        await db
          .update(schema.articles)
          .set({ clusterId: assigned })
          .where(eq(schema.articles.id, other.id))
          .run();
        other.clusterId = assigned;
      }
      await db
        .update(schema.articles)
        .set({ clusterId: assigned })
        .where(eq(schema.articles.id, article.id))
        .run();
      article.clusterId = assigned;
      await db
        .update(schema.storyClusters)
        .set({ updatedAt: Date.now() })
        .where(eq(schema.storyClusters.id, assigned))
        .run();
      break;
    }
  }
}

/** Upgrade SINGLE_SOURCE → CORROBORATED when a cluster spans ≥2 sources. */
export async function applyCorroboration() {
  const db = await getDb();
  const cutoff = Date.now() - CLUSTER_WINDOW_MS;
  const clustered = await db
    .select()
    .from(schema.articles)
    .where(and(gt(schema.articles.fetchedAt, cutoff), isNotNull(schema.articles.clusterId)))
    .all();
  const byCluster = new Map<number, typeof clustered>();
  for (const a of clustered) {
    if (a.clusterId == null) continue;
    if (!byCluster.has(a.clusterId)) byCluster.set(a.clusterId, []);
    byCluster.get(a.clusterId)!.push(a);
  }
  const upgradeIds: number[] = [];
  for (const [, articles] of byCluster) {
    const sources = new Set(articles.map((a) => a.sourceId));
    if (sources.size >= 2) {
      for (const a of articles) {
        if (a.verificationStatus === "SINGLE_SOURCE") upgradeIds.push(a.id);
      }
    }
  }
  if (upgradeIds.length > 0) {
    await db
      .update(schema.articles)
      .set({ verificationStatus: "CORROBORATED" })
      .where(inArray(schema.articles.id, upgradeIds))
      .run();
  }
}

/** Recompute ranking scores for recent articles (recency decays over time). */
export async function rescoreRecentArticles() {
  const db = await getDb();
  const prefs = await getPreferences();
  const cutoff = Date.now() - RESCORE_WINDOW_MS;
  const recent = await db
    .select()
    .from(schema.articles)
    .where(gt(schema.articles.fetchedAt, cutoff))
    .all();
  if (recent.length === 0) return;

  const watch = await db.select().from(schema.watchlistItems).all();
  const watchSymbols = new Set(watch.map((w) => w.symbol.toUpperCase()));
  const watchNames = watch.map((w) => w.name.toLowerCase()).filter((n) => n.length > 3);

  const entityRows = await db
    .select()
    .from(schema.articleEntities)
    .where(inArray(schema.articleEntities.articleId, recent.map((a) => a.id)))
    .all();
  const entitiesByArticle = new Map<number, { entity: string; entityType: string }[]>();
  for (const row of entityRows) {
    if (!entitiesByArticle.has(row.articleId)) entitiesByArticle.set(row.articleId, []);
    entitiesByArticle.get(row.articleId)!.push(row);
  }

  const clusterSources = new Map<number, Set<string>>();
  const clusterEarliest = new Map<number, number>();
  for (const a of recent) {
    if (a.clusterId == null) continue;
    if (!clusterSources.has(a.clusterId)) clusterSources.set(a.clusterId, new Set());
    clusterSources.get(a.clusterId)!.add(a.sourceId);
    const t = a.publishedAt ?? a.fetchedAt;
    const prev = clusterEarliest.get(a.clusterId);
    if (prev === undefined || t < prev) clusterEarliest.set(a.clusterId, t);
  }

  const sourceAuthority = new Map(SOURCES.map((s) => [s.id, s.authority]));

  const db2 = db;
  const updates: { run: () => Promise<unknown> }[] = [];
  for (const a of recent) {
    const ents = entitiesByArticle.get(a.id) ?? [];
    const watchlistMatch =
      ents.some(
        (e) => e.entityType === "ticker" && watchSymbols.has(e.entity.toUpperCase()),
      ) ||
      ents.some(
        (e) =>
          e.entityType === "company" &&
          watchNames.some((n) => e.entity.toLowerCase().includes(n) || n.includes(e.entity.toLowerCase())),
      );
    const corroborationCount = a.clusterId
      ? Math.max(0, (clusterSources.get(a.clusterId)?.size ?? 1) - 1)
      : 0;
    const isNovel = a.clusterId
      ? (a.publishedAt ?? a.fetchedAt) <= (clusterEarliest.get(a.clusterId) ?? 0)
      : true;

    const score = scoreArticle(
      {
        category: a.category,
        region: a.region as "hk" | "china" | "apac" | "global",
        authority: sourceAuthority.get(a.sourceId) ?? 50,
        publishedAt: a.publishedAt,
        corroborationCount,
        watchlistMatch,
        isNovel,
      },
      prefs.interests,
      prefs.rankWeights,
    );
    if (score !== a.score) {
      updates.push({
        run: () =>
          Promise.resolve(
            db2
              .update(schema.articles)
              .set({ score })
              .where(eq(schema.articles.id, a.id))
              .run(),
          ),
      });
    }
  }
  await runBatch(updates);
}

/** Timestamp of the most recent successful sync across sources (for freshness UI). */
export async function lastRefreshedAt(): Promise<number | null> {
  const db = await getDb();
  const states = await db.select().from(schema.sourceState).all();
  const times = states.map((s) => s.lastSyncAt).filter((t): t is number => t != null);
  return times.length ? Math.max(...times) : null;
}
