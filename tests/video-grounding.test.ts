/**
 * Video is never evidence (docs/VIDEO_POLICY.md). These guard the places the
 * AI is handed stories, and the brief's cap on video per section.
 */
import { describe, expect, it } from "vitest";
import { MAX_VIDEOS_PER_SECTION, pickSection } from "@/lib/brief";
import { groupVideos, videoGroupFor } from "@/lib/queries";
import {
  dedupeByClusterPreferWritten,
  groundingContext,
  isGroundable,
  type ArticleRow,
} from "@/lib/retrieval";

let nextId = 1;
function row(overrides: Partial<ArticleRow>): ArticleRow {
  const id = nextId++;
  return {
    id,
    sourceId: "rthk-en-local",
    canonicalUrl: `https://example.com/${id}`,
    originalTitle: `Story ${id}`,
    originalLanguage: "en",
    translatedTitle: null,
    videoId: null,
    videoProvider: null,
    excerpt: null,
    author: null,
    publishedAt: Date.now(),
    fetchedAt: Date.now(),
    imageUrl: null,
    imageAttribution: null,
    contentHash: `hash-${id}`,
    verificationStatus: "SINGLE_SOURCE",
    category: "general",
    region: "global",
    clusterId: null,
    score: 50,
    ...overrides,
  } as ArticleRow;
}

describe("grounding", () => {
  it("treats a written article as evidence and a video as not", () => {
    expect(isGroundable(row({}))).toBe(true);
    expect(isGroundable(row({ videoId: "abcdefghijk", sourceId: "yt-reuters" }))).toBe(false);
  });

  it("gives the AI only written reporting, in the order retrieved", () => {
    const a = row({ originalTitle: "Written one" });
    const v = row({ originalTitle: "A video", videoId: "abcdefghijk", sourceId: "yt-bbc-news" });
    const b = row({ originalTitle: "Written two" });
    const ctx = groundingContext([a, v, b]);
    expect(ctx.map((c) => c.title)).toEqual(["Written one", "Written two"]);
  });

  it("returns nothing to cite when a story exists only as video", () => {
    const v = row({ videoId: "abcdefghijk", sourceId: "yt-scmp" });
    expect(groundingContext([v])).toEqual([]);
  });
});

describe("brief section video cap", () => {
  it("lets at most one video into a section, however high videos score", () => {
    // The audit's Global section: every top-scored candidate was a clip.
    const pool = [
      row({ videoId: "v1xxxxxxxxx", score: 80, region: "global" }),
      row({ videoId: "v2xxxxxxxxx", score: 79, region: "global" }),
      row({ videoId: "v3xxxxxxxxx", score: 78, region: "global" }),
      row({ score: 70, region: "global", originalTitle: "Written" }),
    ];
    const picked = pickSection(pool, new Set(), (a) => a.region === "global", 2);
    const videos = picked.filter((id) => pool.find((a) => a.id === id)!.videoId);
    expect(MAX_VIDEOS_PER_SECTION).toBe(1);
    expect(videos).toHaveLength(1);
    // The best video still leads; the written story takes the second slot.
    expect(picked).toEqual([pool[0].id, pool[3].id]);
  });

  it("does not hold a slot empty when only videos qualify", () => {
    const pool = [
      row({ videoId: "v4xxxxxxxxx", region: "china" }),
      row({ videoId: "v5xxxxxxxxx", region: "china" }),
    ];
    const picked = pickSection(pool, new Set(), (a) => a.region === "china", 2);
    expect(picked).toEqual([pool[0].id]);
  });

  it("leaves written-only sections exactly as before", () => {
    const pool = [row({ region: "hk" }), row({ region: "hk" }), row({ region: "hk" })];
    expect(pickSection(pool, new Set(), (a) => a.region === "hk", 3)).toEqual(
      pool.map((a) => a.id),
    );
  });
});

describe("Video page shelves", () => {
  const hour = 60 * 60 * 1000;
  const now = Date.now();

  it("puts channels on the right shelf", () => {
    expect(videoGroupFor("yt-tvb-news")).toBe("hk");
    expect(videoGroupFor("yt-now-finance")).toBe("hk");
    expect(videoGroupFor("yt-reuters")).toBe("international");
    expect(videoGroupFor("yt-dezeen")).toBe("design");
  });

  it("keeps Hong Kong video visible however much the wires post", () => {
    // The audit's shape: a flood of recent wire clips, older local ones.
    const wire = Array.from({ length: 20 }, (_, i) =>
      row({ sourceId: "yt-reuters", videoId: `r${i}xxxxxxxxx`.slice(0, 11), publishedAt: now - i * 60_000 }),
    );
    const local = row({ sourceId: "yt-tvb-news", videoId: "tvbxxxxxxxx", publishedAt: now - 10 * hour });
    const shelves = groupVideos([...wire, local]);
    expect(shelves.hk.map((a) => a.id)).toEqual([local.id]);
    expect(shelves.international).toHaveLength(3); // one channel, capped
  });

  it("shows a re-uploaded clip once", () => {
    const a = row({ sourceId: "yt-reuters", videoId: "aaaaaaaaaaa", originalTitle: "ICE arrests are soaring", publishedAt: now });
    const b = row({ sourceId: "yt-reuters", videoId: "bbbbbbbbbbb", originalTitle: "ICE arrests are soaring", publishedAt: now - hour });
    expect(groupVideos([a, b]).international.map((x) => x.id)).toEqual([a.id]);
  });

  it("orders each shelf newest first and drops channels no longer registered", () => {
    const older = row({ sourceId: "yt-bbc-news", videoId: "olderxxxxxx", publishedAt: now - 2 * hour });
    const newer = row({ sourceId: "yt-bbc-news", videoId: "newerxxxxxx", publishedAt: now - hour });
    const removed = row({ sourceId: "yt-scmp-tv", videoId: "gonexxxxxxx", publishedAt: now });
    const shelves = groupVideos([older, removed, newer]);
    expect(shelves.international.map((x) => x.id)).toEqual([newer.id, older.id]);
    expect(Object.values(shelves).flat().some((x) => x.id === removed.id)).toBe(false);
  });

  it("ignores stories without a video", () => {
    expect(Object.values(groupVideos([row({})])).flat()).toEqual([]);
  });
});

describe("a cluster is represented by its written reporting", () => {
  it("keeps the written article when a video in its cluster outscores it", () => {
    // Found by review: with the video represented, the brief's video cap
    // could skip the clip and lose the story's written reporting with it.
    const clip = row({ clusterId: 7, videoId: "clipxxxxxxx", sourceId: "yt-bloomberg", score: 80 });
    const other = row({ clusterId: null, score: 75 });
    const article = row({ clusterId: 7, score: 70 });
    expect(dedupeByClusterPreferWritten([clip, other, article]).map((a) => a.id)).toEqual([
      other.id,
      article.id,
    ]);
  });

  it("falls back to the best video when a cluster has no written report", () => {
    const a = row({ clusterId: 8, videoId: "aaaaaaaaaaa", score: 80 });
    const b = row({ clusterId: 8, videoId: "bbbbbbbbbbb", score: 60 });
    expect(dedupeByClusterPreferWritten([a, b]).map((x) => x.id)).toEqual([a.id]);
  });

  it("behaves like plain cluster dedupe when there is no video", () => {
    const a = row({ clusterId: 9, score: 80 });
    const b = row({ clusterId: 9, score: 60 });
    const c = row({ clusterId: null, score: 50 });
    expect(dedupeByClusterPreferWritten([a, b, c]).map((x) => x.id)).toEqual([a.id, c.id]);
  });
});
