import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { answerQuestion, isAiConfigured } from "@/lib/ai";
import { extractQuerySymbols, searchArticles, toContext } from "@/lib/retrieval";
import { getCachedQuote, isMarketDataConfigured } from "@/lib/market";
import type { Quote } from "@/lib/market/types";

export const dynamic = "force-dynamic";

let windowStart = Date.now();
let count = 0;
const LIMIT = 15; // per minute

const BodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.number().nullish(),
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
      { ok: false, error: "Too many messages. Please wait a moment." },
      { status: 429 },
    );
  }

  const body = BodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid message." }, { status: 400 });
  }
  const db = await getDb();

  let conversationId = body.data.conversationId ?? null;
  if (conversationId) {
    const conv = await db
      .select()
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.id, conversationId))
      .get();
    if (!conv) conversationId = null;
  }
  if (!conversationId) {
    const created = await db
      .insert(schema.chatConversations)
      .values({ title: body.data.message.slice(0, 80), createdAt: Date.now() })
      .run();
    conversationId = Number(created.lastInsertRowid);
  }

  const history = (
    await db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.conversationId, conversationId))
      .all()
  )
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  await db
    .insert(schema.chatMessages)
    .values({
      conversationId,
      role: "user",
      content: body.data.message,
      createdAt: Date.now(),
    })
    .run();

  // Retrieval before generation: indexed news + (if relevant) market data.
  const articles = (await searchArticles(body.data.message, 12)).map(toContext);
  const quotes: Quote[] = [];
  if (isMarketDataConfigured()) {
    const watchlist = await db.select().from(schema.watchlistItems).all();
    const symbols = extractQuerySymbols(
      body.data.message,
      watchlist.map((w) => w.symbol),
    );
    for (const symbol of symbols.slice(0, 6)) {
      try {
        quotes.push(await getCachedQuote(symbol));
      } catch {
        // Quote unavailable — the model is told market data is missing.
      }
    }
  }

  try {
    const { text, citations } = await answerQuestion({
      question: body.data.message,
      articles,
      quotes,
      history,
    });
    await db
      .insert(schema.chatMessages)
      .values({
        conversationId,
        role: "assistant",
        content: text,
        citations: JSON.stringify(citations),
        createdAt: Date.now(),
      })
      .run();
    return NextResponse.json({ ok: true, conversationId, text, citations });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Chat failed." },
      { status: 502 },
    );
  }
}
