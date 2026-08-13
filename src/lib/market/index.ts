import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { TwelveDataProvider } from "./twelvedata";
import {
  MarketDataError,
  type MarketDataProvider,
  type Quote,
  type SymbolSearchResult,
  type TimeSeries,
} from "./types";

export * from "./types";

const QUOTE_CACHE_MS = 60_000; // respect provider rate limits
const SERIES_CACHE_MS = 15 * 60_000;

export function isMarketDataConfigured(): boolean {
  return Boolean(process.env.TWELVE_DATA_API_KEY);
}

export function getProvider(): MarketDataProvider {
  const providerId = process.env.MARKET_DATA_PROVIDER ?? "twelvedata";
  const key = process.env.TWELVE_DATA_API_KEY;
  if (providerId !== "twelvedata") {
    throw new MarketDataError(
      `Unknown MARKET_DATA_PROVIDER "${providerId}".`,
      "not-configured",
    );
  }
  if (!key) {
    throw new MarketDataError(
      "Market data is not configured. Set TWELVE_DATA_API_KEY.",
      "not-configured",
    );
  }
  return new TwelveDataProvider(key);
}

/** Quote with DB-backed cache; stale cache is served if the provider fails. */
export async function getCachedQuote(symbol: string): Promise<Quote> {
  const db = await getDb();
  const cached = await db
    .select()
    .from(schema.marketQuotes)
    .where(eq(schema.marketQuotes.symbol, symbol))
    .get();
  if (cached && Date.now() - cached.fetchedAt < QUOTE_CACHE_MS) {
    return JSON.parse(cached.data) as Quote;
  }
  try {
    const quote = await getProvider().getQuote(symbol);
    if (cached) {
      await db
        .update(schema.marketQuotes)
        .set({ data: JSON.stringify(quote), fetchedAt: quote.fetchedAt })
        .where(eq(schema.marketQuotes.symbol, symbol))
        .run();
    } else {
      await db
        .insert(schema.marketQuotes)
        .values({ symbol, data: JSON.stringify(quote), fetchedAt: quote.fetchedAt })
        .run();
    }
    return quote;
  } catch (err) {
    // Serve the stale-but-honest cached quote (its fetchedAt shows its age).
    if (cached) return JSON.parse(cached.data) as Quote;
    throw err;
  }
}

export async function getCachedSeries(
  symbol: string,
  interval = "1day",
  outputSize = 90,
): Promise<TimeSeries> {
  const db = await getDb();
  const cached = (
    await db
      .select()
      .from(schema.marketTimeSeries)
      .where(eq(schema.marketTimeSeries.symbol, symbol))
      .all()
  ).find((r) => r.interval === interval);
  if (cached && Date.now() - cached.fetchedAt < SERIES_CACHE_MS) {
    return JSON.parse(cached.data) as TimeSeries;
  }
  try {
    const series = await getProvider().getTimeSeries(symbol, interval, outputSize);
    if (cached) {
      await db
        .update(schema.marketTimeSeries)
        .set({ data: JSON.stringify(series), fetchedAt: series.fetchedAt })
        .where(eq(schema.marketTimeSeries.id, cached.id))
        .run();
    } else {
      await db
        .insert(schema.marketTimeSeries)
        .values({
          symbol,
          interval,
          data: JSON.stringify(series),
          fetchedAt: series.fetchedAt,
        })
        .run();
    }
    return series;
  } catch (err) {
    if (cached) return JSON.parse(cached.data) as TimeSeries;
    throw err;
  }
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  return getProvider().searchSymbol(query);
}
