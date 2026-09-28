/**
 * Dale: the talking loop and the way he speaks (docs/PHASE_4_PLAN.md).
 */
import { describe, expect, it, vi } from "vitest";
import {
  detectLanguageCommand,
  languageSwitchReply,
  recognitionLanguage,
  spokenAnswerRules,
} from "@/lib/ai/persona";
import { DaleSession, micIsOpen, nextState, type DaleState } from "@/lib/voice/session";
import type { SpeechRecognitionProvider, SpeechSession } from "@/lib/voice/speech";
import { speechText, toSegments } from "@/lib/voice/tts";
import type { SpeakHandle, TextToSpeechProvider } from "@/lib/voice/tts";

describe("the talking loop", () => {
  const solo = { conversation: false };
  const chat = { conversation: true };

  it("opens the microphone only on a deliberate start", () => {
    expect(nextState("idle", { type: "heard" }, solo)).toBe("idle");
    expect(nextState("idle", { type: "answer" }, solo)).toBe("idle");
    expect(nextState("idle", { type: "start" }, solo)).toBe("listening");
  });

  it("runs a whole turn and closes the microphone at the end", () => {
    let s: DaleState = "idle";
    for (const e of [{ type: "start" }, { type: "heard" }, { type: "answer" }, { type: "spoken" }] as const) {
      s = nextState(s, e, solo);
    }
    expect(s).toBe("idle");
  });

  it("reopens the microphone after speaking in conversation mode", () => {
    expect(nextState("speaking", { type: "spoken" }, chat)).toBe("listening");
    expect(nextState("speaking", { type: "spoken" }, solo)).toBe("idle");
  });

  it("stops mid-sentence when the reader speaks", () => {
    expect(nextState("speaking", { type: "interrupt" }, solo)).toBe("listening");
  });

  it("treats a second press as cancel, never as a restart", () => {
    expect(nextState("listening", { type: "start" }, solo)).toBe("idle");
    expect(nextState("speaking", { type: "start" }, solo)).toBe("idle");
  });

  it("never speaks before the grounded answer exists", () => {
    expect(nextState("thinking", { type: "spoken" }, solo)).toBe("thinking");
    expect(nextState("thinking", { type: "interrupt" }, solo)).toBe("thinking");
    expect(nextState("thinking", { type: "answer" }, solo)).toBe("speaking");
  });

  it("returns to idle from any state on stop or failure", () => {
    for (const state of ["idle", "listening", "thinking", "speaking"] as DaleState[]) {
      expect(nextState(state, { type: "stop" }, chat), state).toBe("idle");
      expect(nextState(state, { type: "error" }, chat), state).toBe("idle");
    }
  });

  it("says the microphone is open only while listening", () => {
    expect(micIsOpen("listening")).toBe(true);
    for (const s of ["idle", "thinking", "speaking"] as DaleState[]) expect(micIsOpen(s)).toBe(false);
  });
});

/** Fakes standing in for the browser's recogniser and voice. */
function fakes() {
  let onFinal: (t: string) => void = () => {};
  let onSpeechEnd: () => void = () => {};
  const cancel = vi.fn();
  const stopSpeaking = vi.fn();
  const speech: SpeechRecognitionProvider = {
    id: "fake",
    supported: () => true,
    supportedLanguages: () => [{ code: "en-US", label: "EN" }],
    start: (o) => {
      onFinal = o.onFinal;
      return { stop: () => {}, cancel } as SpeechSession;
    },
  };
  const tts: TextToSpeechProvider = {
    id: "fake",
    supported: () => true,
    speak: (o) => {
      onSpeechEnd = () => o.onEnd?.();
      return { pause: () => {}, resume: () => {}, stop: stopSpeaking } as SpeakHandle;
    },
  };
  return { speech, tts, hear: (t: string) => onFinal(t), finishSpeaking: () => onSpeechEnd(), cancel, stopSpeaking };
}

describe("DaleSession", () => {
  it("carries a question through the loop and back to idle", () => {
    const f = fakes();
    const onQuestion = vi.fn();
    const dale = new DaleSession(f, { onQuestion }, { conversation: false, language: "en" });
    dale.listen();
    expect(dale.current).toBe("listening");
    f.hear("What happened to the Hang Seng today?");
    expect(onQuestion).toHaveBeenCalledWith("What happened to the Hang Seng today?");
    expect(dale.current).toBe("thinking");
    dale.say([{ text: "It closed down two per cent.", lang: "en-US" }]);
    expect(dale.current).toBe("speaking");
    f.finishSpeaking();
    expect(dale.current).toBe("idle");
  });

  it("keeps listening after answering in conversation mode", () => {
    const f = fakes();
    const dale = new DaleSession(f, {}, { conversation: true, language: "en" });
    dale.listen();
    f.hear("And property?");
    dale.say([{ text: "Developers led the fall.", lang: "en-US" }]);
    f.finishSpeaking();
    expect(dale.current).toBe("listening");
  });

  it("treats a language instruction as an instruction, not a question", () => {
    const f = fakes();
    const onQuestion = vi.fn();
    const onLanguage = vi.fn();
    const dale = new DaleSession(f, { onQuestion, onLanguage }, { conversation: false, language: "en" });
    dale.listen();
    f.hear("speak Cantonese");
    expect(onLanguage).toHaveBeenCalledWith("zh-HK");
    expect(onQuestion).not.toHaveBeenCalled();
    expect(dale.current).toBe("idle");
  });

  it("stops talking the moment it is interrupted", () => {
    const f = fakes();
    const dale = new DaleSession(f, {}, { conversation: true, language: "en" });
    dale.listen();
    f.hear("Read me the property news.");
    dale.say([{ text: "A long answer that will be cut off.", lang: "en-US" }]);
    dale.interrupt();
    expect(f.stopSpeaking).toHaveBeenCalled();
    expect(dale.current).toBe("listening");
  });

  it("never strands the loop in thinking when the answer fails", () => {
    const f = fakes();
    const onError = vi.fn();
    const dale = new DaleSession(f, { onError }, { conversation: true, language: "en" });
    dale.listen();
    f.hear("What's in the news?");
    dale.failed("AI quota reached for now.");
    expect(onError).toHaveBeenCalled();
    expect(dale.current).toBe("idle");
  });

  it("closes the microphone when stopped", () => {
    const f = fakes();
    const dale = new DaleSession(f, {}, { conversation: true, language: "en" });
    dale.listen();
    dale.stop();
    expect(f.cancel).toHaveBeenCalled();
    expect(dale.current).toBe("idle");
  });
});

