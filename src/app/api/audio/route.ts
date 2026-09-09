import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { audioFormatAvailability, generateAudioBrief } from "@/lib/ai/audio";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

let windowStart = Date.now();
let count = 0;
const LIMIT = 6; // generations per minute — scripts are cached per day/format

/** GET /api/audio — the audio library, newest first. */
export async function GET() {
  const db = await getDb();
  const episodes = await db
    .select()
    .from(schema.audioBriefs)
    .orderBy(desc(schema.audioBriefs.id))
    .limit(60)
    .all();
  return NextResponse.json({ ok: true, episodes });
}

const GenerateSchema = z.object({
  format: z.enum(["quick", "morning", "deep", "dialogue"]),
  language: z.enum(["en", "zh-HK", "bilingual"]),
  regenerate: z.boolean().optional(),
});

/** POST /api/audio — generate (or fetch today's cached) episode. */
export async function POST(req: NextRequest) {
  const body = GenerateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    count = 0;
  }
  if (++count > LIMIT) {
    return NextResponse.json(
      { ok: false, error: "Too many generations. Try again shortly." },
      { status: 429 },
    );
  }
  // Hiding the button is a courtesy; this is the guarantee. A format whose
  // script the current provider cannot finish is refused outright rather
  // than half-generated and stored as if it were a whole briefing.
  const capacity = audioFormatAvailability().find((a) => a.format === body.data.format);
  if (capacity && !capacity.available) {
    return NextResponse.json(
      {
        ok: false,
        reason: "insufficient-capacity",
        error:
          "That briefing is longer than the AI can complete right now. " +
          "Shorter formats still work, and this one returns once capacity recovers.",
      },
      { status: 503 },
    );
  }

  const result = await generateAudioBrief(body.data);
  if (!result.brief) {
    // Reason codes are for diagnostics; `error` is what a reader sees.
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason ?? "unknown",
        error: humanReason(result.reason),
      },
      { status: result.reason === "ai-not-configured" ? 200 : 502 },
    );
  }
  return NextResponse.json({ ok: true, episode: result.brief });
}

function humanReason(reason?: string): string {
  switch (reason) {
    case "ai-not-configured":
      return "Audio briefings need an AI provider key. Add one and redeploy.";
    case "no-verified-stories":
      return "No verified stories yet today — refresh the brief first.";
    case "empty-script":
      return "The model returned no usable script. Please try again.";
    default:
      break;
  }
  if (!reason || reason.length < 4) return "Audio could not be generated.";
  // Belt and braces: never let a raw payload reach the page, however a
  // provider chose to phrase its failure.
  if (/[{}[\]]|"error"/.test(reason)) {
    return "Audio could not be generated — the AI provider returned an error.";
  }
  return reason.length > 200 ? `${reason.slice(0, 200)}…` : reason;
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }
  const db = await getDb();
  await db.delete(schema.audioBriefs).where(eq(schema.audioBriefs.id, id)).run();
  return NextResponse.json({ ok: true });
}
