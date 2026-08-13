"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { UiLanguage } from "@/lib/i18n";

const OPTIONS: { value: UiLanguage; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "繁" },
  { value: "both", label: "雙語" },
];

export default function LanguageToggle({ initial }: { initial: UiLanguage }) {
  const [lang, setLang] = useState<UiLanguage>(initial);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const change = async (value: UiLanguage) => {
    setLang(value);
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: value }),
    }).catch(() => {});
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="group"
      aria-label="Interface language"
      className="flex overflow-hidden rounded-full border border-line text-xs"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => change(o.value)}
          aria-pressed={lang === o.value}
          className={`px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
            lang === o.value
              ? "bg-ink text-bg"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
