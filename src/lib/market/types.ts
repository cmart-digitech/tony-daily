/**
 * Provider-agnostic market data contracts. Adapters (e.g. Twelve Data) map
 * their payloads into these shapes; nothing outside src/lib/market should
 * know which provider is connected.
 */

export type Entitlement = "real-time" | "delayed" | "end-of-day" | "unknown";

export interface Quote {
  symbol: string;
  name: string | null;
  exchange: string | null;
  currency: string | null;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  isMarketOpen: boolean | null;
  /** When the provider produced this quote (epoch ms), if known. */
  asOf: number | null;
  /** When we fetched it (epoch ms). Always present — drives "Updated HH:mm". */
  fetchedAt: number;
  /** Conservative entitlement label; never claim real-time unless certain. */
  entitlement: Entitlement;
}

export interface TimeSeriesBar {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface TimeSeries {
  symbol: string;
  interval: string;
  bars: TimeSeriesBar[]; // ascending by time
  currency: string | null;
  fetchedAt: number;
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string | null;
  country: string | null;
  currency: string | null;
  instrumentType: string | null;
}

export interface MarketDataProvider {
  readonly id: string;
  getQuote(symbol: string): Promise<Quote>;
  getTimeSeries(symbol: string, interval: string, outputSize: number): Promise<TimeSeries>;
  searchSymbol(query: string): Promise<SymbolSearchResult[]>;
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly kind: "not-configured" | "rate-limited" | "not-found" | "provider-error",
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}
