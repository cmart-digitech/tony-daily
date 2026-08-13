"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, speechProvider, type SpeechSession } from "@/lib/voice/speech";

const LANG_KEY = "td-voice-stt-lang";

/**
 * Microphone input (brief §6–9). Recording starts only on explicit press,
 * the listening state is unmistakable, and the transcript lands in the
 * composer for review/editing — it is never auto-sent, and raw audio is
 * never kept. The transcribed question then flows through exactly the same
 * grounded retrieval pipeline as typed text.
 */
export default function MicButton({
  onTranscript,
  disabled,
}: {
  /** Called with interim and final transcripts as they form. */
  onTranscript: (text: string, final: boolean) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SpeechSession | null>(null);

  useEffect(() => {
    setSupported(speechProvider.supported());
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) setLanguage(saved);
    return () => sessionRef.current?.cancel();
  }, []);

  if (!supported) return null;

  const toggle = () => {
    setError(null);
    if (listening) {
      sessionRef.current?.stop();
      return;
    }
    const session = speechProvider.start({
      language,
      onInterim: (text) => onTranscript(text, false),
      onFinal: (text) => onTranscript(text, true),
      onError: (message) => {
        setError(message);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (session) {
      sessionRef.current = session;
      setListening(true);
    }
  };

  const switchLanguage = () => {
    const idx = LANGUAGES.findIndex((l) => l.code === language);
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length].code;
    setLanguage(next);
    localStorage.setItem(LANG_KEY, next);
  };

  const label = LANGUAGES.find((l) => l.code === language)?.label ?? language;

  return (
    <span className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : `Speak (${label})`}
        title={listening ? "Stop listening" : `Speak (${label})`}
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
          listening
            ? "animate-pulse border-accent bg-accent text-white"
            : "border-line-2 text-ink-2 hover:border-accent hover:text-accent"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={switchLanguage}
        disabled={listening}
        aria-label={`Recognition language: ${label}. Click to switch.`}
        className="rounded-sm px-1.5 py-1 text-[10px] uppercase tracking-wider text-ink-3 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
      >
        {language === "yue-Hant-HK" ? "粵" : "EN"}
      </button>
      {error && (
        <span role="alert" className="absolute -top-7 left-0 whitespace-nowrap text-xs text-down">
          {error}
        </span>
      )}
    </span>
  );
}
