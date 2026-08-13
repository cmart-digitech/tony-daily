import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { SOURCES } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

/** GET /api/sources — registry + live sync state for the admin panel. */
export async function GET() {
  const db = await getDb();
  const states = await db.select().from(schema.sourceState).all();
  const stateMap = new Map(states.map((s) => [s.sourceId, s]));
  const sources = SOURCES.map((s) => {
    const st = stateMap.get(s.id);
    return {
      id: s.id,
      name: s.name,
      language: s.language,
      type: s.type.toUpperCase(),
      tier: s.tier,
      authority: s.authority,
      categories: s.categories,
      homepage: s.homepage,
      enabled: st ? st.enabled : s.enabled,
      lastSyncAt: st?.lastSyncAt ?? null,
      lastStatus: st?.lastStatus ?? null,
      lastError: st?.lastError ?? null,
      lastItemCount: st?.lastItemCount ?? null,
    };
  });
  return NextResponse.json({ ok: true, sources });
}

const PatchSchema = z.object({ id: z.string(), enabled: z.boolean() });

export async function PATCH(req: NextRequest) {
  const body = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  if (!SOURCES.some((s) => s.id === body.data.id)) {
    return NextResponse.json({ ok: false, error: "Unknown source." }, { status: 404 });
  }
  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.sourceState)
    .where(eq(schema.sourceState.sourceId, body.data.id))
    .get();
  if (existing) {
    await db
      .update(schema.sourceState)
      .set({ enabled: body.data.enabled })
      .where(eq(schema.sourceState.sourceId, body.data.id))
      .run();
  } else {
    await db
      .insert(schema.sourceState)
      .values({ sourceId: body.data.id, enabled: body.data.enabled })
      .run();
  }
  return NextResponse.json({ ok: true });
}
