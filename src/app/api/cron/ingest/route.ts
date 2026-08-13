import { NextRequest, NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";
import { authorizeCron } from "../auth";

export const dynamic = "force-dynamic";
// Feed ingestion fans out over ~18 feeds; allow headroom on serverless.
export const maxDuration = 300;

/**
 * GET /api/cron/ingest — scheduled news ingestion.
 * Auth: `Authorization: Bearer $CRON_SECRET` (Vercel cron sends this
 * automatically when CRON_SECRET is set) or `x-cron-secret` header /
 * `?secret=` query (for external schedulers like cron-job.org).
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCron(req);
  if (auth) return auth;
  try {
    const results = await runIngest({ force: false });
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Ingestion failed." },
      { status: 500 },
    );
  }
}
