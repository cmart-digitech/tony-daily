import { describe, expect, it } from "vitest";
import { cleanVideoDescription } from "@/lib/ingest";
import { SOURCES } from "@/lib/sources/registry";

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
    const rthkText = SOURCES.find((s) => s.id === "rthk-en-local")!;
    const rthkVideo = SOURCES.find((s) => s.id === "yt-rthk")!;
    expect(rthkVideo.authority).toBe(rthkText.authority);
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
