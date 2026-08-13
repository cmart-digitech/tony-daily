"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SymbolSearchResult } from "@/lib/market/types";

const INTERESTS = [
  { key: "markets", en: "Markets & Equities", zh: "市場與股票" },
  { key: "property", en: "Property & Real Estate", zh: "地產" },
  { key: "architecture", en: "Architecture & Built Environment", zh: "建築" },
  { key: "infrastructure", en: "Infrastructure", zh: "基建" },
  { key: "hk", en: "Hong Kong", zh: "香港" },
  { key: "china", en: "Greater China", zh: "大中華" },
  { key: "world", en: "Global Business", zh: "環球商業" },
  { key: "government", en: "Government & Policy", zh: "政府與政策" },
] as const;

export default function OnboardingFlow({ marketConfigured }: { marketConfigured: boolean }) {
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<"en" | "zh" | "both">("en");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["markets", "property", "architecture", "hk"]),
  );
  const [briefingTime, setBriefingTime] = useState("07:00");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const zh = language === "zh";

  const search = (q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim() || !marketConfigured) return setResults([]);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.ok ? data.results : []);
      } catch {
        setResults([]);
      }
    }, 350);
  };

  const addSymbol = async (r: SymbolSearchResult) => {
    const symbol =
      r.exchange && ["HKEX", "HKG"].includes(r.exchange.toUpperCase()) && !r.symbol.includes(".")
        ? `${r.symbol}.HK`
        : r.symbol;
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol,
        name: r.name,
        exchange: r.exchange,
        currency: r.currency,
        instrumentType: r.instrumentType,
      }),
    });
    setAdded((a) => [...a, symbol]);
    setQuery("");
    setResults([]);
  };

  const finish = async () => {
    setFinishing(true);
    const interests: Record<string, number> = {};
    for (const i of INTERESTS) {
      interests[i.key] = selected.has(i.key) ? (["markets", "property", "architecture"].includes(i.key) ? 85 : 70) : 35;
    }
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarded: true, language, briefingTime, theme, interests }),
    });
    localStorage.setItem("td-theme", theme);
    // First ingest + brief so the dashboard has real content immediately.
    try {
      await fetch("/api/ingest", { method: "POST" });
      await fetch("/api/brief", { method: "POST" });
    } catch {
      // dashboard shows honest empty states if this fails
    }
    router.push("/");
    router.refresh();
  };

  const stepTitle = ["Language 語言", zh ? "興趣" : "Interests", zh ? "自選股" : "Watchlist", zh ? "簡報與外觀" : "Briefing & theme"][step];

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-accent">
        Tony Daily
      </p>
      <h1 className="mb-1 font-serif text-3xl text-ink">
        {zh ? "歡迎使用 Tony Daily" : "Welcome to Tony Daily"}
      </h1>
      <p className="mb-10 text-sm text-ink-3">
        {step + 1} / 4 — {stepTitle}
      </p>

      {step === 0 && (
        <div className="space-y-3">
          {(
            [
              ["en", "English"],
              ["zh", "繁體中文"],
              ["both", "雙語 · Bilingual"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={language === value}
              onClick={() => setLanguage(value)}
              className={`block w-full border px-5 py-4 text-left text-lg transition-colors ${
                language === value
                  ? "border-ink bg-ink text-bg"
                  : "border-line-2 text-ink hover:border-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-2 gap-3">
          {INTERESTS.map((i) => {
            const on = selected.has(i.key);
            return (
              <button
                key={i.key}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSelected((s) => {
                    const next = new Set(s);
                    if (next.has(i.key)) next.delete(i.key);
                    else next.add(i.key);
                    return next;
                  })
                }
                className={`border px-4 py-3 text-left text-sm transition-colors ${
                  on ? "border-accent bg-accent/10 text-ink" : "border-line-2 text-ink-2 hover:border-ink"
                }`}
              >
                {zh ? i.zh : i.en}
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="mb-4 text-sm text-ink-2">
            {zh
              ? "搜尋並加入想追蹤的股票（可隨時再改，不會假設你持有任何股票）。"
              : "Search and add securities you want to follow. You can change this anytime — nothing is assumed about what you own."}
          </p>
          {marketConfigured ? (
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => search(e.target.value)}
                placeholder={zh ? "搜尋股票代號或公司…" : "Search ticker or company…"}
                className="w-full border border-line-2 bg-elevated px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
              {results.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto border border-line-2 bg-elevated shadow-lg">
                  {results.map((r) => (
                    <li key={`${r.symbol}-${r.exchange}`}>
                      <button
                        type="button"
                        onClick={() => addSymbol(r)}
                        className="flex w-full items-baseline gap-3 px-4 py-2 text-left hover:bg-subtle"
                      >
                        <span className="font-mono text-sm">{r.symbol}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{r.name}</span>
                        <span className="text-xs text-ink-3">{r.exchange}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="border border-line bg-subtle px-4 py-3 text-sm text-ink-2">
              {zh
                ? "尚未設定市場數據（TWELVE_DATA_API_KEY），稍後可在設定加入股票。"
                : "Market data is not configured (TWELVE_DATA_API_KEY). You can add stocks later once it is."}
            </p>
          )}
          {added.length > 0 && (
            <p className="mt-4 font-mono text-sm text-ink-2">{added.join(" · ")}</p>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-3">
              {zh ? "早晨簡報時間" : "Morning briefing time"}
            </p>
            <input
              type="time"
              value={briefingTime}
              onChange={(e) => setBriefingTime(e.target.value)}
              className="border border-line-2 bg-elevated px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
            />
            <span className="ml-3 text-xs text-ink-3">Asia/Hong_Kong</span>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-3">
              {zh ? "外觀" : "Theme"}
            </p>
            <div className="flex gap-2">
              {(
                [
                  ["light", zh ? "☀ 淺色" : "☀ Light"],
                  ["dark", zh ? "☾ 深色" : "☾ Dark"],
                  ["system", zh ? "◐ 跟隨系統" : "◐ System"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                  className={`border px-4 py-2 text-sm ${
                    theme === value ? "border-ink bg-ink text-bg" : "border-line-2 text-ink-2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-12 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-sm text-ink-3 hover:text-ink disabled:opacity-0"
        >
          ← {zh ? "上一步" : "Back"}
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="bg-ink px-6 py-2.5 text-sm text-bg hover:opacity-85"
          >
            {zh ? "下一步" : "Next"} →
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            disabled={finishing}
            className="bg-accent px-6 py-2.5 text-sm text-white hover:opacity-90 disabled:opacity-60"
          >
            {finishing ? (zh ? "準備中…" : "Preparing…") : zh ? "開始閱讀" : "Start reading"}
          </button>
        )}
      </div>
    </div>
  );
}
