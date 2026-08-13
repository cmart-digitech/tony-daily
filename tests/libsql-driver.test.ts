/**
 * Exercises the hosted-database code path (libSQL / Turso) that cloud
 * deployments use, via libSQL's local `file:` protocol. Without this, the
 * Turso path would only ever be typechecked, never run.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tonydaily-libsql-"));
// A file: URL makes @libsql/client run locally with the same driver and
// SQL dialect it uses against hosted Turso.
process.env.TURSO_DATABASE_URL = `file:${path.join(tmpDir, "turso.db").replace(/\\/g, "/")}`;
delete process.env.TURSO_AUTH_TOKEN;

const { getDb, schema } = await import("@/lib/db");
const { savePreferences, getPreferences } = await import("@/lib/prefs");
const { clusterRecentArticles, applyCorroboration } = await import("@/lib/ingest");

beforeAll(async () => {
  await getDb();
});

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

describe("libSQL driver (hosted-database path)", () => {
  it("migrates its schema on first connection", async () => {
    const db = await getDb();
    // Every table the app relies on must exist after bootstrap.
    await expect(db.select().from(schema.articles).all()).resolves.toEqual([]);
    await expect(db.select().from(schema.watchlistItems).all()).resolves.toEqual([]);
    await expect(db.select().from(schema.dailyBriefs).all()).resolves.toEqual([]);
    await expect(db.select().from(schema.syncLogs).all()).resolves.toEqual([]);
  });

  it("round-trips preferences", async () => {
    await savePreferences({ onboarded: true, language: "zh", briefingTime: "06:30" });
    const prefs = await getPreferences();
    expect(prefs.onboarded).toBe(true);
    expect(prefs.language).toBe("zh");
    expect(prefs.briefingTime).toBe("06:30");
    // A partial update must not wipe unrelated stored settings.
    await savePreferences({ theme: "dark" });
    const after = await getPreferences();
    expect(after.theme).toBe("dark");
    expect(after.language).toBe("zh");
  });

  it("inserts articles and returns usable row ids", async () => {
    const db = await getDb();
    const res = await db
      .insert(schema.articles)
      .values({
        sourceId: "hkgov-en-top",
        canonicalUrl: "https://example.com/libsql-1",
        originalTitle: "Building laws consultation begins",
        originalLanguage: "en",
        fetchedAt: Date.now(),
        publishedAt: Date.now(),
        contentHash: "libsql-hash-1",
        verificationStatus: "PRIMARY_VERIFIED",
      })
      .run();
    const id = Number(res.lastInsertRowid);
    expect(id).toBeGreaterThan(0);
    const rows = await db.select().from(schema.articles).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].originalTitle).toBe("Building laws consultation begins");
  });

  it("enforces the URL uniqueness constraint used for deduplication", async () => {
    const db = await getDb();
    await expect(
      db
        .insert(schema.articles)
        .values({
          sourceId: "rthk-en-local",
          canonicalUrl: "https://example.com/libsql-1", // duplicate
          originalTitle: "Something else",
          originalLanguage: "en",
          fetchedAt: Date.now(),
          contentHash: "libsql-hash-distinct",
        })
        .run(),
    ).rejects.toThrow();
  });

  it("runs clustering and corroboration through the hosted driver", async () => {
    const db = await getDb();
    await db
      .insert(schema.articles)
      .values({
        sourceId: "rthk-en-local",
        canonicalUrl: "https://example.com/libsql-2",
        originalTitle: "Consultation on building management law reform begins",
        originalLanguage: "en",
        fetchedAt: Date.now(),
        publishedAt: Date.now(),
        contentHash: "libsql-hash-2",
        verificationStatus: "SINGLE_SOURCE",
      })
      .run();

    await clusterRecentArticles();
    await applyCorroboration();

    const rows = await db.select().from(schema.articles).all();
    const clustered = rows.filter((r) => r.clusterId != null);
    expect(clustered).toHaveLength(2);
    expect(clustered[0].clusterId).toBe(clustered[1].clusterId);
    // The government item stays PRIMARY_VERIFIED; the media item is upgraded.
    const media = rows.find((r) => r.sourceId === "rthk-en-local")!;
    expect(media.verificationStatus).toBe("CORROBORATED");
    const gov = rows.find((r) => r.sourceId === "hkgov-en-top")!;
    expect(gov.verificationStatus).toBe("PRIMARY_VERIFIED");
  });
});
