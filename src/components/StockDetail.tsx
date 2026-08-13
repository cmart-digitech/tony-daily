"use client";

import { useEffect, useState } from "react";
import type { Quote, TimeSeriesBar } from "@/lib/market/types";

interface Labels {
  unavailable: string;
  notConfigured: string;
  updated: string;
  delayed: string;
  endOfDay: string;
}

/** Full stock card: quote details + 90-day close chart with honest labelling. */
export default function StockDetail({
  symbol,
  marketConfigured,
  labels,
}: {
  symbol: string;
  marketConfigured: boolean;
  labels: Labels;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [bars, setBars] = useState<TimeSeriesBar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!marketConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const [qRes, sRes] = await Promise.all([
          fetch(`/api/quotes?symbols=${encodeURIComponent(symbol)}`),
          fetch(`/api/series?symbol=${encodeURIComponent(symbol)}`),
        ]);
        const qData = await qRes.json();
        const sData = await sRes.json();
        if (cancelled) return;
        const q = qData.quotes?.[0];
        if (q?.ok) setQuote(q.quote);
        else setError(q?.error ?? labels.unavailable);
        if (sData.ok && sData.series?.bars) setBars(sData.series.bars);
      } catch {
        if (!cancelled) setError(labels.unavailable);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, marketConfigured, labels.unavailable]);

  if (!marketConfigured) {
    return (
      <p className="border border-line bg-subtle px-4 py-3 text-sm text-ink-2">
        {labels.notConfigured}
      </p>
    );
  }
  if (!loaded) return <div className="skeleton h-64 w-full rounded" />;
  if (!quote) {
    return (
      <p className="border border-line bg-subtle px-4 py-3 text-sm text-ink-2">
        {error ?? labels.unavailable}
      </p>
    );
  }

  const up = (quote.percentChange ?? 0) >= 0;
  const fmt = (v: number | null, d = 2) =>
    v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(quote.fetchedAt));

  const closes = bars?.map((b) => b.close) ?? [];
  const W = 720;
  const H = 220;
  let path = "";
  if (closes.length > 1) {
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const step = W / (closes.length - 1);
    path = closes
      .map((c, i) => {
        const x = i * step;
        const y = H - 8 - ((c - min) / range) * (H - 16);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const rows: [string, string][] = [
    ["Open", fmt(quote.open)],
    ["Prev close", fmt(quote.previousClose)],
    ["Day range", quote.dayLow != null && quote.dayHigh != null ? `${fmt(quote.dayLow)} – ${fmt(quote.dayHigh)}` : "—"],
    ["52-wk range", quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null ? `${fmt(quote.fiftyTwoWeekLow)} – ${fmt(quote.fiftyTwoWeekHigh)}` : "—"],
    ["Volume", quote.volume == null ? "—" : quote.volume >= 1e6 ? `${(quote.volume / 1e6).toFixed(2)}M` : fmt(quote.volume, 0)],
    ["Exchange", quote.exchange ?? "—"],
    ["Market", quote.isMarketOpen == null ? "—" : quote.isMarketOpen ? "Open" : "Closed"],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-line pb-6">
        <div>
          <p className="font-mono text-sm text-ink-3">{quote.symbol}</p>
          <h2 className="font-serif text-2xl text-ink">{quote.name ?? quote.symbol}</h2>
        </div>
        <div className="font-mono">
          <p className="text-3xl text-ink">
            {quote.currency ? `${quote.currency} ` : ""}
            {fmt(quote.price)}
          </p>
          <p className={`text-sm ${up ? "text-up" : "text-down"}`}>
            {quote.change != null ? `${up ? "+" : ""}${fmt(quote.change)}` : "—"}{" "}
            {quote.percentChange != null
              ? `(${up ? "+" : ""}${quote.percentChange.toFixed(2)}%)`
              : ""}
          </p>
        </div>
        <p className="ml-auto text-xs text-ink-3">
          {labels.updated} {time} HKT ·{" "}
          {quote.entitlement === "end-of-day" ? labels.endOfDay : labels.delayed}
        </p>
      </div>

      {closes.length > 1 && (
        <figure className="mt-8">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`${quote.symbol} 90-day closing price chart`}
            className="w-full"
          >
            <path
              d={path}
              fill="none"
              stroke={closes[closes.length - 1] >= closes[0] ? "var(--up)" : "var(--down)"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <figcaption className="mt-2 text-xs text-ink-3">
            90 days · daily close · {quote.currency ?? ""} · Twelve Data ·{" "}
            {labels.updated} {time} HKT
          </figcaption>
        </figure>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 font-mono text-sm sm:grid-cols-3 lg:grid-cols-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] uppercase tracking-wider text-ink-3">{k}</dt>
            <dd className="mt-0.5 text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
