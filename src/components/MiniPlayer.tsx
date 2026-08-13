"use client";

import { useEffect, useState } from "react";
import {
  close,
  nextSegment,
  pause,
  previousSegment,
  resume,
  setRate,
  subscribe,
  type PlayerState,
} from "@/lib/voice/player-store";

const RATES = [0.75, 1, 1.25, 1.5];

/**
 * Persistent audio mini-player (brief §56). Mounted once in the layout, so
 * it survives navigation; Tony can browse while listening. Skipping is per
 * segment — the honest equivalent of ±15s for on-device synthesis.
 */
export default function MiniPlayer() {
  const [state, setState] = useState<PlayerState | null>(null);

  useEffect(() => subscribe(setState), []);

  if (!state?.episode) return null;
  const { episode, segmentIndex, status, rate } = state;
  const isToday =
    episode.dateKey ===
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elevated/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-ink">
            {episode.title}
            {!isToday && (
              <span className="ml-2 rounded-sm border border-accent/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                From {episode.dateKey} — not today&rsquo;s brief
              </span>
            )}
          </p>
          <p className="text-[11px] text-ink-3">
            Segment {segmentIndex + 1} / {episode.segments.length} ·{" "}
            {episode.language === "zh-HK" ? "廣東話" : episode.language === "bilingual" ? "雙語" : "English"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={previousSegment} aria-label="Previous segment"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
            ⏮
          </button>
          {status === "playing" ? (
            <button type="button" onClick={pause} aria-label="Pause"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-ink text-ink hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
              ⏸
            </button>
          ) : (
            <button type="button" onClick={resume} aria-label="Play"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-ink text-ink hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
              ▶
            </button>
          )}
          <button type="button" onClick={nextSegment} aria-label="Next segment"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
            ⏭
          </button>
          <button
            type="button"
            onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])}
            aria-label={`Speed ${rate}x`}
            className="rounded-sm px-2 py-1 font-mono text-xs text-ink-3 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            {rate}×
          </button>
          <button type="button" onClick={close} aria-label="Close player"
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-full text-ink-3 hover:text-down focus-visible:outline-2 focus-visible:outline-accent">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
