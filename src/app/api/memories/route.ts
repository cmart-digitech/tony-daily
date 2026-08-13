import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * What Tony Daily Remembers (brief §23): explicit, user-controlled
 * preferences for the assistant. Nothing is written here except through
 * these endpoints — the system never silently builds a profile.
 */

export async function GET() {
  const db = await getDb();
  const memories = await db
    .select()
    .from(schema.userMemories)
    .orderBy(desc(schema.userMemories.updatedAt))
    .all();
  return NextResponse.json({ ok: true, memories });
}

const CreateSchema = z.object({
  content: z.string().trim().min(1).max(500),
  category: z.enum(["markets", "property", "architecture", "art", "general"]).nullish(),
});

export async function POST(req: NextRequest) {
  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid memory." }, { status: 400 });
  }
  const db = await getDb();
  const now = Date.now();
  await db
    .insert(schema.userMemories)
    .values({
      content: body.data.content,
      category: body.data.category ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  return NextResponse.json({ ok: true });
}

const PatchSchema = z.object({
  id: z.number(),
  content: z.string().trim().min(1).max(500),
});

export async function PATCH(req: NextRequest) {
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const db = await getDb();
  await db
    .update(schema.userMemories)
    .set({ content: body.data.content, updatedAt: Date.now() })
    .where(eq(schema.userMemories.id, body.data.id))
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }
  const db = await getDb();
  await db.delete(schema.userMemories).where(eq(schema.userMemories.id, id)).run();
  return NextResponse.json({ ok: true });
}
