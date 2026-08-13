import { NextRequest, NextResponse } from "next/server";
import { generateDailyBrief } from "@/lib/brief";
import { runIngest } from "@/lib/ingest";
import { authorizeCron } from "../auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/brief — scheduled morning-brief generation (freshens feeds
 * first, then rebuilds today's brief). Auth as in ../auth.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCron(req);
  if (auth) return auth;
  try {
    await runIngest({ force: false });
    const brief = await generateDailyBrief();
    return NextResponse.json({ ok: true, dateKey: brief.dateKey });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Brief generation failed." },
      { status: 500 },
    );
  }
}
