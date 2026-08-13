/**
 * Integration tests for clustering, corroboration, retrieval and the
 * factuality guard, against a throwaway SQLite database.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tonydaily-test-"));
process.env.DATABASE_URL = path.join(tmpDir, "test.db");
delete process.env.TURSO_DATABASE_URL; // force the local driver in tests

// Import AFTER the env var is set so the DB opens at the temp path.
const { getDb, schema } = await import("@/lib/db");
const { clusterRecentArticles, applyCorroboration, rescoreRecentArticles } =
  await import("@/lib/ingest");
const { searchArticles } = await import("@/lib/retrieval");
const { buildSourceBlock } = await import("@/lib/ai");

async function insertArticle(
  overrides: Partial<typeof schema.articles.$inferInsert>,
): Promise<number> {
  const db = await getDb();
  const res = await db
    .insert(schema.articles)
    .values({
      sourceId: "rthk-en-local",
      canonicalUrl: `https://example.com/${Math.random().toString(36).slice(2)}`,
      originalTitle: "placeholder",
      originalLanguage: "en",
      fetchedAt: Date.now(),
      publishedAt: Date.now(),
      contentHash: Math.random().toString(36).slice(2),
      ...overrides,
    })
    .run();
  return Number(res.lastInsertRowid);
}

beforeAll(async () => {
  await getDb(); // creates schema
});

afterAll(() => {
  // On Windows the SQLite WAL handle can outlive the suite; best-effort only.
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* leave temp dir for the OS to clean */
  }
});

describe("clustering + corroboration", () => {
  it("clusters the same story from two sources and upgrades verification", async () => {
    const a = await insertArticle({
      sourceId: "rthk-en-local",
      originalTitle: "Hong Kong residential transactions rise 12 per cent in July",
      verificationStatus: "SINGLE_SOURCE",
    });
    const b = await insertArticle({
      sourceId: "scmp-hk",
      originalTitle: "Residential transactions in Hong Kong rise 12% in July",
      verificationStatus: "SINGLE_SOURCE",
    });
    await clusterRecentArticles();
    await applyCorroboration();
    const db = await getDb();
    const rows = await db.select().from(schema.articles).all();
    const ra = rows.find((r) => r.id === a)!;
    const rb = rows.find((r) => r.id === b)!;
    expect(ra.clusterId).not.toBeNull();
    expect(ra.clusterId).toBe(rb.clusterId);
    expect(ra.verificationStatus).toBe("CORROBORATED");
    expect(rb.verificationStatus).toBe("CORROBORATED");
  });

  it("does not cluster two different stories from the same source", async () => {
    const a = await insertArticle({
      originalTitle: "Tencent earnings beat expectations in second quarter",
    });
    const b = await insertArticle({
      originalTitle: "New harbourfront park opens to the public in Central",
    });
    await clusterRecentArticles();
    const db = await getDb();
    const rows = await db.select().from(schema.articles).all();
    const ca = rows.find((r) => r.id === a)!.clusterId;
    const cb = rows.find((r) => r.id === b)!.clusterId;
    expect(ca === null || ca !== cb).toBe(true);
  });

  it("never marks a primary source down nor upgrades unclustered stories", async () => {
    const gov = await insertArticle({
      sourceId: "hkgov-en-top",
      originalTitle: "Land sale programme for the coming quarter announced today",
      verificationStatus: "PRIMARY_VERIFIED",
    });
    await clusterRecentArticles();
    await applyCorroboration();
    const db = await getDb();
    const row = (await db.select().from(schema.articles).all()).find((r) => r.id === gov)!;
    expect(row.verificationStatus).toBe("PRIMARY_VERIFIED");
  });
});

describe("rescore", () => {
  it("assigns positive scores to recent articles", async () => {
    await rescoreRecentArticles();
    const db = await getDb();
    const rows = await db.select().from(schema.articles).all();
    expect(rows.every((r) => r.score > 0)).toBe(true);
  });
});

describe("retrieval", () => {
  it("finds articles by keyword", async () => {
    const hits = await searchArticles("residential transactions July");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].originalTitle.toLowerCase()).toContain("residential");
  });

  it("returns nothing relevant for topics not in the index", async () => {
    const hits = await searchArticles("quantum submarine volcano zebra");
    // Broad fallback may return top stories, but none should literally match;
    // the grounding contract is enforced by the source block sent to the AI.
    const literal = hits.filter((h) =>
      h.originalTitle.toLowerCase().includes("zebra"),
    );
    expect(literal).toHaveLength(0);
  });
});

describe("factuality guard", () => {
  it("builds an empty source block when there is no evidence", () => {
    const { block, citations } = buildSourceBlock([]);
    expect(block).toBe("");
    expect(citations).toHaveLength(0);
  });

  it("includes verification status and publisher in the source block", () => {
    const { block } = buildSourceBlock([
      {
        id: 1,
        title: "Test story",
        excerpt: "Something happened.",
        sourceId: "rthk-en-local",
        publishedAt: Date.UTC(2026, 7, 12),
        canonicalUrl: "https://example.com/x",
        verificationStatus: "CORROBORATED",
      },
    ]);
    expect(block).toContain("RTHK");
    expect(block).toContain("CORROBORATED");
    expect(block).toContain("[1]");
  });
});
