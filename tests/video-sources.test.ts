import { describe, expect, it } from "vitest";
import {
  VIDEO_MAX_AGE_MS,
  classifiableText,
  cleanVideoDescription,
  isTooOldForVideo,
} from "@/lib/ingest";
import { classifyCategory } from "@/lib/ingest/classify";
import { SOURCES, getSource } from "@/lib/sources/registry";

const videoSources = SOURCES.filter((s) => s.type === "youtube");

describe("video source registry", () => {
  it("carries both Hong Kong and international channels", () => {
    expect(videoSources.length).toBeGreaterThanOrEqual(8);
    expect(videoSources.some((s) => s.region === "hk")).toBe(true);
    expect(videoSources.some((s) => s.region === "global")).toBe(true);
  });

  it("points every channel at a real channel_id feed", () => {
    for (const s of videoSources) {
      // A guessed or handle-based URL would silently return nothing; the
      // channel id is what was actually resolved and verified.
      expect(s.feedUrl, s.id).toMatch(
        /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC[A-Za-z0-9_-]{22}$/,
      );
    }
  });

  it("never marks a video channel as a primary evidence source", () => {
    // Video is not citable evidence — see docs/VIDEO_POLICY.md — so no
    // video channel may claim the status that outranks commentary.
    for (const s of videoSources) expect(s.primary, s.id).toBe(false);
  });

  it("keeps video authority in line with the same publisher's text feed", () => {
    // Video must compete on the same terms, never promoted for being video.
    // The audit found SCMP video at 85 against SCMP text at 82.
    const pairs: [video: string, text: string][] = [
      ["yt-rthk", "rthk-en-local"],
      ["yt-scmp", "scmp-hk"],
      ["yt-bbc-news", "bbc-business"],
      ["yt-dezeen", "dezeen"],
      ["yt-archdaily", "archdaily"],
    ];
    for (const [video, text] of pairs) {
      const v = SOURCES.find((s) => s.id === video)!;
      const t = SOURCES.find((s) => s.id === text)!;
      expect(v.authority, `${video} vs ${text}`).toBe(t.authority);
    }
  });

  it("never lets a video channel outrank the broadcasters' own text feeds", () => {
    const topMediaText = Math.max(
      ...SOURCES.filter((s) => s.type === "rss" && !s.primary).map((s) => s.authority),
    );
    for (const s of videoSources) {
      expect(s.authority, s.id).toBeLessThanOrEqual(topMediaText);
    }
  });

  it("no longer carries the two channels the audit found were the wrong ones", () => {
    // UCnwaU7j34C92ywMHXJahHRA is NOW (@NOWTV), a UK entertainment service;
    // UCezZxnyyvF9Yv3qqfM1Gn7A is @SCMPtv, unrelated and silent since 2017.
    const feeds = videoSources.map((s) => s.feedUrl).join(" ");
    expect(feeds).not.toContain("UCnwaU7j34C92ywMHXJahHRA");
    expect(feeds).not.toContain("UCezZxnyyvF9Yv3qqfM1Gn7A");
  });

  it("records the channel known to block off-site playback", () => {
    // Verified in the running app: RTHK's embed returns "Playback on other
    // websites has been disabled by the video owner", so it is linked to
    // rather than framed.
    expect(SOURCES.find((s) => s.id === "yt-rthk")!.embeddable).toBe(false);
  });

  it("gives every video source a distinct channel", () => {
    const ids = videoSources.map((s) => s.feedUrl);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("cleanVideoDescription", () => {
  it("keeps the part that describes the story", () => {
    const raw = "Saudi Arabia has closed a critical oil pipeline after an attack.";
    expect(cleanVideoDescription(raw)).toBe(raw);
  });

  it("drops the boilerplate footer channels append", () => {
    // The real shape of an RTHK description.
    const raw = [
      "蔡若蓮：冀教師推動人工智能賦能教學",
      "--------------------------------------------------",
      "緊貼香港電台新聞最新報道",
      "網頁: https://news.rthk.hk/rthk/ch/",
      "Facebook: https://www.facebook.com/RTHKVNEWS",
      "",
      "#香港電台 #RTHK",
    ].join("\n");
    const out = cleanVideoDescription(raw);
    expect(out).toBe("蔡若蓮：冀教師推動人工智能賦能教學");
    expect(out).not.toMatch(/facebook|rthk\.hk|#/i);
  });

  it("cuts at a bare link on its own line", () => {
    const raw = "Markets fell sharply today.\nhttps://example.com/subscribe";
    expect(cleanVideoDescription(raw)).toBe("Markets fell sharply today.");
  });

  it("cuts at a social handle line without a dash rule", () => {
    const raw = "The council approved the plan.\nInstagram: @somechannel";
    expect(cleanVideoDescription(raw)).toBe("The council approved the plan.");
  });

  it("strips trailing hashtags", () => {
    expect(cleanVideoDescription("Oil prices slipped. #oil #markets")).toBe("Oil prices slipped.");
  });

  it("survives an empty or whitespace description", () => {
    expect(cleanVideoDescription("")).toBe("");
    expect(cleanVideoDescription("   \n  ")).toBe("");
  });

  it("caps a very long description", () => {
    expect(cleanVideoDescription("x".repeat(900)).length).toBeLessThanOrEqual(500);
  });
});

describe("isTooOldForVideo", () => {
  const now = 1_800_000_000_000;

  it("keeps a video from this week", () => {
    expect(isTooOldForVideo(now - 2 * 24 * 60 * 60 * 1000, now)).toBe(false);
  });

  it("drops a clip older than the limit", () => {
    // A quiet channel's feed still lists its last 15 uploads, however old.
    expect(isTooOldForVideo(now - VIDEO_MAX_AGE_MS - 1, now)).toBe(true);
  });

  it("drops a video that carries no date", () => {
    expect(isTooOldForVideo(null, now)).toBe(true);
  });
});

describe("classifiableText", () => {
  const video = getSource("yt-reuters")!;
  const article = getSource("rthk-en-local")!;

  it("classifies video by its title alone", () => {
    expect(classifiableText("Fashion week opens", "Subscribe for more", video)).toBe(
      "Fashion week opens",
    );
  });

  it("still classifies articles by title and excerpt", () => {
    expect(classifiableText("Council meets", "on the housing plan", article)).toBe(
      "Council meets on the housing plan",
    );
  });

  it("keeps promotional description copy from moving a video onto a beat", () => {
    // Modelled on the 15 Sept audit, where this Reuters clip was filed
    // under Infrastructure because of words in its channel description.
    const title = "Christian Siriano creates romantic fantasy at NYFW";
    const description =
      "Designer Christian Siriano unveiled his collection. Reuters construction bridge infrastructure coverage";
    // The description alone would drag it there...
    expect(classifyCategory(`${title} ${description}`, video)).toBe("infrastructure");
    // ...and classifying by title keeps it off the beat.
    expect(classifyCategory(classifiableText(title, description, video), video)).not.toBe(
      "infrastructure",
    );
  });
});
