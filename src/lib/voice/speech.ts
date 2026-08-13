"use client";

/**
 * SpeechRecognitionProvider abstraction (brief §8).
 *
 * The free production path is the browser's Web Speech API, which in
 * Chromium supports Hong Kong Cantonese (`yue-Hant-HK`) and English.
 * A cloud provider (e.g. Google Cloud Speech-to-Text) can implement the
 * same interface later — that is a paid decision documented in
 * docs/VOICE_ARCHITECTURE.md, not assumed here.
 *
 * Rules honoured (brief §9): recognition starts only from an explicit user
 * action, the transcript is shown and editable before sending, and raw
 * audio is never stored.
 */

export interface SpeechSession {
  stop(): void;
  cancel(): void;
}

export interface SpeechRecognitionProvider {
  readonly id: string;
  supported(): boolean;
  supportedLanguages(): { code: string; label: string }[];
  start(options: {
    language: string;
    onInterim: (text: string) => void;
    onFinal: (text: string) => void;
    onError: (message: string) => void;
    onEnd: () => void;
  }): SpeechSession | null;
}

/** Minimal typings for the vendor-prefixed Web Speech API. */
interface WebSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: WebSpeechResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface WebSpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function recognitionCtor(): (new () => WebSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const LANGUAGES = [
  { code: "en-US", label: "English" },
  { code: "yue-Hant-HK", label: "廣東話" },
];

export class BrowserSpeechProvider implements SpeechRecognitionProvider {
  readonly id = "browser";

  supported(): boolean {
    return recognitionCtor() !== null;
  }

  supportedLanguages() {
    return LANGUAGES;
  }

  start(options: {
    language: string;
    onInterim: (text: string) => void;
    onFinal: (text: string) => void;
    onError: (message: string) => void;
    onEnd: () => void;
  }): SpeechSession | null {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      options.onError("Speech recognition is not supported in this browser.");
      return null;
    }
    const recognition = new Ctor();
    recognition.lang = options.language;
    recognition.interimResults = true;
    recognition.continuous = false;

    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (interim) options.onInterim(finalText + interim);
      if (finalText) options.onFinal(finalText);
    };
    recognition.onerror = (event) => {
      const code = event.error ?? "unknown";
      const message =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone permission was refused."
          : code === "no-speech"
            ? "No speech was detected."
            : code === "audio-capture"
              ? "No microphone was found."
              : `Speech recognition error (${code}).`;
      options.onError(message);
    };
    recognition.onend = options.onEnd;

    try {
      recognition.start();
    } catch {
      options.onError("Could not start the microphone.");
      return null;
    }
    return {
      stop: () => recognition.stop(),
      cancel: () => recognition.abort(),
    };
  }
}

export const speechProvider: SpeechRecognitionProvider = new BrowserSpeechProvider();
