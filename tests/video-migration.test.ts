/**
 * The Phase 3 upgrade as production will meet it: a hosted (libSQL) database
 * created before video existed, holding Tony's saved articles, opened by the
 * new code. The saves must survive, and the new columns must arrive.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { afterAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tonydaily-upgrade-"));
const url = `file:${path.join(tmpDir, "turso.db").replace(/\\/g, "/")}`;
process.env.TURSO_DATABASE_URL = url;
delete process.env.TURSO_AUTH_TOKEN;

const { getDb, schema, isDuplicateColumnError } = await import("@/lib/db");

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

async function columns(table: string): Promise<string[]> {
  const raw = createClient({ url });
  const res = await raw.execute(`PRAGMA table_info(${table})`);
  raw.close();
  return res.rows.map((r) => String(r.name));
}

describe("upgrading a pre-video production database", () => {
  it("adds the video columns and keeps every saved article", async () => {
    // Build the database as it stands on production today: the full schema,
    // minus the two columns this release adds.
    await getDb();
    const raw = createClient({ url });
    await raw.execute("ALTER TABLE articles DROP COLUMN video_provider");
    await raw.execute("ALTER TABLE articles DROP COLUMN video_id");
    await raw.execute(
      `INSERT INTO articles (source_id, canonical_url, original_title, original_language,
         fetched_at, content_hash, verification_status)
       VALUES ('rthk-en-local', 'https://example.com/saved', 'A story Tony saved', 'en', ${Date.now()}, 'h-saved', 'SINGLE_SOURCE')`,
    );
    const savedId = Number((await raw.execute("SELECT id FROM articles")).rows[0].id);
    await raw.execute(`INSERT INTO saved_articles (article_id, saved_at) VALUES (${savedId}, ${Date.now()})`);
    raw.close();
    expect(await columns("articles")).not.toContain("video_id");

    // A fresh server instance running the new code.
    globalThis.__tonyDailyDb = undefined;
    const db = await getDb();

    const cols = await columns("articles");
    expect(cols).toContain("video_id");
    expect(cols).toContain("video_provider");

    const saved = await db.select().from(schema.savedArticles).all();
    expect(saved.map((s) => s.articleId)).toEqual([savedId]);
    const article = await db.select().from(schema.articles).all();
    expect(article).toHaveLength(1);
    expect(article[0].originalTitle).toBe("A story Tony saved");
    expect(article[0].videoId).toBeNull();

    // And the new code can write a video row into the upgraded table.
    await db
      .insert(schema.articles)
      .values({
        sourceId: "yt-scmp",
        canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        originalTitle: "A video report",
        originalLanguage: "en",
        fetchedAt: Date.now(),
        contentHash: "h-video",
        videoId: "abcdefghijk",
        videoProvider: "youtube",
      })
      .run();
    expect(await db.select().from(schema.articles).all()).toHaveLength(2);
  });

  it("re-running the migration on an upgraded database is harmless", async () => {
    globalThis.__tonyDailyDb = undefined;
    const db = await getDb();
    expect(await db.select().from(schema.savedArticles).all()).toHaveLength(1);
  });
});

describe("isDuplicateColumnError", () => {
  it("recognises the error an existing column raises, from the real driver", async () => {
    const raw = createClient({ url });
    const err = await raw
      .execute("ALTER TABLE articles ADD COLUMN video_id TEXT")
      .then(() => null, (e: unknown) => e);
    raw.close();
    expect(isDuplicateColumnError(err)).toBe(true);
  });

  it("does not mistake any other failure for it", () => {
    // A dropped connection must surface, not be swallowed as "already there".
    expect(isDuplicateColumnError(new Error("fetch failed: ECONNRESET"))).toBe(false);
    expect(isDuplicateColumnError(new Error("no such table: articles"))).toBe(false);
  });
});
