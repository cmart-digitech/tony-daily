import { NextRequest, NextResponse } from "next/server";

/**
 * Shared auth for cron endpoints. Returns a 401 response when the request
 * is not authorised, or null when it may proceed.
 *
 * Accepted credentials (any one):
 * - `Authorization: Bearer $CRON_SECRET` (Vercel cron sets this automatically)
 * - `x-cron-secret: $CRON_SECRET` or `?secret=$CRON_SECRET` (external schedulers)
 *
 * If CRON_SECRET is not configured, cron endpoints refuse to run — a public
 * deployment must not expose unauthenticated ingestion triggers.
 */
export function authorizeCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 401 },
    );
  }
  const bearer = req.headers.get("authorization");
  const provided =
    (bearer?.startsWith("Bearer ") ? bearer.slice(7) : null) ??
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorised." }, { status: 401 });
  }
  return null;
}
