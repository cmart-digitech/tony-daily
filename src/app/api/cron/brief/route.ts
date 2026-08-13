import { NextRequest, NextResponse } from "next/server";
import { generateDailyBrief } from "@/lib/brief";
import { runIngest } from "@/lib/ingest";
import { sendBriefToTelegram } from "@/lib/notify/telegram";
import { translateRecentHeadlines } from "@/lib/ai/translate";
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
    // Once daily, here rather than per-ingest: headline translation shares
    // the free AI quota with chat, summaries and facts extraction.
    await translateRecentHeadlines(20);
    const brief = await generateDailyBrief();

    // Optional morning delivery — configured deployments only.
    const tz = process.env.APP_TIMEZONE ?? "Asia/Hong_Kong";
    const dateLabel = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, weekday: "long", day: "numeric", month: "long",
    }).format(new Date());
    const delivery = await sendBriefToTelegram(brief.content, dateLabel);

    return NextResponse.json({ ok: true, dateKey: brief.dateKey, telegram: delivery });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Brief generation failed." },
      { status: 500 },
    );
  }
}
