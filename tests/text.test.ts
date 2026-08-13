import { describe, expect, it } from "vitest";
import {
  buildIdf,
  canonicalizeUrl,
  contentHash,
  MIN_SHARED_TOKENS,
  normalizeTitle,
  stripHtml,
  titleSimilarity,
  tokenize,
  weightedSimilarity,
} from "@/lib/ingest/text";

describe("stripHtml", () => {
  it("removes tags and entities", () => {
    expect(stripHtml("<p>Hello &amp; <b>world</b></p>")).toBe("Hello & world");
  });
  it("handles Chinese content", () => {
    expect(stripHtml("<div>恒指升逾百點</div>")).toBe("恒指升逾百點");
  });
  it("drops scripts", () => {
    expect(stripHtml("<script>alert(1)</script>News")).toBe("News");
  });
});

describe("normalizeTitle", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeTitle("Hong Kong's stocks RISE!")).toBe("hong kongs stocks rise");
  });
});

describe("titleSimilarity", () => {
  it("scores near-identical English headlines highly", () => {
    const a = "Hong Kong residential transactions rise 12% in July";
    const b = "Residential transactions in Hong Kong rise 12 per cent in July";
    expect(titleSimilarity(a, b)).toBeGreaterThan(0.4);
  });
  it("scores unrelated headlines low", () => {
    const a = "Tencent quarterly earnings beat expectations";
    const b = "New museum pavilion opens in Kowloon park";
    expect(titleSimilarity(a, b)).toBeLessThan(0.15);
  });
  it("handles Chinese headlines via bigrams", () => {
    const a = "啟德體育園正式開幕";
    const b = "啟德體育園今日正式開幕啦";
    expect(titleSimilarity(a, b)).toBeGreaterThan(0.4);
  });
  it("returns 0 for empty strings", () => {
    expect(titleSimilarity("", "anything here")).toBe(0);
  });
});

describe("tokenize", () => {
  it("uses character bigrams for CJK", () => {
    expect(tokenize("恒指升")).toEqual(["恒指", "指升"]);
  });
});

describe("weightedSimilarity", () => {
  // A corpus resembling the live index: lots of Hong Kong stories, so
  // "hong"/"kong" carry little information while event words carry a lot.
  const corpus = [
    "Hong Kong stocks finish Wednesday lower",
    "Hong Kong leader announces new policy address",
    "Hong Kong property market shows signs of recovery",
    "Hong Kong to publish five-year plan in September",
    "New Hong Kong trade office opens in Malaysia",
    "Hong Kong weather warning issued for the weekend",
    "Building laws consultation begins",
    "Consultation on building management law reform begins",
    "Man injured in Sai Kung fish farm fire",
    "Man injured as fire engulfs 2 huts, 4 speedboats at village in Sai Kung",
    "E-consent launched for school jabs",
    "Hong Kong rolls out online consent forms for children's school flu jabs",
    "How Hong Kong developers are adapting to the new normal in the Greater Bay Area",
    "The Global Story",
  ];
  const idf = buildIdf(corpus);
  const CLUSTER_THRESHOLD = 0.62;

  it("matches the same event written at very different lengths", () => {
    // Plain Jaccard scores this pair only ~0.43 — below any safe cutoff.
    const v = weightedSimilarity(
      "Building laws consultation begins",
      "Consultation on building management law reform begins",
      idf,
    );
    expect(v.score).toBeGreaterThanOrEqual(CLUSTER_THRESHOLD);
    expect(v.sharedTokens).toBeGreaterThanOrEqual(MIN_SHARED_TOKENS);
  });

  it("matches a terse government headline against verbose media coverage", () => {
    const v = weightedSimilarity(
      "E-consent launched for school jabs",
      "Hong Kong rolls out online consent forms for children's school flu jabs",
      idf,
    );
    expect(v.score).toBeGreaterThanOrEqual(CLUSTER_THRESHOLD);
  });

  it("matches two reports of the same incident", () => {
    const v = weightedSimilarity(
      "Man injured in Sai Kung fish farm fire",
      "Man injured as fire engulfs 2 huts, 4 speedboats at village in Sai Kung",
      idf,
    );
    expect(v.score).toBeGreaterThanOrEqual(CLUSTER_THRESHOLD);
  });

  it("does not match unrelated stories that share only generic geography", () => {
    const v = weightedSimilarity(
      "New Hong Kong trade office opens in Malaysia",
      "How Hong Kong developers are adapting to the new normal in the Greater Bay Area",
      idf,
    );
    expect(v.score).toBeLessThan(CLUSTER_THRESHOLD);
  });

  it("does not match a stub headline against a real story", () => {
    // Short generic titles inflate containment; the shared-token floor
    // is what rejects them.
    const v = weightedSimilarity(
      "The Global Story",
      "Hong Kong property market shows signs of recovery",
      idf,
    );
    expect(
      v.score < CLUSTER_THRESHOLD || v.sharedTokens < MIN_SHARED_TOKENS,
    ).toBe(true);
  });

  it("scores identical headlines at 1", () => {
    const v = weightedSimilarity(
      "Hong Kong stocks finish Wednesday lower",
      "Hong Kong stocks finish Wednesday lower",
      idf,
    );
    expect(v.score).toBeCloseTo(1, 5);
  });

  it("returns zero for an empty headline", () => {
    expect(weightedSimilarity("", "Hong Kong stocks finish lower", idf).score).toBe(0);
  });
});

describe("canonicalizeUrl", () => {
  it("removes tracking params and fragments", () => {
    expect(
      canonicalizeUrl("https://example.com/story?utm_source=x&id=1#section"),
    ).toBe("https://example.com/story?id=1");
  });
  it("keeps malformed input unchanged", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
  });
});

describe("contentHash", () => {
  it("is stable and ignores null parts", () => {
    expect(contentHash(["a", null, "b"])).toBe(contentHash(["a", "b"]));
  });
  it("differs for different content", () => {
    expect(contentHash(["a"])).not.toBe(contentHash(["b"]));
  });
});
