import { NextRequest, NextResponse } from "next/server";
import { createOauthState, googleAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google — begin the authorization-code flow.
 *
 * Scopes are identity only (openid email profile). Google Drive access is a
 * deliberately separate, later consent (brief §5) — signing in never
 * requests Drive.
 */
export async function GET(req: NextRequest) {
  if (!googleAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Google Sign-In is not configured on this deployment." },
      { status: 400 },
    );
  }
  const redirectUri = new URL("/api/auth/google/callback", req.nextUrl.origin).toString();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", await createOauthState());
  url.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(url);
}
