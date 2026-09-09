"use client";

/**
 * TextToSpeechProvider abstraction (brief §19).
 *
 * The free production path is the browser's speechSynthesis, which ships
 * Cantonese (zh-HK) and English voices on macOS, Windows, iOS and Android.
 * Audio is synthesised at playback and never stored, which keeps costs at
 * zero and sidesteps hosting copyrighted-sounding audio. A cloud TTS
 * provider can implement the same interface later (paid decision — see
 * docs/VOICE_ARCHITECTURE.md).
 */

export interface SpeakHandle {
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface TtsSegment {
  text: string;
  /** BCP-47: "en-US", "zh-HK". Cantonese text uses zh-HK voices. */
  lang: string;
  /** Distinguishes presenters in dialogue formats (voice varies per speaker). */
  speaker?: string;
}

export interface TextToSpeechProvider {
  readonly id: string;
  supported(): boolean;
  /**
   * Speak segments in order. onProgress reports the segment index as it
   * starts; onEnd fires after the last segment or on stop().
   */
  speak(options: {
    segments: TtsSegment[];
    rate: number;
    onProgress?: (segmentIndex: number) => void;
    onEnd?: () => void;
    onError?: (message: string) => void;
  }): SpeakHandle | null;
}

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

/** Voices arrive asynchronously in some browsers. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const s = synth();
  if (!s) return Promise.resolve([]);
  const now = s.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(s.getVoices()), 1500);
    s.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timer);
        resolve(s.getVoices());
      },
      { once: true },
    );
  });
}

/**
 * Not all device voices are equal, and the difference is the whole gap
 * between "a person reading the news" and "a robot". Modern neural voices
 * (Microsoft *Natural/Online*, Apple's premium set, Google's network
 * voices) sound human; the legacy SAPI5 set that Windows lists FIRST —
 * David, Mark, Zira — is the flat robotic one everybody recognises.
 *
 * Picking voices[0], as this used to, therefore reliably chose the worst
 * available voice on Windows. Rank instead, and take the best.
 */
const VOICE_PREFERENCES: { pattern: RegExp; score: number }[] = [
  // Microsoft neural voices, by far the best free option on Windows.
  { pattern: /\b(natural|neural)\b/i, score: 100 },
  { pattern: /\bonline\b/i, score: 80 },
  // Apple's good voices (macOS/iOS). "Compact" marks the low-quality ones.
  { pattern: /\b(samantha|ava|allison|serena|karen|moira|tessa|daniel|siri)\b/i, score: 70 },
  // Cantonese: Microsoft HK neural, then Apple's Cantonese voice.
  { pattern: /\b(hiugaai|hiumaan|wanlung)\b/i, score: 90 },
  { pattern: /\bsinji\b/i, score: 70 },
  // Google's network voices are decent and common in Chrome.
  { pattern: /\bgoogle\b/i, score: 55 },
  // Known-robotic legacy engines — usable, but only as a last resort.
  { pattern: /\b(david|mark|zira|hazel|george|susan)\b/i, score: -40 },
  { pattern: /\b(desktop|espeak|compact|pico)\b/i, score: -60 },
];

export function scoreVoice(voice: { name: string; lang: string; localService?: boolean }): number {
  let score = 0;
  for (const { pattern, score: s } of VOICE_PREFERENCES) {
    if (pattern.test(voice.name)) score += s;
  }
  // A network voice is usually the neural one; a local voice is usually the
  // legacy engine. Only a nudge — some good voices are installed locally.
  if (voice.localService === false) score += 15;
  return score;
}

/** Voices for a language, best first. Stable so playback is repeatable. */
export function rankVoices<T extends { name: string; lang: string; localService?: boolean }>(
  voices: T[],
  lang: string,
): T[] {
  const base = lang.split("-")[0].toLowerCase();
  const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  // zh-HK specifically ahead of other Chinese variants for Cantonese text.
  const exact = matches.filter((v) => v.lang.toLowerCase().includes("hk"));
  const pool = lang.toLowerCase().startsWith("zh-hk") && exact.length ? exact : matches;
  return [...pool].sort(
    (a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name),
  );
}

/**
 * Read text the way a person would say it, not the way it is written.
 * "HK$81.2 million" spoken literally becomes "H K dollar sign eighty one
 * point two", which is the other half of sounding like a machine. Applies
 * to speech only — the stored transcript and the on-screen text are never
 * altered.
 */
export function speechText(input: string, lang = "en"): string {
  let t = input;
  // Stray markdown that slipped through, and symbols read aloud as words.
  t = t.replace(/[*_`#]+/g, "");
  t = t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  // Dashes and ellipses become pauses rather than spoken characters.
  t = t.replace(/\s*[—–]\s*/g, ", ").replace(/\.{3,}|…/g, ", ");

  if (!lang.toLowerCase().startsWith("zh")) {
    // Currency reads correctly only if the symbol moves after the amount.
    // The amount deliberately does not swallow a trailing full stop, and the
    // scale needs a word boundary — without it the "m" in "US$50 monthly"
    // is read as "million".
    const AMOUNT = String.raw`([\d,]+(?:\.\d+)?)\s*(trillion|billion|million|bn|b|m)?\b`;
    const money = (prefix: string, spoken: string) =>
      t.replace(new RegExp(prefix + String.raw`\s?` + AMOUNT, "gi"), (_m, n, s) =>
        `${n}${s ? " " + expandScale(s) : ""} ${spoken}`,
      );
    t = money(String.raw`HK\$`, "Hong Kong dollars");
    t = money(String.raw`US\$`, "US dollars");
    t = money(String.raw`(?<![A-Z])\$`, "dollars");
    t = t.replace(/([\d.]+)\s?%/g, "$1 percent");
    t = t.replace(/\bper cent\b/gi, "percent");
    t = t.replace(/\s&\s/g, " and ");
  }

  return t.replace(/[ \t]{2,}/g, " ").trim();
}

function expandScale(s: string): string {
  const k = s.toLowerCase();
  if (k === "bn" || k === "b") return "billion";
  if (k === "m") return "million";
  return k;
}

/**
 * Names the missing language in a way a reader can act on. Kept separate so
 * it can be asserted directly, and so the wording lives in one place.
 */
export function missingVoiceMessage(langs: string[]): string {
  const names = langs.map((l) =>
    l.toLowerCase().startsWith("zh") ? "Cantonese (廣東話)" : "English",
  );
  const unique = [...new Set(names)];
  return (
    `No ${unique.join(" or ")} voice is installed on this device, so that part ` +
    `cannot be read aloud. Add one in Windows Settings, Time & language, ` +
    `Language & region, then add Chinese (Traditional, Hong Kong) with its ` +
    `speech feature. The text is all here to read in the meantime.`
  );
}

export class BrowserTtsProvider implements TextToSpeechProvider {
  readonly id = "browser";

  supported(): boolean {
    return synth() !== null;
  }

  speak(options: {
    segments: TtsSegment[];
    rate: number;
    onProgress?: (segmentIndex: number) => void;
    onEnd?: () => void;
    onError?: (message: string) => void;
  }): SpeakHandle | null {
    const s = synth();
    if (!s) {
      options.onError?.("Speech playback is not supported in this browser.");
      return null;
    }
    s.cancel(); // never overlap with a previous playback

    let stopped = false;
    void loadVoices().then((voices) => {
      if (stopped) return;

      // Assign each presenter its own voice, best first, so a two-hander
      // actually sounds like two people. Speakers are ordered by first
      // appearance rather than hashed, which keeps playback repeatable.
      const speakers = [...new Set(options.segments.map((x) => x.speaker ?? ""))];
      const rankedFor = new Map<string, SpeechSynthesisVoice[]>();
      const voiceFor = (lang: string, speaker?: string) => {
        if (!rankedFor.has(lang)) rankedFor.set(lang, rankVoices(voices, lang));
        const ranked = rankedFor.get(lang)!;
        if (ranked.length === 0) return null;
        const i = speaker ? speakers.indexOf(speaker) : 0;
        return ranked[Math.max(0, i) % ranked.length];
      };

      // A device with no Cantonese voice would otherwise hand Chinese text
      // to an English engine, which reads it as noise. Say what is missing
      // and skip those segments rather than producing gibberish.
      const missing = [...new Set(options.segments.map((x) => x.lang))].filter(
        (l) => rankVoices(voices, l).length === 0,
      );
      if (missing.length > 0) {
        options.onError?.(missingVoiceMessage(missing));
        if (missing.length === new Set(options.segments.map((x) => x.lang)).size) {
          options.onEnd?.();
          return;
        }
      }

      const playable = options.segments.filter((x) => !missing.includes(x.lang));

      playable.forEach((segment, index) => {
        const utterance = new SpeechSynthesisUtterance(
          speechText(segment.text, segment.lang),
        );
        utterance.lang = segment.lang;
        utterance.rate = Math.min(2, Math.max(0.5, options.rate));
        const voice = voiceFor(segment.lang, segment.speaker);
        if (voice) utterance.voice = voice;
        // When two presenters have to share the only installed voice, a
        // small pitch offset keeps them apart without sounding comical.
        const ranked = rankedFor.get(segment.lang) ?? [];
        if (segment.speaker && ranked.length < speakers.length) {
          const i = speakers.indexOf(segment.speaker);
          utterance.pitch = i % 2 === 1 ? 0.9 : 1.05;
        }
        utterance.onstart = () => options.onProgress?.(index);
        if (index === playable.length - 1) {
          utterance.onend = () => options.onEnd?.();
        }
        utterance.onerror = (e) => {
          if (!stopped && e.error !== "interrupted" && e.error !== "canceled") {
            options.onError?.(`Speech playback error (${e.error}).`);
          }
        };
        s.speak(utterance);
      });
    });

    return {
      pause: () => s.pause(),
      resume: () => s.resume(),
      stop: () => {
        stopped = true;
        s.cancel();
        options.onEnd?.();
      },
    };
  }
}

export const ttsProvider: TextToSpeechProvider = new BrowserTtsProvider();
