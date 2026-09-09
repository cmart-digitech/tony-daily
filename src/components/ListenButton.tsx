"use client";

import { useEffect, useRef, useState } from "react";
import { ttsProvider, type TtsSegment } from "@/lib/voice/tts";

const RATES = [0.75, 1, 1.25, 1.5];
const RATE_KEY = "td-voice-rate";

/** Detect the speaking language of a text block (CJK → Cantonese voice). */
export function speechLang(text: string): string {
  return /[㐀-鿿]/.test(text) ? "zh-HK" : "en-US";
}

/**
 * 🔊 Listen control for AI responses (brief §10). Play/pause/stop/replay
 * with persisted speaking speed. Uses the device's own voices — nothing is
 * uploaded or stored.
 */
export default function ListenButton({
  segments,
  className = "",
}: {
  segments: TtsSegment[];
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);
  const [supported, setSupported] = useState(true);
  const handleRef = useRef<ReturnType<typeof ttsProvider.speak>>(null);

  useEffect(() => {
    setSupported(ttsProvider.supported());
    const saved = Number(localStorage.getItem(RATE_KEY));
    if (RATES.includes(saved)) setRate(saved);
    return () => handleRef.current?.stop();
  }, []);

  if (!supported || segments.length === 0) return null;

  const start = () => {
    handleRef.current = ttsProvider.speak({
      segments,
      rate,
      onEnd: () => setState("idle"),
      onError: () => setState("idle"),
    });
    if (handleRef.current) setState("playing");
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    localStorage.setItem(RATE_KEY, String(next));
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {state === "idle" && (
        <button
          type="button"
          onClick={start}
          className="rounded-sm border border-line-2 px-2.5 py-1 text-xs text-ink-2 transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          🔊 Listen
        </button>
      )}
      {state === "playing" && (
        <>
          <button
            type="button"
            onClick={() => {
              handleRef.current?.pause();
              setState("paused");
            }}
            aria-label="Pause"
            className="rounded-sm border border-accent px-2.5 py-1 text-xs text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            ⏸
          </button>
          <button
            type="button"
            onClick={() => handleRef.current?.stop()}
            aria-label="Stop"
            className="rounded-sm border border-line-2 px-2.5 py-1 text-xs text-ink-2 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            ⏹
          </button>
        </>
      )}
      {state === "paused" && (
        <>
          <button
            type="button"
            onClick={() => {
              handleRef.current?.resume();
              setState("playing");
            }}
            aria-label="Resume"
            className="rounded-sm border border-accent px-2.5 py-1 text-xs text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={() => handleRef.current?.stop()}
            aria-label="Stop"
            className="rounded-sm border border-line-2 px-2.5 py-1 text-xs text-ink-2 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            ⏹
          </button>
        </>
      )}
      <button
        type="button"
        onClick={cycleRate}
        aria-label={`Speaking speed ${rate}x`}
        title="Speaking speed"
        className="rounded-sm px-1.5 py-1 font-mono text-[10px] text-ink-3 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
      >
        {rate}×
      </button>
    </span>
  );
}
