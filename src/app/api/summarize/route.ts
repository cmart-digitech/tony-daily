import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { isAiConfigured, summarizeArticle } from "@/lib/ai";
import { clusterMembers, toContext } from "@/lib/retrieval";
import { contentHash } from "@/lib/ingest/text";

export const dynamic = "force-dynamic";

// Basic in-process rate limiting for the AI endpoint.
let windowStart = Date.now();
let count = 0;
const LIMIT = 20; // per minute

const BodySchema = z.object({
  articleId: z.number(),
  level: z.enum(["30s", "2min", "deep"]),
  language: z.enum(["en", "zh-HK"]),
});

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: "AI is not configured. Set ANTHROPIC_API_KEY.",
    });
  }
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    count = 0;
  }
  if (++count > LIMIT) {
    return NextResponse.json(
      { ok: false, error: "Too many AI requests. Please wait a moment." },
      { status: 429 },
    );
  }

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
  // Summarise the whole cluster so all reporting on the story is considered.
  const members = await clusterMembers(article);
  const hash = contentHash([
    "cluster",
    ...members.map((m) => m.contentHash).sort(),
  ]);
  try {
    const summary = await summarizeArticle({
      contentHash: hash,
      articles: members.map(toContext),
      level: body.data.level,
      language: body.data.language,
    });
    return NextResponse.json({
      ok: true,
      summary,
      sources: members.map((m) => ({
        id: m.id,
        sourceId: m.sourceId,
        title: m.originalTitle,
        url: m.canonicalUrl,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Summarisation failed." },
      { status: 502 },
    );
  }
}
