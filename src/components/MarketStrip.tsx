"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/market/types";

/**
 * Restrained Bloomberg-inspired strip. Only symbols the provider actually
 * returns are rendered — missing data is never faked. HSI/major indexes may
 * be unavailable on free market-data plans; the strip simply omits them.
 */
const STRIP_SYMBOLS = ["HSI", "SPX", "IXIC", "USD/HKD"];

type QuoteResult =
  | { symbol: string; ok: true; quote: Quote }
  | { symbol: string; ok: false; error: string; kind: string };

export default function MarketStrip() {
  const [state, setState] = useState<{
    configured: boolean;
    quotes: QuoteResult[];
    loaded: boolean;
  }>({ configured: true, quotes: [], loaded: false });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(STRIP_SYMBOLS.join(","))}`);
        const data = await res.json();
        if (!cancelled) {
          setState({
            configured: data.configured !== false,
            quotes: data.quotes ?? [],
            loaded: true,
          });
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loaded: true }));
      }
    };
    load();
    const id = setInterval(load, 90_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const good = state.quotes.filter(
    (q): q is Extract<QuoteResult, { ok: true }> => q.ok && q.quote.price != null,
  );

  if (!state.loaded || !state.configured || good.length === 0) return null;

  const newest = Math.max(...good.map((q) => q.quote.fetchedAt));
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(newest));

  return (
    <div className="border-b border-line bg-elevated">
      <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-1.5 font-mono text-xs sm:px-6">
        {good.map(({ quote }) => {
          const up = (quote.percentChange ?? 0) >= 0;
          return (
            <span key={quote.symbol} className="flex shrink-0 items-baseline gap-2">
              <span className="text-ink-3">{quote.symbol}</span>
              <span className="text-ink">
                {quote.price!.toLocaleString("en-US", {
                  minimumFractionDigits: quote.symbol.includes("/") ? 4 : 2,
                  maximumFractionDigits: quote.symbol.includes("/") ? 4 : 2,
                })}
              </span>
              {quote.percentChange != null && (
                <span className={up ? "text-up" : "text-down"}>
                  {up ? "+" : ""}
                  {quote.percentChange.toFixed(2)}%
                </span>
              )}
            </span>
          );
        })}
        <span className="ml-auto shrink-0 text-ink-3">
          {time} HKT · Delayed
        </span>
      </div>
    </div>
  );
}
