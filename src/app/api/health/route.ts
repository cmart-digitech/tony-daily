import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { aiModelId, aiProviderLabel, isAiConfigured } from "@/lib/ai";
import { authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — deployment diagnostics.
 *
 * Reports which integrations are configured and whether the database is
 * reachable. Returns booleans and error *messages* only — never secret
 * values — so it is safe to open in a browser while setting a deployment up.
 */
export async function GET() {
  const config = {
    database: process.env.TURSO_DATABASE_URL
      ? "turso"
      : ("local-sqlite" as const),
    tursoUrlSet: Boolean(process.env.TURSO_DATABASE_URL),
    tursoTokenSet: Boolean(process.env.TURSO_AUTH_TOKEN),
    cronSecretSet: Boolean(process.env.CRON_SECRET),
    authEnabled: authEnabled(),
    aiConfigured: isAiConfigured(),
    aiProvider: aiProviderLabel(),
    aiModel: isAiConfigured() ? aiModelId() : null,
    marketDataConfigured: Boolean(process.env.TWELVE_DATA_API_KEY),
    timezone: process.env.APP_TIMEZONE ?? "Asia/Hong_Kong",
  };

  try {
    const db = await getDb();
    const articles = await db.select({ id: schema.articles.id }).from(schema.articles).all();
    const prefs = await db.select().from(schema.userPreferences).all();
    return NextResponse.json({
      ok: true,
      databaseReachable: true,
      articleCount: articles.length,
      onboarded: prefs.length > 0,
      config,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        databaseReachable: false,
        error: err instanceof Error ? err.message : "Unknown database error.",
        hint: config.tursoUrlSet
          ? "TURSO_DATABASE_URL is set but the database could not be reached. Check the URL and that TURSO_AUTH_TOKEN is a current, non-revoked token."
          : "No hosted database is configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the hosting provider's environment variables, then redeploy.",
        config,
      },
      { status: 503 },
    );
  }
}
