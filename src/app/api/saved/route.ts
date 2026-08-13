import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const saved = await db.select().from(schema.savedArticles).all();
  const articles = saved.length
    ? await db
        .select()
        .from(schema.articles)
        .where(inArray(schema.articles.id, saved.map((s) => s.articleId)))
        .all()
    : [];
  const savedAt = new Map(saved.map((s) => [s.articleId, s.savedAt]));
  return NextResponse.json({
    ok: true,
    articles: articles
      .map((a) => ({ ...a, savedAt: savedAt.get(a.id) ?? 0 }))
      .sort((a, b) => b.savedAt - a.savedAt),
  });
}

const BodySchema = z.object({ articleId: z.number() });

export async function POST(req: NextRequest) {
  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const db = await getDb();
  const article = await db
    .select({ id: schema.articles.id })
    .from(schema.articles)
    .where(eq(schema.articles.id, body.data.articleId))
    .get();
  if (!article) {
    return NextResponse.json({ ok: false, error: "Article not found." }, { status: 404 });
  }
  const existing = await db
    .select()
    .from(schema.savedArticles)
    .where(eq(schema.savedArticles.articleId, body.data.articleId))
    .get();
  if (!existing) {
    await db
      .insert(schema.savedArticles)
      .values({ articleId: body.data.articleId, savedAt: Date.now() })
      .run();
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("articleId"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "articleId is required" }, { status: 400 });
  }
  const db = await getDb();
  await db.delete(schema.savedArticles).where(eq(schema.savedArticles.articleId, id)).run();
  return NextResponse.json({ ok: true });
}
