"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Quote } from "@/lib/market/types";

type QuoteResult =
  | { symbol: string; ok: true; quote: Quote }
  | { symbol: string; ok: false; error: string; kind: string };

/** Compact watchlist module for the TODAY page. Honest states only. */
export default function WatchlistMini({
  symbols,
  labels,
}: {
  symbols: string[];
  labels: { unavailable: string; notConfigured: string; empty: string; updated: string; delayed: string };
}) {
  const [quotes, setQuotes] = useState<QuoteResult[] | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(symbols.slice(0, 8).join(","))}`,
        );
        const data = await res.json();
        if (!cancelled) {
          setConfigured(data.configured !== false);
          setQuotes(data.quotes ?? []);
        }
      } catch {
        if (!cancelled) setQuotes([]);
      }
    };
    load();
    const id = setInterval(load, 90_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbols]);

  if (symbols.length === 0) {
    return (
      <p className="text-sm text-ink-3">
        {labels.empty}{" "}
        <Link href="/watchlist" className="underline underline-offset-2 hover:text-accent">
          →
        </Link>
      </p>
    );
  }
  if (!configured) {
    return <p className="text-sm text-ink-3">{labels.notConfigured}</p>;
  }
  if (quotes === null) {
    return <div className="skeleton h-24 w-full rounded" />;
  }

  const good = quotes.filter((q): q is Extract<QuoteResult, { ok: true }> => q.ok);
  const newest = good.length ? Math.max(...good.map((g) => g.quote.fetchedAt)) : null;

  return (
    <div>
      <ul className="divide-y divide-line">
        {quotes.map((q) => (
          <li key={q.symbol} className="flex items-baseline justify-between gap-4 py-2 font-mono text-sm">
            <Link
              href={`/watchlist/${encodeURIComponent(q.symbol)}`}
              className="text-ink hover:text-accent"
            >
              {q.symbol}
            </Link>
            {q.ok && q.quote.price != null ? (
              <span className="flex items-baseline gap-3">
                <span className="text-ink">
                  {q.quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span
                  className={`w-16 text-right ${(q.quote.percentChange ?? 0) >= 0 ? "text-up" : "text-down"}`}
                >
                  {q.quote.percentChange != null
                    ? `${q.quote.percentChange >= 0 ? "+" : ""}${q.quote.percentChange.toFixed(2)}%`
                    : "—"}
                </span>
              </span>
            ) : (
              <span className="text-xs text-ink-3">{labels.unavailable}</span>
            )}
          </li>
        ))}
      </ul>
      {newest && (
        <p className="mt-2 text-[11px] text-ink-3">
          {labels.updated}{" "}
          {new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Hong_Kong",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(newest))}{" "}
          HKT · {labels.delayed}
        </p>
      )}
    </div>
  );
}
