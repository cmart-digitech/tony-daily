/**
 * FTS5 index behaviour against a throwaway local database, exercising the
 * same code path the hosted deployment uses.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tonydaily-fts-"));
process.env.DATABASE_URL = path.join(tmpDir, "fts.db");
delete process.env.TURSO_DATABASE_URL;

const { getDb, schema } = await import("@/lib/db");
const { ftsReady, indexArticles, backfillIndex, searchIndex, toMatchExpression } =
  await import("@/lib/search/fts");
const { searchArticles } = await import("@/lib/retrieval");

async function insertArticle(id: number, title: string, excerpt: string | null = null) {
  const db = await getDb();
  await db
    .insert(schema.articles)
    .values({
      id,
      sourceId: "rthk-en-local",
      canonicalUrl: `https://example.test/${id}`,
      originalTitle: title,
      originalLanguage: "en",
      excerpt,
      fetchedAt: Date.now(),
      publishedAt: Date.now(),
      contentHash: `fts-h${id}`,
    })
    .run();
}

beforeAll(async () => {
  await getDb();
  expect(await ftsReady()).toBe(true);
});

describe("toMatchExpression", () => {
  it("quotes tokens so user input cannot break MATCH syntax", () => {
    expect(toMatchExpression("kai tak stadium")).toBe('"kai" "tak" "stadium"');
  });
  it("strips punctuation and operators", () => {
    expect(toMatchExpression('tower OR "hack) -x')).toBe('"tower" "or" "hack"');
  });
  it("routes CJK queries to the lexical path", () => {
    expect(toMatchExpression("啟德")).toBeNull();
  });
  it("returns null when nothing is searchable", () => {
    expect(toMatchExpression("a ! ?")).toBeNull();
  });
});

describe("indexing and search", () => {
  it("finds an indexed article by title terms", async () => {
    await insertArticle(1, "Kai Tak stadium roof completed ahead of schedule");
    await indexArticles([
      { id: 1, title: "Kai Tak stadium roof completed ahead of schedule", excerpt: null, entities: ["Kai Tak"] },
    ]);
    expect(await searchIndex('"stadium" "roof"', 10)).toEqual([1]);
  });

  it("matches on entities even when the title differs", async () => {
    await insertArticle(2, "Developer wins tender at record premium");
    await indexArticles([
      { id: 2, title: "Developer wins tender at record premium", excerpt: null, entities: ["Sun Hung Kai Properties", "0016.HK"] },
    ]);
    expect(await searchIndex('"hung" "kai"', 10)).toContain(2);
  });

  it("re-indexing the same article does not duplicate it", async () => {
    await indexArticles([
      { id: 1, title: "Kai Tak stadium roof completed ahead of schedule", excerpt: null, entities: [] },
    ]);
    expect(await searchIndex('"stadium"', 10)).toEqual([1]);
  });

  it("backfills articles that were inserted without indexing", async () => {
    await insertArticle(3, "Harbour reclamation consultation opens", "Public views sought.");
    const indexed = await backfillIndex();
    expect(indexed).toBeGreaterThan(0);
    expect(await searchIndex('"reclamation"', 10)).toContain(3);
  });

  it("returns empty for a query matching nothing", async () => {
    expect(await searchIndex('"zeppelin"', 10)).toEqual([]);
  });
});

describe("searchArticles integration", () => {
  it("serves Latin queries from the index", async () => {
    const hits = await searchArticles("reclamation consultation");
    expect(hits.some((h) => h.id === 3)).toBe(true);
  });

  it("still answers CJK queries via the lexical scan", async () => {
    await insertArticle(4, "啟德體育園正式開幕 大批市民入場");
    await backfillIndex();
    const hits = await searchArticles("啟德");
    expect(hits.some((h) => h.id === 4)).toBe(true);
  });
});
