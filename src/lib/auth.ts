/**
 * Session authentication for the dashboard.
 *
 * Single-user password gate: `DASHBOARD_PASSWORD` enables it, a successful
 * login sets an HMAC-signed, expiring cookie, and Next.js middleware checks
 * that cookie on every request. Built on Web Crypto only, so it runs in the
 * edge runtime as well as Node.
 *
 * Honest fallback: with no password configured the app stays OPEN and
 * /api/health reports `authEnabled: false`. A misconfigured deployment must
 * not lock Tony out — and must not pretend to be protected when it is not.
 *
 * Cron and health endpoints are never cookie-gated; they keep their own
 * CRON_SECRET bearer auth (see src/app/api/cron/auth.ts).
 */

export const SESSION_COOKIE = "td_session";
const SESSION_DAYS = 30;

const encoder = new TextEncoder();

export function authEnabled(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

/**
 * Key material mixes the password with CRON_SECRET so changing either
 * invalidates existing sessions.
 */
function keyMaterial(): string {
  return `td-auth:${process.env.DASHBOARD_PASSWORD ?? ""}:${process.env.CRON_SECRET ?? ""}`;
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyMaterial()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(message));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compare via digests so timing does not leak how much of a guess matched. */
export async function passwordMatches(input: string): Promise<boolean> {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256Hex(input), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Token format: `<expiryEpochMs>.<hmac(expiry)>` */
export async function createSessionToken(
  now: number = Date.now(),
): Promise<{ token: string; maxAgeSeconds: number }> {
  const expiry = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sig = await hmacHex(String(expiry));
  return { token: `${expiry}.${sig}`, maxAgeSeconds: SESSION_DAYS * 24 * 60 * 60 };
}

export async function verifySessionToken(
  token: string | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiryPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  const expiry = Number(expiryPart);
  if (!Number.isFinite(expiry) || expiry < now) return false;
  const expected = await hmacHex(expiryPart);
  if (sigPart.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sigPart.charCodeAt(i);
  }
  return diff === 0;
}
