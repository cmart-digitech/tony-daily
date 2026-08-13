import { NextRequest, NextResponse } from "next/server";
import { isMarketDataConfigured, MarketDataError, searchSymbols } from "@/lib/market";

export const dynamic = "force-dynamic";

/** GET /api/symbols?q=tencent — provider symbol search for watchlist adding. */
export async function GET(req: NextRequest) {
  if (!isMarketDataConfigured()) {
    return NextResponse.json({ ok: false, configured: false, results: [] });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return NextResponse.json({ ok: true, configured: true, results: [] });
  }
  try {
    const results = await searchSymbols(q);
    return NextResponse.json({ ok: true, configured: true, results: results.slice(0, 12) });
  } catch (err) {
    const kind = err instanceof MarketDataError ? err.kind : "provider-error";
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        kind,
        error: err instanceof Error ? err.message : "Search unavailable.",
        results: [],
      },
      { status: 502 },
    );
  }
}
