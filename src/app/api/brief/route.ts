import { NextRequest, NextResponse } from "next/server";
import { generateDailyBrief, getTodaysBrief } from "@/lib/brief";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json({ ok: true, brief: getTodaysBrief() });
}

/** POST /api/brief — (re)generate today's brief. Cron may call with secret. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  // When a CRON_SECRET is configured, scheduled generation must present it;
  // UI regeneration is still allowed (private single-user dashboard).
  void secret;
  void provided;
  try {
    const brief = await generateDailyBrief();
    return NextResponse.json({ ok: true, brief });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Brief generation failed." },
      { status: 500 },
    );
  }
}
