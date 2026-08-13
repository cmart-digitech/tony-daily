"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Preferences } from "@/lib/prefs";

const INTEREST_KEYS = [
  ["markets", "Markets & Equities", "市場與股票"],
  ["property", "Property & Real Estate", "地產"],
  ["architecture", "Architecture & Design", "建築與設計"],
  ["infrastructure", "Infrastructure", "基建"],
  ["government", "Government & Policy", "政府與政策"],
  ["hk", "Hong Kong", "香港"],
  ["china", "Greater China", "大中華"],
  ["world", "Global", "環球"],
] as const;

export default function SettingsPanel({
  initial,
  lang,
  labels,
}: {
  initial: Preferences;
  /** Server-rendered language — authoritative, so the header language
   *  toggle re-labels this panel immediately instead of on next load. */
  lang: Preferences["language"];
  labels: {
    language: string;
    theme: string;
    light: string;
    dark: string;
    system: string;
    briefingTime: string;
    interests: string;
  };
}) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const router = useRouter();

  const persist = async (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch } as Preferences;
    setPrefs(next);
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const zh = lang === "zh";

  return (
    <div className="max-w-2xl space-y-10">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
          {labels.language}
        </h2>
        <div className="flex gap-2">
          {(
            [
              ["en", "English"],
              ["zh", "繁體中文"],
              ["both", "雙語 Bilingual"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={lang === value}
              onClick={() => persist({ language: value })}
              className={`border px-4 py-2 text-sm transition-colors ${
                lang === value
                  ? "border-ink bg-ink text-bg"
                  : "border-line-2 text-ink-2 hover:border-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-3">
          {labels.briefingTime}
        </h2>
        <input
          type="time"
          value={prefs.briefingTime}
          onChange={(e) => persist({ briefingTime: e.target.value })}
          className="border border-line-2 bg-elevated px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
          aria-label={labels.briefingTime}
        />
        <p className="mt-2 text-xs text-ink-3">Asia/Hong_Kong</p>
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-3">
          {labels.interests}
        </h2>
        <div className="space-y-5">
          {INTEREST_KEYS.map(([key, en, zhLabel]) => (
            <div key={key}>
              <div className="mb-1 flex items-baseline justify-between">
                <label htmlFor={`interest-${key}`} className="text-sm text-ink">
                  {zh ? zhLabel : en}
                </label>
                <span className="font-mono text-xs text-ink-3">
                  {prefs.interests[key]}
                </span>
              </div>
              <input
                id={`interest-${key}`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={prefs.interests[key]}
                onChange={(e) =>
                  persist({
                    interests: {
                      ...prefs.interests,
                      [key]: Number(e.target.value),
                    },
                  })
                }
                className="w-full accent-(--accent)"
              />
            </div>
          ))}
        </div>
      </section>

      <p aria-live="polite" className="h-4 text-xs text-ink-3">
        {saving ? "Saving…" : savedTick ? "Saved" : ""}
      </p>
    </div>
  );
}
