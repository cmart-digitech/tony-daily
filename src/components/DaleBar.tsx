"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DaleSession, micIsOpen, type DaleState } from "@/lib/voice/session";
import { speechProvider } from "@/lib/voice/speech";
import { toSegments, ttsProvider } from "@/lib/voice/tts";
import { languageSwitchReply, type DaleLanguage } from "@/lib/ai/persona";

const LANG_KEY = "td-dale-language";
const HANDSFREE_KEY = "td-dale-handsfree";

const LANGUAGE_LABEL: Record<DaleLanguage, string> = {
  en: "EN",
  "zh-HK": "廣東話",
  both: "EN · 中文",
};

/**
 * Apple requires a fresh user gesture for every recognition and every
 * utterance, so the loop cannot reopen the microphone by itself there. The
 * control says so rather than offering a hands-free switch that silently
 * does nothing.
 */
function isApple(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Talk to Dale (docs/PHASE_4_PLAN.md).
 *
 * Owns the conversation loop and nothing else: the question goes out
 * through `onAsk`, which is the same grounded pipeline a typed question
 * uses, and whatever comes back is spoken. The state is always visible —
 * an open microphone is never a surprise.
 */
export default function DaleBar({
  onAsk,
  onTranscript,
  disabled,
}: {
  /** Ask the grounded pipeline; resolves with the answer, or null if it failed. */
  onAsk: (question: string, language: DaleLanguage) => Promise<string | null>;
  /** Interim and final transcripts, shown in the composer and editable. */
  onTranscript?: (text: string, final: boolean) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<DaleState>("idle");
  const [language, setLanguage] = useState<DaleLanguage>("en");
  const [handsFree, setHandsFree] = useState(false);
  const [apple, setApple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<DaleSession | null>(null);

  // Read in an effect, not during render: these come from the device.
  useEffect(() => {
    setSupported(speechProvider.supported() && ttsProvider.supported());
    setApple(isApple());
    const savedLang = localStorage.getItem(LANG_KEY) as DaleLanguage | null;
    if (savedLang === "en" || savedLang === "zh-HK" || savedLang === "both") setLanguage(savedLang);
    if (!isApple() && localStorage.getItem(HANDSFREE_KEY) === "1") setHandsFree(true);
    return () => sessionRef.current?.stop();
  }, []);

  const speak = useCallback((text: string) => {
    const session = sessionRef.current;
    if (!session) return;
    const segments = toSegments(text);
    if (segments.length === 0) {
      session.failed();
      return;
    }
    session.say(segments);
  }, []);

  const session = () => {
    if (!sessionRef.current) {
      sessionRef.current = new DaleSession(
        { speech: speechProvider, tts: ttsProvider },
        {
          onState: setState,
          onTranscript: (text, final) => onTranscript?.(text, final),
          onError: (message) => setError(message),
          onLanguage: (next) => {
            setLanguage(next);
            localStorage.setItem(LANG_KEY, next);
            // Confirm the switch in the language just chosen, so the reader
            // hears immediately whether the voice for it exists at all.
            const confirmation = languageSwitchReply(next);
            ttsProvider.speak({ segments: toSegments(confirmation), rate: 1 });
          },
          onQuestion: async (question) => {
            setError(null);
            const answer = await onAsk(question, language);
            if (answer) speak(answer);
            else sessionRef.current?.failed();
          },
        },
        { conversation: handsFree, language },
      );
    }
    return sessionRef.current;
  };

  // Keep the live session in step with the controls.
  useEffect(() => {
    sessionRef.current?.setLanguage(language);
  }, [language]);
  useEffect(() => {
    sessionRef.current?.setConversation(handsFree);
  }, [handsFree]);

  if (!supported) return null;

  const talk = () => {
    setError(null);
    const s = session();
    // Speaking while Dale speaks is an interruption, not a new question.
    if (s.current === "speaking") s.interrupt();
    else s.listen();
  };

  const cycleLanguage = () => {
    const order: DaleLanguage[] = ["en", "zh-HK", "both"];
    const next = order[(order.indexOf(language) + 1) % order.length];
    setLanguage(next);
    localStorage.setItem(LANG_KEY, next);
  };

  const status =
    state === "listening"
      ? "Listening…"
      : state === "thinking"
        ? "Thinking…"
        : state === "speaking"
          ? "Speaking — press to interrupt"
          : handsFree
            ? "Press to talk. Dale keeps listening between answers."
            : "Press to talk";

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
      <button
        type="button"
        onClick={talk}
        disabled={disabled && state === "idle"}
        aria-pressed={state !== "idle"}
        className={`flex items-center gap-2 rounded-sm border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
          micIsOpen(state)
            ? "border-accent bg-accent text-white"
            : "border-line-2 text-ink-2 hover:border-ink hover:text-ink"
        }`}
      >
        <span aria-hidden>{micIsOpen(state) ? "●" : "🎙"}</span>
        {state === "idle" ? "Talk to Dale" : "Stop"}
      </button>

      <button
        type="button"
        onClick={cycleLanguage}
        className="rounded-sm border border-line-2 px-2.5 py-1.5 text-xs text-ink-2 hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        aria-label={`Dale's language: ${LANGUAGE_LABEL[language]}`}
      >
        {LANGUAGE_LABEL[language]}
      </button>

      {!apple && (
        <label className="flex items-center gap-1.5 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={handsFree}
            onChange={(e) => {
              setHandsFree(e.target.checked);
              localStorage.setItem(HANDSFREE_KEY, e.target.checked ? "1" : "0");
            }}
          />
          Hands-free
        </label>
      )}

      <span aria-live="polite" className="text-xs text-ink-3">
        {status}
      </span>
      {apple && state === "idle" && (
        <span className="text-xs text-ink-3">· one press per turn on this device</span>
      )}
      {error && <span className="text-xs text-down">{error}</span>}
    </div>
  );
}
