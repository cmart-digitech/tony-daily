import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  authorizedEmails,
  createSessionToken,
  googleAuthConfigured,
  SESSION_COOKIE,
  verifyOauthState,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function loginRedirect(origin: string, error: string): NextResponse {
  const url = new URL("/login", origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

/**
 * GET /api/auth/google/callback — complete the code flow.
 *
 * The id_token arrives directly from Google's token endpoint over TLS, so
 * decoding its payload without a separate signature check is sound here.
 * The allowlist is the actual authorisation: any Google account not in
 * AUTHORIZED_EMAILS is refused, whoever they are.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!googleAuthConfigured()) return loginRedirect(origin, "not-configured");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !(await verifyOauthState(state))) {
    return loginRedirect(origin, "state");
  }

  // Exchange the code for tokens.
  let idToken: string | undefined;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: new URL("/api/auth/google/callback", origin).toString(),
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return loginRedirect(origin, "exchange");
    const data = (await res.json()) as { id_token?: string };
    idToken = data.id_token;
  } catch {
    return loginRedirect(origin, "exchange");
  }
  if (!idToken) return loginRedirect(origin, "exchange");

  // Decode the identity payload.
  let email: string | undefined;
  let name: string | undefined;
  let picture: string | undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"),
    ) as { email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (payload.email_verified === false) return loginRedirect(origin, "unverified");
    email = payload.email?.toLowerCase();
    name = payload.name;
    picture = payload.picture;
  } catch {
    return loginRedirect(origin, "token");
  }
  if (!email || !authorizedEmails().includes(email)) {
    return loginRedirect(origin, "not-authorised");
  }

  // Record the user (single-user today; allowlist-ready for more).
  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();
  if (existing) {
    await db
      .update(schema.users)
      .set({ name: name ?? existing.name, picture: picture ?? existing.picture, lastLoginAt: Date.now() })
      .where(eq(schema.users.id, existing.id))
      .run();
  } else {
    await db
      .insert(schema.users)
      .values({ email, name: name ?? null, picture: picture ?? null, createdAt: Date.now(), lastLoginAt: Date.now() })
      .run();
  }

  const { token, maxAgeSeconds } = await createSessionToken();
  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
  return res;
}
