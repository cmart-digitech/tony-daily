import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/alerts — alerts with their most recent trigger event. */
export async function GET() {
  const db = await getDb();
  const alerts = await db
    .select()
    .from(schema.stockAlerts)
    .orderBy(desc(schema.stockAlerts.id))
    .all();
  const events = alerts.length
    ? await db
        .select()
        .from(schema.alertEvents)
        .where(inArray(schema.alertEvents.alertId, alerts.map((a) => a.id)))
        .orderBy(desc(schema.alertEvents.id))
        .limit(50)
        .all()
    : [];
  const latest = new Map<number, (typeof events)[number]>();
  for (const e of events) if (!latest.has(e.alertId)) latest.set(e.alertId, e);
  return NextResponse.json({
    ok: true,
    alerts: alerts.map((a) => ({ ...a, lastEvent: latest.get(a.id) ?? null })),
  });
}

const CreateSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  kind: z.enum(["above", "below", "move_pct"]),
  threshold: z.number().positive().finite(),
});

/** POST — alerts exist only by explicit user instruction (brief §39). */
export async function POST(req: NextRequest) {
  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid alert." }, { status: 400 });
  }
  const db = await getDb();
  await db
    .insert(schema.stockAlerts)
    .values({
      symbol: body.data.symbol.toUpperCase(),
      kind: body.data.kind,
      threshold: body.data.threshold,
      createdAt: Date.now(),
    })
    .run();
  return NextResponse.json({ ok: true });
}

const PatchSchema = z.object({ id: z.number(), enabled: z.boolean() });

export async function PATCH(req: NextRequest) {
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  const db = await getDb();
  await db
    .update(schema.stockAlerts)
    .set({ enabled: body.data.enabled })
    .where(eq(schema.stockAlerts.id, body.data.id))
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  }
  const db = await getDb();
  await db.delete(schema.alertEvents).where(eq(schema.alertEvents.alertId, id)).run();
  await db.delete(schema.stockAlerts).where(eq(schema.stockAlerts.id, id)).run();
  return NextResponse.json({ ok: true });
}
