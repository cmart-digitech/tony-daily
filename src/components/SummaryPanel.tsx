"use client";

import { useState } from "react";

type Level = "30s" | "2min" | "deep";

/**
 * User-controlled summary levels for one story. Summaries are AI-assisted,
 * grounded in the story's own sources, cached server-side, and always
 * labelled as AI output.
 */
export default function SummaryPanel({
  articleId,
  language,
  aiConfigured,
  labels,
}: {
  articleId: number;
  language: "en" | "zh-HK";
  aiConfigured: boolean;
  labels: {
    s30: string;
    m2: string;
    deep: string;
    aiLabel: string;
    notConfigured: string;
  };
}) {
  const [level, setLevel] = useState<Level | null>(null);
  const [summaries, setSummaries] = useState<Partial<Record<Level, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (l: Level) => {
    setLevel(l);
    setError(null);
    if (summaries[l]) return;
    setLoading(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, level: l, language }),
      });
      const data = await res.json();
      if (data.ok) {
        setSummaries((s) => ({ ...s, [l]: data.summary }));
      } else {
        setError(data.error ?? "Summary unavailable.");
      }
    } catch {
      setError("Summary unavailable.");
    } finally {
      setLoading(false);
    }
  };

  if (!aiConfigured) {
    return (
      <p className="border border-line bg-subtle px-4 py-3 text-sm text-ink-2">
        {labels.notConfigured}
      </p>
    );
  }

  const buttons: { key: Level; label: string }[] = [
    { key: "30s", label: labels.s30 },
    { key: "2min", label: labels.m2 },
    { key: "deep", label: labels.deep },
  ];

  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="Summary length">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => load(b.key)}
            aria-pressed={level === b.key}
            className={`rounded-sm border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              level === b.key
                ? "border-ink bg-ink text-bg"
                : "border-line-2 text-ink-2 hover:border-ink hover:text-ink"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {loading && (
        <div className="mt-4 space-y-2">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-5/6 rounded" />
          <div className="skeleton h-4 w-2/3 rounded" />
        </div>
      )}
      {error && <p className="mt-4 text-sm text-down">{error}</p>}
      {level && summaries[level] && !loading && (
        <div className="mt-4 border-l-2 border-accent pl-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-ink-3">
            {labels.aiLabel}
          </p>
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
            {summaries[level]}
          </div>
        </div>
      )}
    </div>
  );
}
