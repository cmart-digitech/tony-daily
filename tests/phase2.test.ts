/**
 * Phase 2 behaviours against a throwaway database: cross-language
 * clustering via translated titles, and Telegram brief composition.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tonydaily-p2-"));
process.env.DATABASE_URL = path.join(tmpDir, "p2.db");
delete process.env.TURSO_DATABASE_URL;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;

const { getDb, schema } = await import("@/lib/db");
const { clusterRecentArticles, applyCorroboration } = await import("@/lib/ingest");
const { composeBriefMessage, telegramConfigured, sendBriefToTelegram } =
  await import("@/lib/notify/telegram");
const { factsApplicable } = await import("@/lib/ai/facts");

let nextId = 1;
async function insertArticle(overrides: Partial<typeof schema.articles.$inferInsert>) {
  const db = await getDb();
  const id = nextId++;
  await db
    .insert(schema.articles)
    .values({
      id,
      sourceId: "rthk-en-local",
      canonicalUrl: `https://example.test/p2/${id}`,
      originalTitle: "placeholder",
      originalLanguage: "en",
      fetchedAt: Date.now(),
      publishedAt: Date.now(),
      contentHash: `p2-h${id}`,
      score: 50,
      ...overrides,
    })
    .run();
  return id;
}

beforeAll(async () => {
  await getDb();
});

describe("cross-language clustering", () => {
  it("links the EN and 繁 reports of one event via the translated title", async () => {
    const en = await insertArticle({
      sourceId: "hkgov-en-top",
      originalTitle: "Building management ordinance consultation begins today",
      verificationStatus: "PRIMARY_VERIFIED",
    });
    const zh = await insertArticle({
      sourceId: "rthk-zh-local",
      originalLanguage: "zh-HK",
      originalTitle: "建築物管理條例修訂建議諮詢今日展開",
      translatedTitle: "Consultation on building management ordinance amendments begins today",
      verificationStatus: "SINGLE_SOURCE",
    });
    await clusterRecentArticles();
    await applyCorroboration();
    const db = await getDb();
    const rows = await db.select().from(schema.articles).all();
    const a = rows.find((r) => r.id === en)!;
    const b = rows.find((r) => r.id === zh)!;
    expect(a.clusterId).not.toBeNull();
    expect(a.clusterId).toBe(b.clusterId);
    expect(b.verificationStatus).toBe("CORROBORATED");
  });

  it("does not link a 繁 article that has no translation yet", async () => {
    const zh = await insertArticle({
      sourceId: "rthk-zh-finance",
      originalLanguage: "zh-HK",
      originalTitle: "港股收市升逾200點 成交增加",
      translatedTitle: null,
    });
    const en = await insertArticle({
      sourceId: "scmp-business",
      originalTitle: "Hong Kong stocks close more than 200 points higher on rising turnover",
    });
    await clusterRecentArticles();
    const db = await getDb();
    const rows = await db.select().from(schema.articles).all();
    const a = rows.find((r) => r.id === zh)!;
    const b = rows.find((r) => r.id === en)!;
    expect(a.clusterId === null || a.clusterId !== b.clusterId).toBe(true);
  });

  it("does not link unrelated stories through translation noise", async () => {
    const zh = await insertArticle({
      sourceId: "rthk-zh-local",
      originalLanguage: "zh-HK",
      originalTitle: "颱風襲港 天文台發出八號風球",
      translatedTitle: "Typhoon hits Hong Kong as observatory issues signal No 8",
    });
    const en = await insertArticle({
      sourceId: "scmp-hk",
      originalTitle: "Hong Kong airport opens new retail wing to travellers",
    });
    await clusterRecentArticles();
    const db = await getDb();
    const rows = await db.select().from(schema.articles).all();
    const a = rows.find((r) => r.id === zh)!;
    const b = rows.find((r) => r.id === en)!;
    expect(a.clusterId === null || a.clusterId !== b.clusterId).toBe(true);
  });
});

describe("telegram brief delivery", () => {
  it("reports unconfigured without credentials and never attempts a send", async () => {
    expect(telegramConfigured()).toBe(false);
    const result = await sendBriefToTelegram(
      { overview: null, overviewCitations: [], sections: [] },
      "Thursday, 13 August",
    );
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("not-configured");
  });

  it("composes real headlines with links and escaped HTML", async () => {
    const id = await insertArticle({
      originalTitle: 'Tower plan for <Central> approved & "welcomed"',
      canonicalUrl: "https://example.test/p2/html-escape",
      contentHash: "p2-esc",
    });
    const message = await composeBriefMessage(
      {
        overview: "A calm overview [1].",
        overviewCitations: [],
        sections: [{ key: "hk", articleIds: [id] }],
      },
      "Thursday, 13 August",
    );
    expect(message).toBeTruthy();
    expect(message!).toContain("TONY·DAILY");
    expect(message!).toContain("&lt;Central&gt;");
    expect(message!).toContain("&amp;");
    expect(message!).toContain('href="https://example.test/p2/html-escape"');
    expect(message!).toContain("AI-assisted overview");
    expect(message!).not.toContain("[1]"); // citation markers are dashboard UI
  });

  it("sends nothing when the brief holds no real stories", async () => {
    const message = await composeBriefMessage(
      { overview: "Text without any stories.", overviewCitations: [], sections: [] },
      "Thursday, 13 August",
    );
    expect(message).toBeNull();
  });
});

describe("structured facts applicability", () => {
  it("applies to built-environment categories only", () => {
    const base = {
      id: 1, sourceId: "s", canonicalUrl: "u", originalTitle: "t",
      originalLanguage: "en", translatedTitle: null, excerpt: null, author: null,
      publishedAt: null, fetchedAt: 0, imageUrl: null, imageAttribution: null,
      contentHash: "h", verificationStatus: "SINGLE_SOURCE", region: "hk",
      clusterId: null, score: 0,
    };
    expect(factsApplicable({ ...base, category: "property" } as never)).toBe(true);
    expect(factsApplicable({ ...base, category: "architecture" } as never)).toBe(true);
    expect(factsApplicable({ ...base, category: "infrastructure" } as never)).toBe(true);
    expect(factsApplicable({ ...base, category: "markets" } as never)).toBe(false);
    expect(factsApplicable({ ...base, category: "general" } as never)).toBe(false);
  });
});
