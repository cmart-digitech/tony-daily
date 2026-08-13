import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const items = (await db.select().from(schema.watchlistItems).all()).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
  );
  return NextResponse.json({ ok: true, items });
}

const AddSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  exchange: z.string().max(40).nullish(),
  currency: z.string().max(10).nullish(),
  instrumentType: z.string().max(40).nullish(),
});

export async function POST(req: NextRequest) {
  const body = AddSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid symbol payload." }, { status: 400 });
  }
  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.symbol, body.data.symbol))
    .get();
  if (existing) {
    return NextResponse.json({ ok: true, item: existing, existed: true });
  }
  const maxOrder = (await db.select().from(schema.watchlistItems).all()).reduce(
    (m, i) => Math.max(m, i.sortOrder),
    0,
  );
  const inserted = await db
    .insert(schema.watchlistItems)
    .values({
      symbol: body.data.symbol,
      name: body.data.name,
      exchange: body.data.exchange ?? null,
      currency: body.data.currency ?? null,
      instrumentType: body.data.instrumentType ?? null,
      sortOrder: maxOrder + 1,
      addedAt: Date.now(),
    })
    .run();
  const item = await db
    .select()
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.id, Number(inserted.lastInsertRowid)))
    .get();
  return NextResponse.json({ ok: true, item });
}

const PatchSchema = z.object({
  id: z.number(),
  favourite: z.boolean().optional(),
  grp: z.string().max(60).nullable().optional(),
  move: z.enum(["up", "down"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const db = await getDb();
  const item = await db
    .select()
    .from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.id, body.data.id))
    .get();
  if (!item) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (body.data.favourite !== undefined || body.data.grp !== undefined) {
    await db
      .update(schema.watchlistItems)
      .set({
        ...(body.data.favourite !== undefined ? { favourite: body.data.favourite } : {}),
        ...(body.data.grp !== undefined ? { grp: body.data.grp } : {}),
      })
      .where(eq(schema.watchlistItems.id, item.id))
      .run();
  }
  if (body.data.move) {
    const all = (await db.select().from(schema.watchlistItems).all()).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
    );
    const idx = all.findIndex((i) => i.id === item.id);
    const swapWith = body.data.move === "up" ? all[idx - 1] : all[idx + 1];
    if (swapWith) {
      // Normalise orders to indices first so swaps are always meaningful.
      for (let i = 0; i < all.length; i++) {
        if (all[i].sortOrder !== i) {
          await db
            .update(schema.watchlistItems)
            .set({ sortOrder: i })
            .where(eq(schema.watchlistItems.id, all[i].id))
            .run();
        }
      }
      const a = body.data.move === "up" ? idx - 1 : idx;
      const b = a + 1;
      await db
        .update(schema.watchlistItems)
        .set({ sortOrder: b })
        .where(eq(schema.watchlistItems.id, all[a].id))
        .run();
      await db
        .update(schema.watchlistItems)
        .set({ sortOrder: a })
        .where(eq(schema.watchlistItems.id, all[b].id))
        .run();
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }
  const db = await getDb();
  await db.delete(schema.watchlistItems).where(eq(schema.watchlistItems.id, id)).run();
  return NextResponse.json({ ok: true });
}
