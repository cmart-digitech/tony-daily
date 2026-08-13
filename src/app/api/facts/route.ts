import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { factsApplicable, getOrExtractFacts } from "@/lib/ai/facts";
import { isAiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

let windowStart = Date.now();
let count = 0;
const LIMIT = 10; // per minute — extraction is cached, so bursts are first-view only

const BodySchema = z.object({ articleId: z.number() });

/** POST /api/facts — cached structured facts for a built-environment story. */
export async function POST(req: NextRequest) {
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const db = await getDb();
  const article = await db
    .select()
    .from(schema.articles)
    .where(eq(schema.articles.id, body.data.articleId))
    .get();
  if (!article) {
    return NextResponse.json({ ok: false, error: "Article not found." }, { status: 404 });
  }
  if (!factsApplicable(article)) {
    return NextResponse.json({ ok: true, facts: null, applicable: false });
  }
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: true, facts: null, configured: false });
  }

  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    count = 0;
  }
  if (++count > LIMIT) {
    return NextResponse.json(
      { ok: false, error: "Too many extractions. Try again shortly." },
      { status: 429 },
    );
  }

  const facts = await getOrExtractFacts(article);
  return NextResponse.json({ ok: true, facts });
}
