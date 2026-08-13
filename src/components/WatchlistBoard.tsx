"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Quote, SymbolSearchResult } from "@/lib/market/types";
import Sparkline from "./Sparkline";

interface WatchItem {
  id: number;
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string | null;
  favourite: boolean;
  sortOrder: number;
}

type QuoteResult =
  | { symbol: string; ok: true; quote: Quote }
  | { symbol: string; ok: false; error: string; kind: string };

interface Labels {
  searchTicker: string;
  addStock: string;
  remove: string;
  favourite: string;
  empty: string;
  notConfigured: string;
  unavailable: string;
  delayed: string;
  updated: string;
  disclaimer: string;
}

/**
 * Full watchlist: symbol search + add, quotes with honest entitlement
 * labels, sparklines, favourite/reorder/remove. Starts empty by design —
 * no invented portfolio.
 */
export default function WatchlistBoard({
  marketConfigured,
  labels,
}: {
  marketConfigured: boolean;
  labels: Labels;
}) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [quotes, setQuotes] = useState<Map<string, QuoteResult>>(new Map());
  const [series, setSeries] = useState<Map<string, number[]>>(new Map());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/watchlist");
    const data = await res.json();
    if (data.ok) setItems(data.items);
    setLoaded(true);
    return data.items as WatchItem[];
  }, []);

  const loadQuotes = useCallback(
    async (list: WatchItem[]) => {
      if (!marketConfigured || list.length === 0) return;
      const symbols = list.map((i) => i.symbol).join(",");
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`);
        const data = await res.json();
        if (data.ok) {
          setQuotes(new Map((data.quotes as QuoteResult[]).map((q) => [q.symbol, q])));
        }
      } catch {
        // keep last known quotes; their timestamps show staleness
      }
      for (const item of list.slice(0, 8)) {
        if (series.has(item.symbol)) continue;
        try {
          const res = await fetch(`/api/series?symbol=${encodeURIComponent(item.symbol)}`);
          const data = await res.json();
          if (data.ok && data.series?.bars?.length) {
            setSeries((s) =>
              new Map(s).set(
                item.symbol,
                data.series.bars.slice(-30).map((b: { close: number }) => b.close),
              ),
            );
          }
        } catch {
          // chart simply not shown
        }
      }
    },
    [marketConfigured, series],
  );

  useEffect(() => {
    loadItems().then(loadQuotes);
    const id = setInterval(async () => {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      if (data.ok) {
        setItems(data.items);
        loadQuotes(data.items);
      }
    }, 90_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = (q: string) => {
    setQuery(q);
    setSearchError(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/symbols?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.ok) setResults(data.results);
        else setSearchError(data.error ?? labels.unavailable);
      } catch {
        setSearchError(labels.unavailable);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const add = async (r: SymbolSearchResult) => {
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
    setQuery("");
    setResults([]);
    const list = await loadItems();
    loadQuotes(list);
  };

  const mutate = async (payload: Record<string, unknown>) => {
    await fetch("/api/watchlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    loadItems();
  };

  const remove = async (id: number) => {
    await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
    loadItems();
  };

  const fmtTime = (ts: number) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Hong_Kong",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));

  const sorted = [...items].sort(
    (a, b) =>
      Number(b.favourite) - Number(a.favourite) || a.sortOrder - b.sortOrder || a.id - b.id,
  );

  return (
    <div>
      {marketConfigured ? (
        <div className="relative mb-8 max-w-xl">
          <label htmlFor="symbol-search" className="sr-only">
            {labels.searchTicker}
          </label>
          <input
            id="symbol-search"
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder={labels.searchTicker}
            className="w-full border border-line-2 bg-elevated px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          {(results.length > 0 || searching || searchError) && query && (
            <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto border border-line-2 bg-elevated shadow-lg">
              {searching && <li className="px-4 py-2 text-sm text-ink-3">…</li>}
              {searchError && <li className="px-4 py-2 text-sm text-down">{searchError}</li>}
              {results.map((r) => (
                <li key={`${r.symbol}-${r.exchange}`}>
                  <button
                    type="button"
                    onClick={() => add(r)}
                    className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span className="font-mono text-sm text-ink">{r.symbol}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{r.name}</span>
                    <span className="text-xs text-ink-3">{r.exchange}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mb-8 border border-line bg-subtle px-4 py-3 text-sm text-ink-2">
          {labels.notConfigured}
        </p>
      )}

      {loaded && items.length === 0 && (
        <p className="border border-dashed border-line-2 px-6 py-12 text-center text-sm text-ink-2">
          {labels.empty}
        </p>
      )}

      <ul className="divide-y divide-line border-y border-line">
        {sorted.map((item, idx) => {
          const q = quotes.get(item.symbol);
          const quote = q?.ok ? q.quote : null;
          const up = (quote?.percentChange ?? 0) >= 0;
          const closes = series.get(item.symbol);
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
              <div className="w-40 min-w-0">
                <Link
                  href={`/watchlist/${encodeURIComponent(item.symbol)}`}
                  className="font-mono text-sm font-semibold text-ink hover:text-accent"
                >
                  {item.symbol}
                </Link>
                <p className="truncate text-xs text-ink-3">{item.name}</p>
              </div>
              <div className="w-40 text-right font-mono">
                {quote?.price != null ? (
                  <>
                    <p className="text-sm text-ink">
                      {quote.currency ? `${quote.currency} ` : ""}
                      {quote.price.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p className={`text-xs ${up ? "text-up" : "text-down"}`}>
                      {quote.percentChange != null
                        ? `${up ? "+" : ""}${quote.percentChange.toFixed(2)}%`
                        : "—"}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-ink-3">
                    {marketConfigured ? (q && !q.ok ? labels.unavailable : "…") : "—"}
                  </p>
                )}
              </div>
              <div className="hidden sm:block">
                {closes && closes.length > 1 && (
                  <Sparkline points={closes} positive={closes[closes.length - 1] >= closes[0]} />
                )}
              </div>
              {quote && (
                <p className="hidden text-[11px] text-ink-3 md:block">
                  {labels.updated} {fmtTime(quote.fetchedAt)} HKT ·{" "}
                  {quote.entitlement === "delayed" ? labels.delayed : quote.entitlement}
                </p>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`${labels.favourite} ${item.symbol}`}
                  aria-pressed={item.favourite}
                  onClick={() => mutate({ id: item.id, favourite: !item.favourite })}
                  className={`px-1.5 text-lg leading-none ${item.favourite ? "text-accent" : "text-ink-3 hover:text-accent"}`}
                >
                  {item.favourite ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.symbol} up`}
                  disabled={idx === 0}
                  onClick={() => mutate({ id: item.id, move: "up" })}
                  className="px-1 text-sm text-ink-3 hover:text-ink disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.symbol} down`}
                  disabled={idx === sorted.length - 1}
                  onClick={() => mutate({ id: item.id, move: "down" })}
                  className="px-1 text-sm text-ink-3 hover:text-ink disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="ml-2 text-xs text-ink-3 hover:text-down"
                >
                  {labels.remove}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {items.length > 0 && (
        <p className="mt-6 text-xs text-ink-3">{labels.disclaimer}</p>
      )}
    </div>
  );
}
