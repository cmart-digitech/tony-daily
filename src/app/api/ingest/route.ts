import { NextRequest, NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Minimal in-process throttle for UI-triggered refreshes.
let lastUiRun = 0;
const UI_MIN_INTERVAL_MS = 60_000;

/**
 * POST /api/ingest
 * - With a valid CRON_SECRET (header `x-cron-secret` or `?secret=`): forced run.
 * - Without: treated as a UI refresh — throttled here, and per-source
 *   cooldowns inside runIngest keep us polite to publishers.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  const isCron = Boolean(secret && provided && provided === secret);

  if (!isCron) {
    const now = Date.now();
    if (now - lastUiRun < UI_MIN_INTERVAL_MS) {
      return NextResponse.json(
        { ok: false, error: "Refresh throttled. Try again in a minute." },
        { status: 429 },
      );
    }
    lastUiRun = now;
  }

  try {
    const results = await runIngest({ force: isCron });
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Ingestion failed." },
      { status: 500 },
    );
  }
}
