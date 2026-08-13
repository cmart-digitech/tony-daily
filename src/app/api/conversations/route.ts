import { NextRequest, NextResponse } from "next/server";
import { desc, eq, like, or, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { searchConversations } from "@/lib/search/fts";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations — the Ask Tony library.
 * ?q= searches message content (FTS for Latin, LIKE fallback for CJK);
 * ?archived=1 lists archived conversations instead of active ones.
 */
export async function GET(req: NextRequest) {
  const db = await getDb();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const archived = req.nextUrl.searchParams.get("archived") === "1";

  let matchIds: number[] | null = null;
  if (q) {
    matchIds = await searchConversations(q);
    if (matchIds.length === 0) {
      // CJK queries (or FTS-less builds): match message or title text directly.
      const rows = await db
        .select({ id: schema.chatMessages.conversationId })
        .from(schema.chatMessages)
        .where(like(schema.chatMessages.content, `%${q}%`))
        .all();
      const titleRows = await db
        .select({ id: schema.chatConversations.id })
        .from(schema.chatConversations)
        .where(or(like(schema.chatConversations.title, `%${q}%`)))
        .all();
      matchIds = [...new Set([...rows.map((r) => r.id), ...titleRows.map((r) => r.id)])];
    }
    if (matchIds.length === 0) return NextResponse.json({ ok: true, conversations: [] });
  }

  const conversations = await db
    .select()
    .from(schema.chatConversations)
    .where(
      matchIds
        ? inArray(schema.chatConversations.id, matchIds)
        : eq(schema.chatConversations.archived, archived),
    )
    .orderBy(desc(schema.chatConversations.id))
    .limit(100)
    .all();

  // Message counts in one query.
  const ids = conversations.map((c) => c.id);
  const counts = new Map<number, number>();
  if (ids.length) {
    const messages = await db
      .select({ conversationId: schema.chatMessages.conversationId })
      .from(schema.chatMessages)
      .where(inArray(schema.chatMessages.conversationId, ids))
      .all();
    for (const m of messages) counts.set(m.conversationId, (counts.get(m.conversationId) ?? 0) + 1);
  }

  const list = conversations
    .map((c) => ({ ...c, messageCount: counts.get(c.id) ?? 0 }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
  return NextResponse.json({ ok: true, conversations: list });
}
