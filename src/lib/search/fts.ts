import { sql } from "drizzle-orm";
import { getDb, type AppDb } from "@/lib/db";

/**
 * FTS5 full-text index over articles (title, excerpt, entities).
 *
 * Why it exists: search and AI retrieval previously scanned recent rows in
 * application code, which cannot scale past a few hundred articles and
 * cannot rank by term relevance. FTS5 is supported by both drivers we use
 * (better-sqlite3 locally, libSQL/Turso hosted).
 *
 * Scope: Latin-script queries. The default unicode61 tokenizer does not
 * segment Chinese, so CJK queries keep using the calibrated bigram scan in
 * src/lib/retrieval.ts — that path works today and stays correct. If FTS5
 * is unavailable in a build, everything falls back to the lexical scan.
 */

let ftsState: Promise<boolean> | null = null;

/** Create the index once per process; false when FTS5 is unavailable. */
export function ftsReady(): Promise<boolean> {
  if (!ftsState) {
    ftsState = (async () => {
      try {
        const db = await getDb();
        await db.run(sql`
          CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts
          USING fts5(title, excerpt, entities)
        `);
        return true;
      } catch {
        return false;
      }
    })();
  }
  return ftsState;
}

export interface FtsDoc {
  id: number;
  title: string;
  excerpt: string | null;
  entities: string[];
}

/** Insert or refresh documents. rowid mirrors the article id. */
export async function indexArticles(docs: FtsDoc[]): Promise<void> {
  if (docs.length === 0 || !(await ftsReady())) return;
  const db = await getDb();
  for (const doc of docs) {
    // FTS5 enforces no rowid uniqueness on plain INSERT; delete-then-insert
    // keeps re-indexing idempotent.
    await db.run(sql`DELETE FROM articles_fts WHERE rowid = ${doc.id}`);
    await db.run(sql`
      INSERT INTO articles_fts (rowid, title, excerpt, entities)
      VALUES (${doc.id}, ${doc.title}, ${doc.excerpt ?? ""}, ${doc.entities.join(" ")})
    `);
  }
}

/** Index any articles not yet present (bounded, newest first). */
export async function backfillIndex(limit = 200): Promise<number> {
  if (!(await ftsReady())) return 0;
  const db = await getDb();
  const missing = (await db.all(sql`
    SELECT a.id AS id, a.original_title AS title, a.excerpt AS excerpt
    FROM articles a
    WHERE a.id NOT IN (SELECT rowid FROM articles_fts)
    ORDER BY a.id DESC
    LIMIT ${limit}
  `)) as { id: number; title: string; excerpt: string | null }[];
  if (missing.length === 0) return 0;

  const entityRows = (await db.all(sql`
    SELECT article_id AS articleId, entity
    FROM article_entities
    WHERE article_id IN ${missing.map((m) => m.id)}
  `)) as { articleId: number; entity: string }[];
  const byArticle = new Map<number, string[]>();
  for (const r of entityRows) {
    if (!byArticle.has(r.articleId)) byArticle.set(r.articleId, []);
    byArticle.get(r.articleId)!.push(r.entity);
  }
  await indexArticles(
    missing.map((m) => ({
      id: m.id,
      title: m.title,
      excerpt: m.excerpt,
      entities: byArticle.get(m.id) ?? [],
    })),
  );
  return missing.length;
}

/**
 * Turn free text into a safe FTS5 MATCH expression, or null when this query
 * should use the lexical fallback (CJK content, or nothing searchable).
 * Tokens are double-quoted so user input can never break MATCH syntax.
 */
export function toMatchExpression(query: string): string | null {
  if (/[㐀-鿿]/.test(query)) return null; // CJK → bigram scan
  const tokens = query
    .toLowerCase()
    .match(/[\p{L}\p{N}]{2,}/gu)
    ?.slice(0, 8);
  if (!tokens || tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"`).join(" ");
}

/** bm25-ranked article ids for a match expression. */
export async function searchIndex(match: string, limit: number): Promise<number[]> {
  if (!(await ftsReady())) return [];
  const db: AppDb = await getDb();
  try {
    const rows = (await db.all(sql`
      SELECT rowid AS id
      FROM articles_fts
      WHERE articles_fts MATCH ${match}
      ORDER BY bm25(articles_fts)
      LIMIT ${limit}
    `)) as { id: number }[];
    return rows.map((r) => r.id);
  } catch {
    return []; // malformed expression → caller falls back to lexical scan
  }
}
