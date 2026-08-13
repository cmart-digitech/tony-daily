"use client";

import { useCallback, useEffect, useState } from "react";
import { play } from "@/lib/voice/player-store";
import type { TtsSegment } from "@/lib/voice/tts";

interface Episode {
  id: number;
  dateKey: string;
  format: string;
  language: string;
  title: string;
  transcript: string;
  sourceIds: string;
  wordCount: number;
  createdAt: number;
}

const FORMATS = [
  { key: "quick", en: "Quick Brief", note: "≈2 min · one anchor" },
  { key: "morning", en: "Morning Brief", note: "≈5 min · one anchor" },
  { key: "deep", en: "Deep Brief", note: "≈10 min · one anchor" },
  { key: "dialogue", en: "Morning Conversation", note: "≈5 min · two presenters" },
] as const;

const LANGS = [
  { key: "en", label: "English" },
  { key: "zh-HK", label: "廣東話" },
  { key: "bilingual", label: "雙語" },
] as const;

/**
 * TONY DAILY AUDIO: generate today's grounded briefings and browse the
 * episode library. Every card shows its generation date — an old episode is
 * clearly an old episode.
 */
export default function AudioLibrary({ aiConfigured, todayKey }: { aiConfigured: boolean; todayKey: string }) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [language, setLanguage] = useState<(typeof LANGS)[number]["key"]>("en");
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/audio");
    const data = await res.json();
    if (data.ok) setEpisodes(data.episodes);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const playEpisode = (e: Episode) => {
    let segments: TtsSegment[] = [];
    try {
      segments = JSON.parse(e.transcript) as TtsSegment[];
    } catch {
      return;
    }
    play({ id: e.id, title: e.title, dateKey: e.dateKey, language: e.language, segments });
  };

  const generate = async (format: string, regenerate = false) => {
    setGenerating(format);
    setError(null);
    try {
      const res = await fetch("/api/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, language, regenerate }),
      });
      const data = await res.json();
      if (data.ok) {
        await load();
        playEpisode(data.episode as Episode);
      } else {
        setError(data.error ?? "Generation failed.");
      }
    } catch {
      setError("Generation failed.");
    } finally {
      setGenerating(null);
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/audio?id=${id}`, { method: "DELETE" });
    load();
  };

  if (!aiConfigured) {
    return (
      <p className="border border-line bg-subtle px-4 py-3 text-sm text-ink-2">
        Audio briefings need the AI provider configured.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-ink-3">Language</span>
        {LANGS.map((l) => (
          <button
            key={l.key}
            type="button"
            aria-pressed={language === l.key}
            onClick={() => setLanguage(l.key)}
            className={`border px-3 py-1.5 text-sm transition-colors ${
              language === l.key ? "border-ink bg-ink text-bg" : "border-line-2 text-ink-2 hover:border-ink"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            disabled={generating !== null}
            onClick={() => generate(f.key)}
            className="border-t-2 border-ink px-4 py-4 text-left transition-colors hover:border-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="block font-serif text-lg text-ink">
              {generating === f.key ? "Generating…" : `▶ ${f.en}`}
            </span>
            <span className="mt-1 block text-xs text-ink-3">{f.note}</span>
          </button>
        ))}
      </div>
      {error && <p className="mb-6 text-sm text-down">{error}</p>}

      <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
        Audio Library
      </h2>
      {episodes.length === 0 ? (
        <p className="py-8 text-sm text-ink-3">No episodes yet — generate one above.</p>
      ) : (
        <ul className="divide-y divide-line">
          {episodes.map((e) => {
            let sourceCount = 0;
            try {
              sourceCount = (JSON.parse(e.sourceIds) as number[]).length;
            } catch {
              /* metadata only */
            }
            const old = e.dateKey !== todayKey;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <button
                  type="button"
                  onClick={() => playEpisode(e)}
                  aria-label={`Play ${e.title}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-2 text-ink hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
                >
                  ▶
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {e.title}
                    {old && (
                      <span className="ml-2 rounded-sm border border-line-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-3">
                        From {e.dateKey}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-ink-3">
                    {e.language === "zh-HK" ? "廣東話" : e.language === "bilingual" ? "雙語" : "English"} ·{" "}
                    {e.wordCount} words · {sourceCount} sources · generated{" "}
                    {new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Asia/Hong_Kong",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(e.createdAt))}{" "}
                    HKT
                  </p>
                </div>
                {e.dateKey === todayKey && (
                  <button
                    type="button"
                    onClick={() => generate(e.format, true)}
                    className="text-xs text-ink-3 hover:text-accent"
                  >
                    Regenerate
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  className="text-xs text-ink-3 hover:text-down"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
