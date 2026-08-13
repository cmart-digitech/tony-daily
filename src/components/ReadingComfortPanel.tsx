"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ComfortSettings } from "@/lib/prefs";

/**
 * READING COMFORT · 閱讀設定 (brief §24–25). Every change persists and
 * applies on the next render via root data attributes — the premium design
 * adapts rather than being replaced.
 */

type OptionRow<K extends keyof ComfortSettings> = {
  key: K;
  en: string;
  zh: string;
  options: { value: ComfortSettings[K]; en: string; zh: string }[];
};

const ROWS: OptionRow<keyof ComfortSettings>[] = [
  {
    key: "textSize",
    en: "Text size",
    zh: "文字大小",
    options: [
      { value: "normal", en: "Normal", zh: "標準" },
      { value: "large", en: "Large", zh: "大" },
      { value: "xlarge", en: "Extra Large", zh: "加大" },
      { value: "max", en: "Maximum", zh: "最大" },
    ],
  },
  {
    key: "lineSpacing",
    en: "Line spacing",
    zh: "行距",
    options: [
      { value: "compact", en: "Compact", zh: "緊密" },
      { value: "comfortable", en: "Comfortable", zh: "舒適" },
      { value: "spacious", en: "Spacious", zh: "寬鬆" },
    ],
  },
  {
    key: "density",
    en: "Content density",
    zh: "內容密度",
    options: [
      { value: "compact", en: "Compact", zh: "緊密" },
      { value: "comfortable", en: "Comfortable", zh: "舒適" },
      { value: "large", en: "Large", zh: "寬敞" },
    ],
  },
  {
    key: "contrast",
    en: "Contrast",
    zh: "對比度",
    options: [
      { value: "standard", en: "Standard", zh: "標準" },
      { value: "high", en: "High contrast", zh: "高對比" },
    ],
  },
  {
    key: "articleWidth",
    en: "Article width",
    zh: "文章闊度",
    options: [
      { value: "standard", en: "Standard", zh: "標準" },
      { value: "focused", en: "Focused", zh: "集中" },
      { value: "wide", en: "Wide", zh: "闊" },
    ],
  },
  {
    key: "motion",
    en: "Motion",
    zh: "動態效果",
    options: [
      { value: "standard", en: "Standard", zh: "標準" },
      { value: "reduced", en: "Reduced", zh: "減少" },
    ],
  },
] as OptionRow<keyof ComfortSettings>[];

export default function ReadingComfortPanel({
  initial,
  zh,
}: {
  initial: ComfortSettings;
  zh: boolean;
}) {
  const [comfort, setComfort] = useState(initial);
  const router = useRouter();

  const persist = async (patch: Partial<ComfortSettings>) => {
    setComfort((c) => ({ ...c, ...patch }));
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comfort: patch }),
    }).catch(() => {});
    router.refresh();
  };

  return (
    <div className="max-w-2xl space-y-7">
      {ROWS.map((row) => (
        <div key={row.key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-3">
            {zh ? row.zh : row.en}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={row.en}>
            {row.options.map((o) => (
              <button
                key={String(o.value)}
                type="button"
                aria-pressed={comfort[row.key] === o.value}
                onClick={() => persist({ [row.key]: o.value } as Partial<ComfortSettings>)}
                className={`border px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  comfort[row.key] === o.value
                    ? "border-ink bg-ink text-bg"
                    : "border-line-2 text-ink-2 hover:border-ink"
                }`}
              >
                {zh ? o.zh : o.en}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="border-t border-line pt-6">
        <button
          type="button"
          role="switch"
          aria-checked={comfort.comfortMode}
          onClick={() => persist({ comfortMode: !comfort.comfortMode })}
          className={`flex w-full items-center justify-between border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
            comfort.comfortMode ? "border-accent" : "border-line-2"
          }`}
        >
          <span>
            <span className="block text-sm font-semibold text-ink">
              {zh ? "舒適模式" : "Comfort Mode"}
            </span>
            <span className="block text-xs text-ink-2">
              {zh
                ? "更大嘅按鈕、更闊嘅間距、更清晰嘅焦點提示。"
                : "Larger controls, roomier spacing, stronger focus outlines."}
            </span>
          </span>
          <span
            aria-hidden
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              comfort.comfortMode ? "bg-up" : "bg-line-2"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                comfort.comfortMode ? "left-5.5" : "left-0.5"
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
