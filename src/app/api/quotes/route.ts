import { NextRequest, NextResponse } from "next/server";
import { getCachedQuote, isMarketDataConfigured, MarketDataError } from "@/lib/market";

export const dynamic = "force-dynamic";

/** GET /api/quotes?symbols=0700.HK,AAPL — quotes with per-symbol error states. */
export async function GET(req: NextRequest) {
  if (!isMarketDataConfigured()) {
    return NextResponse.json({ ok: false, configured: false, quotes: [] });
  }
  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  if (symbols.length === 0) {
    return NextResponse.json({ ok: true, configured: true, quotes: [] });
  }
  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        return { symbol, ok: true as const, quote: await getCachedQuote(symbol) };
      } catch (err) {
        const kind = err instanceof MarketDataError ? err.kind : "provider-error";
        const message = err instanceof Error ? err.message : "Quote unavailable.";
        return { symbol, ok: false as const, error: message, kind };
      }
    }),
  );
  return NextResponse.json({ ok: true, configured: true, quotes });
}
