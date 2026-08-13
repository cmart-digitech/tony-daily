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

function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  speaker?: string,
): SpeechSynthesisVoice | null {
  const base = lang.split("-")[0].toLowerCase();
  const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  // zh-HK specifically ahead of other Chinese variants for Cantonese text.
  const exact = matches.filter((v) => v.lang.toLowerCase().includes("hk"));
  const pool = lang === "zh-HK" && exact.length ? exact : matches;
  if (pool.length === 0) return null;
  // Deterministically vary the voice per speaker for dialogue formats.
  if (speaker) {
    let h = 0;
    for (const ch of speaker) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return pool[Math.abs(h) % pool.length];
  }
  return pool[0];
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
      options.segments.forEach((segment, index) => {
        const utterance = new SpeechSynthesisUtterance(segment.text);
        utterance.lang = segment.lang;
        utterance.rate = Math.min(2, Math.max(0.5, options.rate));
        const voice = pickVoice(voices, segment.lang, segment.speaker);
        if (voice) utterance.voice = voice;
        utterance.onstart = () => options.onProgress?.(index);
        if (index === options.segments.length - 1) {
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
