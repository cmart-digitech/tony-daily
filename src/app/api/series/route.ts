import { NextRequest, NextResponse } from "next/server";
import { getCachedSeries, isMarketDataConfigured, MarketDataError } from "@/lib/market";

export const dynamic = "force-dynamic";

/** GET /api/series?symbol=0700.HK&interval=1day */
export async function GET(req: NextRequest) {
  if (!isMarketDataConfigured()) {
    return NextResponse.json({ ok: false, configured: false });
  }
  const symbol = req.nextUrl.searchParams.get("symbol");
  const interval = req.nextUrl.searchParams.get("interval") ?? "1day";
  if (!symbol) {
    return NextResponse.json({ ok: false, error: "symbol is required" }, { status: 400 });
  }
  try {
    const series = await getCachedSeries(symbol, interval, 90);
    return NextResponse.json({ ok: true, configured: true, series });
  } catch (err) {
    const kind = err instanceof MarketDataError ? err.kind : "provider-error";
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        kind,
        error: err instanceof Error ? err.message : "Series unavailable.",
      },
      { status: 502 },
    );
  }
}
