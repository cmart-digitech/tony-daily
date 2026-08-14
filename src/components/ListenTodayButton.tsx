"use client";

import { useState } from "react";
import { play } from "@/lib/voice/player-store";
import type { TtsSegment } from "@/lib/voice/tts";

/**
 * ▶ Listen to Today's Brief — generates (or reuses) today's morning-brief
 * script and starts the persistent player.
 */
export default function ListenTodayButton({
  language,
  label,
  aiConfigured,
}: {
  language: "en" | "zh-HK" | "bilingual";
  label: string;
  /** Without an AI provider there is no script to speak, so offer nothing. */
  aiConfigured: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!aiConfigured) return null;

  const listen = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "morning", language }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Audio unavailable.");
        return;
      }
      const episode = data.episode as {
        id: number;
        title: string;
        dateKey: string;
        language: string;
        transcript: string;
      };
      play({
        id: episode.id,
        title: episode.title,
        dateKey: episode.dateKey,
        language: episode.language,
        segments: JSON.parse(episode.transcript) as TtsSegment[],
      });
    } catch {
      setError("Audio unavailable.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={listen}
        disabled={busy}
        className="rounded-sm bg-ink px-3 py-1.5 text-sm text-bg transition-opacity hover:opacity-85 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "…" : `▶ ${label}`}
      </button>
      {error && <span className="text-xs text-down">{error}</span>}
    </span>
  );
}
