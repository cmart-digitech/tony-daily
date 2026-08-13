import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/prefs";
import { scoreArticle, type ScorableArticle } from "@/lib/rank/score";

const now = Date.UTC(2026, 7, 12, 8, 0, 0);
const base: ScorableArticle = {
  category: "markets",
  region: "hk",
  authority: 90,
  publishedAt: now - 60 * 60 * 1000,
  corroborationCount: 0,
  watchlistMatch: false,
  isNovel: true,
};
const { interests, rankWeights } = DEFAULT_PREFERENCES;

describe("scoreArticle", () => {
  it("prefers fresher stories, all else equal", () => {
    const fresh = scoreArticle(base, interests, rankWeights, now);
    const old = scoreArticle(
      { ...base, publishedAt: now - 48 * 3600_000 },
      interests,
      rankWeights,
      now,
    );
    expect(fresh).toBeGreaterThan(old);
  });

  it("boosts watchlist-related stories", () => {
    const plain = scoreArticle(base, interests, rankWeights, now);
    const watch = scoreArticle({ ...base, watchlistMatch: true }, interests, rankWeights, now);
    expect(watch).toBeGreaterThan(plain);
  });

  it("ranks Hong Kong above equivalent global stories", () => {
    const hk = scoreArticle(base, interests, rankWeights, now);
    const global = scoreArticle({ ...base, region: "global" }, interests, rankWeights, now);
    expect(hk).toBeGreaterThan(global);
  });

  it("lets a much more corroborated global story outrank a weak local one", () => {
    const weakLocal = scoreArticle(
      { ...base, category: "general", authority: 50, publishedAt: now - 24 * 3600_000 },
      interests,
      rankWeights,
      now,
    );
    const majorGlobal = scoreArticle(
      { ...base, region: "global", authority: 95, corroborationCount: 3 },
      interests,
      rankWeights,
      now,
    );
    expect(majorGlobal).toBeGreaterThan(weakLocal);
  });

  it("rewards corroboration", () => {
    const single = scoreArticle(base, interests, rankWeights, now);
    const corroborated = scoreArticle(
      { ...base, corroborationCount: 2 },
      interests,
      rankWeights,
      now,
    );
    expect(corroborated).toBeGreaterThan(single);
  });

  it("handles missing publish dates without crashing", () => {
    const s = scoreArticle({ ...base, publishedAt: null }, interests, rankWeights, now);
    expect(Number.isFinite(s)).toBe(true);
  });

  it("respects user interest weighting", () => {
    const loweredMarkets = { ...interests, markets: 10 };
    const lowered = scoreArticle(base, loweredMarkets, rankWeights, now);
    const normal = scoreArticle(base, interests, rankWeights, now);
    expect(normal).toBeGreaterThan(lowered);
  });
});
