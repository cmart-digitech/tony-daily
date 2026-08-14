"use client";

import { useCallback, useEffect, useState } from "react";

interface AlertItem {
  id: number;
  symbol: string;
  kind: "above" | "below" | "move_pct";
  threshold: number;
  enabled: boolean;
  lastTriggeredAt: number | null;
  lastEvent: { message: string; triggeredAt: number } | null;
}

/**
 * Market alerts (brief §39). Created only here, by explicit action; checked
 * on the ingestion schedule against cached (delayed) quotes; delivered by
 * Telegram when configured.
 */
export default function AlertsPanel({
  symbols,
  telegramConfigured,
  marketDataConfigured,
  zh,
}: {
  symbols: string[];
  telegramConfigured: boolean;
  /** Alerts are evaluated against quotes; without a provider they cannot fire. */
  marketDataConfigured: boolean;
  zh: boolean;
}) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [symbol, setSymbol] = useState(symbols[0] ?? "");
  const [kind, setKind] = useState<AlertItem["kind"]>("below");
  const [threshold, setThreshold] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/alerts");
    const data = await res.json();
    if (data.ok) setAlerts(data.alerts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!symbol && symbols.length) setSymbol(symbols[0]);
  }, [symbols, symbol]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(threshold);
    if (!symbol || !Number.isFinite(value) || value <= 0) return;
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, kind, threshold: value }),
    });
    setThreshold("");
    load();
  };

  const KINDS: { value: AlertItem["kind"]; en: string; zhL: string }[] = [
    { value: "below", en: "falls to or below", zhL: "跌至或低於" },
    { value: "above", en: "rises to or above", zhL: "升至或高於" },
    { value: "move_pct", en: "moves more than (%)", zhL: "單日波幅超過 (%)" },
  ];

  const describe = (a: AlertItem) => {
    const k = KINDS.find((x) => x.value === a.kind)!;
    return `${a.symbol} ${zh ? k.zhL : k.en} ${a.threshold}${a.kind === "move_pct" ? "%" : ""}`;
  };

  return (
    <section className="mt-14">
      <h2 className="mb-4 border-b border-line pb-2 text-xs font-semibold uppercase tracking-widest text-ink">
        {zh ? "市場提示" : "Market Alerts · 市場提示"}
      </h2>
      {!marketDataConfigured && (
        <p className="mb-4 border border-line-2 bg-subtle px-4 py-3 text-sm text-ink-2">
          {zh
            ? "未設定市場數據，所以提示唔會被觸發 — 系統唔會用估算價格。設定 TWELVE_DATA_API_KEY 之後就會開始檢查。"
            : "Market data is not configured, so alerts cannot trigger — the system will never guess a price. Set TWELVE_DATA_API_KEY and checks begin on the next refresh."}
        </p>
      )}
      {marketDataConfigured && !telegramConfigured && (
        <p className="mb-4 text-xs text-ink-3">
          {zh
            ? "提示會記錄喺度；設定 Telegram 之後仲會即時通知你。"
            : "Alerts are recorded here; configure Telegram to also be notified."}
        </p>
      )}
      {symbols.length === 0 ? (
        <p className="text-sm text-ink-3">
          {zh ? "先喺自選股加入股票。" : "Add securities to your watchlist first."}
        </p>
      ) : (
        <form onSubmit={create} className="mb-6 flex flex-wrap items-center gap-2">
          <label htmlFor="alert-symbol" className="sr-only">Symbol</label>
          <select
            id="alert-symbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="border border-line-2 bg-elevated px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <label htmlFor="alert-kind" className="sr-only">Condition</label>
          <select
            id="alert-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as AlertItem["kind"])}
            className="border border-line-2 bg-elevated px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{zh ? k.zhL : k.en}</option>
            ))}
          </select>
          <label htmlFor="alert-threshold" className="sr-only">Threshold</label>
          <input
            id="alert-threshold"
            type="number"
            step="any"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder={kind === "move_pct" ? "5" : "300.00"}
            className="w-28 border border-line-2 bg-elevated px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={!threshold}
            className="border border-line-2 px-4 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {zh ? "新增提示" : "Create alert"}
          </button>
        </form>
      )}
      {alerts.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {alerts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <p className="min-w-0 flex-1 text-sm text-ink">
                {describe(a)}
                {a.lastEvent && (
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {zh ? "上次觸發：" : "Last triggered: "}
                    {a.lastEvent.message}
                  </span>
                )}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={a.enabled}
                aria-label={`${describe(a)} enabled`}
                onClick={async () => {
                  await fetch("/api/alerts", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: a.id, enabled: !a.enabled }),
                  });
                  load();
                }}
                className={`relative h-5 w-9 rounded-full transition-colors ${a.enabled ? "bg-up" : "bg-line-2"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${a.enabled ? "left-4.5" : "left-0.5"}`}
                />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/alerts?id=${a.id}`, { method: "DELETE" });
                  load();
                }}
                className="text-xs text-ink-3 hover:text-down"
              >
                {zh ? "刪除" : "Delete"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
