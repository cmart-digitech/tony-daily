import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  authEnabled,
  createSessionToken,
  passwordMatches,
  verifySessionToken,
} from "@/lib/auth";

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {
    DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
    CRON_SECRET: process.env.CRON_SECRET,
  };
  process.env.DASHBOARD_PASSWORD = "correct-horse-battery";
  process.env.CRON_SECRET = "test-cron-secret";
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("authEnabled", () => {
  it("is on when a password is configured", () => {
    expect(authEnabled()).toBe(true);
  });
  it("is off when no password is configured — the app stays open", () => {
    delete process.env.DASHBOARD_PASSWORD;
    expect(authEnabled()).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("accepts the configured password", async () => {
    expect(await passwordMatches("correct-horse-battery")).toBe(true);
  });
  it("rejects a wrong password", async () => {
    expect(await passwordMatches("wrong")).toBe(false);
  });
  it("rejects everything when no password is configured", async () => {
    delete process.env.DASHBOARD_PASSWORD;
    expect(await passwordMatches("anything")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a freshly created token", async () => {
    const { token } = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const past = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const { token } = await createSessionToken(past);
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("rejects a tampered expiry", async () => {
    const { token } = await createSessionToken();
    const [, sig] = token.split(".");
    const farFuture = Date.now() + 1000 * 24 * 60 * 60 * 1000;
    expect(await verifySessionToken(`${farFuture}.${sig}`)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const { token } = await createSessionToken();
    const [exp, sig] = token.split(".");
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    expect(await verifySessionToken(`${exp}.${flipped}`)).toBe(false);
  });

  it("rejects garbage and empty tokens", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
    expect(await verifySessionToken("no-dot")).toBe(false);
    expect(await verifySessionToken(".only-sig")).toBe(false);
  });

  it("invalidates existing sessions when the password changes", async () => {
    const { token } = await createSessionToken();
    process.env.DASHBOARD_PASSWORD = "a-new-password";
    expect(await verifySessionToken(token)).toBe(false);
  });
});
