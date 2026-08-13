import {
  MarketDataError,
  type MarketDataProvider,
  type Quote,
  type SymbolSearchResult,
  type TimeSeries,
} from "./types";

const BASE = "https://api.twelvedata.com";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface TdError {
  status?: string;
  code?: number;
  message?: string;
}

/**
 * Twelve Data adapter. API key stays server-side; callers go through
 * src/lib/market/index.ts which adds caching and rate-limit protection.
 * Entitlement is conservatively labelled "delayed" — Twelve Data does not
 * assert real-time entitlement in quote payloads, so we never claim it.
 */
export class TwelveDataProvider implements MarketDataProvider {
  readonly id = "twelvedata";

  constructor(private readonly apiKey: string) {}

  private async call<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("apikey", this.apiKey);

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new MarketDataError("Market data provider unreachable.", "provider-error");
    }
    if (!res.ok) {
      throw new MarketDataError(`Provider HTTP ${res.status}`, "provider-error");
    }
    const data = (await res.json()) as T & TdError;
    if (data && typeof data === "object" && "status" in data && data.status === "error") {
      const code = data.code ?? 0;
      if (code === 429) throw new MarketDataError("Rate limit reached.", "rate-limited");
      if (code === 404 || code === 400) {
        throw new MarketDataError(data.message ?? "Symbol not found.", "not-found");
      }
      throw new MarketDataError(data.message ?? "Provider error.", "provider-error");
    }
    return data;
  }

  async getQuote(symbol: string): Promise<Quote> {
    interface TdQuote {
      symbol?: string; name?: string; exchange?: string; currency?: string;
      open?: string; high?: string; low?: string; close?: string;
      previous_close?: string; change?: string; percent_change?: string;
      volume?: string; timestamp?: number;
      is_market_open?: boolean;
      fifty_two_week?: { low?: string; high?: string };
    }
    const q = await this.call<TdQuote>("/quote", { symbol });
    return {
      symbol: q.symbol ?? symbol,
      name: q.name ?? null,
      exchange: q.exchange ?? null,
      currency: q.currency ?? null,
      price: num(q.close),
      change: num(q.change),
      percentChange: num(q.percent_change),
      previousClose: num(q.previous_close),
      open: num(q.open),
      dayHigh: num(q.high),
      dayLow: num(q.low),
      volume: num(q.volume),
      fiftyTwoWeekLow: num(q.fifty_two_week?.low),
      fiftyTwoWeekHigh: num(q.fifty_two_week?.high),
      isMarketOpen: typeof q.is_market_open === "boolean" ? q.is_market_open : null,
      asOf: q.timestamp ? q.timestamp * 1000 : null,
      fetchedAt: Date.now(),
      entitlement: "delayed",
    };
  }

  async getTimeSeries(symbol: string, interval: string, outputSize: number): Promise<TimeSeries> {
    interface TdSeries {
      meta?: { currency?: string };
      values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[];
    }
    const s = await this.call<TdSeries>("/time_series", {
      symbol,
      interval,
      outputsize: String(outputSize),
    });
    const bars = (s.values ?? [])
      .map((v) => ({
        time: Date.parse(v.datetime),
        open: num(v.open) ?? 0,
        high: num(v.high) ?? 0,
        low: num(v.low) ?? 0,
        close: num(v.close) ?? 0,
        volume: num(v.volume),
      }))
      .filter((b) => Number.isFinite(b.time))
      .sort((a, b) => a.time - b.time);
    return {
      symbol,
      interval,
      bars,
      currency: s.meta?.currency ?? null,
      fetchedAt: Date.now(),
    };
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    interface TdSearch {
      data?: {
        symbol: string; instrument_name: string; exchange: string;
        country: string; currency: string; instrument_type: string;
      }[];
    }
    const s = await this.call<TdSearch>("/symbol_search", { symbol: query });
    return (s.data ?? []).map((d) => ({
      symbol: d.symbol,
      name: d.instrument_name,
      exchange: d.exchange || null,
      country: d.country || null,
      currency: d.currency || null,
      instrumentType: d.instrument_type || null,
    }));
  }
}
