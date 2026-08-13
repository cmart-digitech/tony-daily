import { NextRequest, NextResponse } from "next/server";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Gate every page and API behind the session cookie when a dashboard
 * password is configured. Exemptions:
 * - /login and /api/auth/*: the way in
 * - /api/cron/*: machine endpoints with their own CRON_SECRET bearer auth
 * - /api/health: deployment diagnostics, deliberately reachable (reports
 *   booleans and error messages only, never secrets)
 */
const OPEN_PREFIXES = ["/login", "/api/auth/", "/api/cron/", "/api/health"];

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname !== "/" ? `?from=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