describe("language commands", () => {
  it("switches when asked, in either language", () => {
    expect(detectLanguageCommand("in Cantonese")).toBe("zh-HK");
    expect(detectLanguageCommand("speak Cantonese please")).toBe("zh-HK");
    expect(detectLanguageCommand("講廣東話")).toBe("zh-HK");
    expect(detectLanguageCommand("用中文")).toBe("zh-HK");
    expect(detectLanguageCommand("switch to English")).toBe("en");
    expect(detectLanguageCommand("講返英文")).toBe("en");
    expect(detectLanguageCommand("bilingual")).toBe("both");
    expect(detectLanguageCommand("雙語")).toBe("both");
  });

  it("does not mistake a question about a language for an instruction", () => {
    // The trap: a news question that merely contains a language word.
    expect(
      detectLanguageCommand("What did the review of that Cantonese opera at the Xiqu Centre say?"),
    ).toBeNull();
    expect(detectLanguageCommand("How many English buyers are in the Hong Kong market now?")).toBeNull();
    expect(detectLanguageCommand("廣東話流行曲喺香港嘅市場有幾大？")).toBeNull();
    expect(detectLanguageCommand("")).toBeNull();
    expect(detectLanguageCommand("What's important today?")).toBeNull();
  });

  it("answers the switch in the language it switched to", () => {
    expect(languageSwitchReply("zh-HK")).toMatch(/廣東話/);
    expect(languageSwitchReply("en")).toMatch(/English/i);
    expect(languageSwitchReply("both")).toMatch(/中文/);
  });

  it("points the recogniser at the right language", () => {
    expect(recognitionLanguage("zh-HK")).toBe("yue-Hant-HK");
    expect(recognitionLanguage("en")).toBe("en-US");
    expect(recognitionLanguage("both")).toBe("en-US");
  });
});

describe("how Dale speaks", () => {
  it("asks for a short answer, spoken, with the publisher named aloud", () => {
    const rules = spokenAnswerRules("en");
    expect(rules).toMatch(/two or three sentences/i);
    expect(rules).toMatch(/sixty spoken words/i);
    expect(rules).toMatch(/no Markdown/i);
    expect(rules).toMatch(/never say you are human/i);
    expect(rules).toMatch(/name the publisher/i);
  });

  it("keeps the citation markers, because the screen still needs its sources", () => {
    // They are stripped from the audio by speechText, not from the answer.
    expect(spokenAnswerRules("en")).toMatch(/KEEP the \[n\] citation markers/);
  });

  it("names the language it must answer in", () => {
    expect(spokenAnswerRules("zh-HK")).toMatch(/Traditional Chinese/);
    expect(spokenAnswerRules("en")).toMatch(/Answer in English/);
    expect(spokenAnswerRules("both")).toMatch(/then the same answer in Traditional Chinese/);
  });

  it("keeps the refusal rule that the written answers use", () => {
    expect(spokenAnswerRules("en")).toMatch(/if the sources do not cover it/i);
  });
});

describe("speaking a bilingual answer", () => {
  it("keeps each language with its own voice", () => {
    const segments = toSegments("The Hang Seng closed down two per cent. 恒指今日收市跌百分之二。");
    expect(segments.map((s) => s.lang)).toEqual(["en-US", "zh-HK"]);
    expect(segments[0].text).toMatch(/Hang Seng/);
    expect(segments[1].text).toMatch(/恒指/);
  });

  it("keeps a single-language answer in one piece", () => {
    const segments = toSegments("Developers led the decline. Property was the weakest sector.");
    expect(segments).toHaveLength(1);
    expect(segments[0].lang).toBe("en-US");
  });

  it("returns nothing for empty text", () => {
    expect(toSegments("   ")).toEqual([]);
  });
});

describe("what reaches the ear versus the screen", () => {
  it("never speaks a citation marker", () => {
    const spoken = speechText("Prices rose four per cent [1]. The Post says more [2, 3].", "en");
    expect(spoken).not.toMatch(/\[\d/);
    expect(spoken).toMatch(/Prices rose four percent\./);
  });

  it("leaves the written answer, and so its sources, untouched", () => {
    // Dale keeps the markers in the text so the panel can list the sources.
    const written = "Prices rose four per cent [1].";
    expect(written).toMatch(/\[1\]/);
    expect(toSegments(written)[0].text).toBe(written);
  });
});
