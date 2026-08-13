import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authEnabled,
  createSessionToken,
  passwordMatches,
  SESSION_COOKIE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

// In-process brute-force throttle: a private single-user dashboard sees a
// handful of legitimate attempts, ever.
let windowStart = Date.now();
let attempts = 0;
const MAX_ATTEMPTS_PER_MINUTE = 5;

const BodySchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Authentication is not configured on this deployment." },
      { status: 400 },
    );
  }

  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    attempts = 0;
  }
  if (++attempts > MAX_ATTEMPTS_PER_MINUTE) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Password required." }, { status: 400 });
  }

  if (!(await passwordMatches(body.data.password))) {
    return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
  }

  const { token, maxAgeSeconds } = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
  return res;
}
