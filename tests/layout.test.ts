import { describe, expect, it } from "vitest";
import { hasImage, imageFirst, pickLead } from "@/lib/layout";
import type { ArticleRow } from "@/lib/retrieval";

/** Minimal article rows; only the fields the layout helpers read matter. */
function article(id: number, score: number, imageUrl: string | null): ArticleRow {
  return {
    id,
    sourceId: "rthk-en-local",
    canonicalUrl: `https://example.test/${id}`,
    originalTitle: `Story ${id}`,
    originalLanguage: "en",
    excerpt: null,
    author: null,
    publishedAt: null,
    fetchedAt: 0,
    imageUrl,
    imageAttribution: null,
    contentHash: `h${id}`,
    verificationStatus: "SINGLE_SOURCE",
    category: "general",
    region: "hk",
    clusterId: null,
    score,
  } as ArticleRow;
}

const IMG = "https://cdn.test/photo.jpg";

describe("hasImage", () => {
  it("recognises a real image", () => {
    expect(hasImage(article(1, 90, IMG))).toBe(true);
  });
  it("treats a missing image as absent", () => {
    expect(hasImage(article(1, 90, null))).toBe(false);
  });
});

describe("imageFirst", () => {
  it("moves text-only stories after illustrated ones", () => {
    const ordered = imageFirst([
      article(1, 90, null),
      article(2, 80, IMG),
      article(3, 70, null),
      article(4, 60, IMG),
    ]);
    expect(ordered.map((a) => a.id)).toEqual([2, 4, 1, 3]);
  });

  it("preserves ranked order within each group", () => {
    const ordered = imageFirst([
      article(1, 99, IMG),
      article(2, 88, IMG),
      article(3, 77, null),
      article(4, 66, null),
    ]);
    expect(ordered.map((a) => a.id)).toEqual([1, 2, 3, 4]);
  });

  it("never drops or duplicates a story", () => {
    const input = [
      article(1, 90, null),
      article(2, 80, IMG),
      article(3, 70, null),
    ];
    const ordered = imageFirst(input);
    expect(ordered).toHaveLength(input.length);
    expect(new Set(ordered.map((a) => a.id))).toEqual(new Set([1, 2, 3]));
  });

  it("is a no-op when every story is illustrated", () => {
    const input = [article(1, 90, IMG), article(2, 80, IMG)];
    expect(imageFirst(input).map((a) => a.id)).toEqual([1, 2]);
  });

  it("handles an empty list", () => {
    expect(imageFirst([])).toEqual([]);
  });
});

describe("pickLead", () => {
  it("leads with the best-ranked illustrated story", () => {
    const lead = pickLead([
      article(1, 90, null),
      article(2, 85, IMG),
      article(3, 80, IMG),
    ]);
    expect(lead?.id).toBe(2);
  });

  it("does not reach past the window for a photograph", () => {
    // The only illustrated story is far down the ranking, so the top story
    // leads without a picture rather than promoting a minor item.
    const articles = [
      article(1, 99, null),
      article(2, 90, null),
      article(3, 80, null),
      article(4, 70, null),
      article(5, 60, null),
      article(6, 10, IMG),
    ];
    expect(pickLead(articles)?.id).toBe(1);
  });

  it("leads with the top story when nothing has an image", () => {
    expect(pickLead([article(1, 90, null), article(2, 80, null)])?.id).toBe(1);
  });

  it("returns undefined for an empty list", () => {
    expect(pickLead([])).toBeUndefined();
  });
});
