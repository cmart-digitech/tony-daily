import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { removeConversationFromIndex } from "@/lib/search/fts";

export const dynamic = "force-dynamic";

async function conversationId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/** GET — full message history for one conversation. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const id = await conversationId(ctx.params);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  const db = await getDb();
  const conversation = await db
    .select()
    .from(schema.chatConversations)
    .where(eq(schema.chatConversations.id, id))
    .get();
  if (!conversation) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const messages = await db
    .select()
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.conversationId, id))
    .orderBy(asc(schema.chatMessages.id))
    .all();
  return NextResponse.json({ ok: true, conversation, messages });
}

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

/** PATCH — rename / pin / archive. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const id = await conversationId(ctx.params);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success || Object.keys(body.data).length === 0) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.chatConversations)
    .where(eq(schema.chatConversations.id, id))
    .get();
  if (!existing) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  await db
    .update(schema.chatConversations)
    .set(body.data)
    .where(eq(schema.chatConversations.id, id))
    .run();
  return NextResponse.json({ ok: true });
}

/** DELETE — conversation, its messages and its search-index rows. */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const id = await conversationId(ctx.params);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  const db = await getDb();
  await db.delete(schema.chatMessages).where(eq(schema.chatMessages.conversationId, id)).run();
  await db.delete(schema.chatConversations).where(eq(schema.chatConversations.id, id)).run();
  await removeConversationFromIndex(id);
  return NextResponse.json({ ok: true });
}
