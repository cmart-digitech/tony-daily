import { describe, expect, it } from "vitest";
import { rankVoices, scoreVoice, speechText } from "@/lib/voice/tts";

/** Minimal stand-in for SpeechSynthesisVoice — only the fields we rank on. */
const v = (name: string, lang: string, localService = true) => ({ name, lang, localService });

describe("voice ranking", () => {
  it("prefers a neural voice over the legacy SAPI one Windows lists first", () => {
    // The real Windows list, in the real order. Taking voices[0] — what this
    // used to do — picks David, which is the robot sound being complained about.
    const voices = [
      v("Microsoft David - English (United States)", "en-US"),
      v("Microsoft Mark - English (United States)", "en-US"),
      v("Microsoft Zira - English (United States)", "en-US"),
      v("Microsoft Ava Online (Natural) - English (United States)", "en-US", false),
    ];
    expect(rankVoices(voices, "en-US")[0].name).toMatch(/Natural/);
  });

  it("ranks Apple's premium voices above the compact ones", () => {
    const voices = [v("Daniel (Compact)", "en-GB"), v("Samantha", "en-US")];
    expect(rankVoices(voices, "en")[0].name).toBe("Samantha");
  });

  it("puts a Cantonese voice first for zh-HK, not another Chinese variant", () => {
    const voices = [
      v("Microsoft Yaoyao - Chinese (Simplified)", "zh-CN"),
      v("Microsoft HiuGaai Online (Natural) - Chinese (Hong Kong)", "zh-HK", false),
      v("Microsoft Yunxi - Chinese (Simplified)", "zh-CN"),
    ];
    const ranked = rankVoices(voices, "zh-HK");
    expect(ranked[0].lang).toBe("zh-HK");
    expect(ranked[0].name).toMatch(/HiuGaai/);
  });

  it("still returns something when only legacy voices are installed", () => {
    const voices = [v("Microsoft David - English (United States)", "en-US")];
    expect(rankVoices(voices, "en-US")).toHaveLength(1);
  });

  it("returns nothing for a language with no installed voice", () => {
    expect(rankVoices([v("Microsoft David", "en-US")], "zh-HK")).toEqual([]);
  });

  it("is stable, so playback does not change between runs", () => {
    const voices = [v("Alpha", "en-US"), v("Bravo", "en-US")];
    expect(rankVoices(voices, "en").map((x) => x.name)).toEqual(
      rankVoices([...voices].reverse(), "en").map((x) => x.name),
    );
  });

  it("scores a natural voice above a known-robotic one", () => {
    expect(scoreVoice(v("Ava Online (Natural)", "en-US", false))).toBeGreaterThan(
      scoreVoice(v("Microsoft David Desktop", "en-US")),
    );
  });
});

describe("speechText — read it the way a person would say it", () => {
  it("moves currency symbols after the amount", () => {
    expect(speechText("The flat sold for HK$81.2 million.")).toBe(
      "The flat sold for 81.2 million Hong Kong dollars.",
    );
    expect(speechText("Nvidia will pay US$12.9 billion.")).toBe(
      "Nvidia will pay 12.9 billion US dollars.",
    );
  });

  it("expands abbreviated scales", () => {
    expect(speechText("a US$12.9b deal")).toBe("a 12.9 billion US dollars deal");
  });

  it("speaks percentages as words", () => {
    expect(speechText("Shares fell 3.5%.")).toBe("Shares fell 3.5 percent.");
    expect(speechText("down 4 per cent")).toBe("down 4 percent");
  });

  it("turns dashes and ellipses into pauses, not spoken characters", () => {
    expect(speechText("Hong Kong — the market — reopened")).toBe(
      "Hong Kong, the market, reopened",
    );
  });

  it("strips markdown that slipped through", () => {
    expect(speechText("**Property** rose")).toBe("Property rose");
  });

  it("leaves Chinese currency alone but still cleans symbols", () => {
    // The English rewrites must not fire on Chinese text.
    expect(speechText("**樓價**上升 3.5%", "zh-HK")).toBe("樓價上升 3.5%");
  });

  it("does not alter ordinary prose", () => {
    const plain = "Lawmakers flagged gaps in the proposed building rules.";
    expect(speechText(plain)).toBe(plain);
  });
});
