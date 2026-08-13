import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPreferences, savePreferences } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, preferences: await getPreferences() });
}

const WeightsSchema = z
  .object({
    markets: z.number().min(0).max(100),
    property: z.number().min(0).max(100),
    architecture: z.number().min(0).max(100),
    infrastructure: z.number().min(0).max(100),
    government: z.number().min(0).max(100),
    hk: z.number().min(0).max(100),
    china: z.number().min(0).max(100),
    world: z.number().min(0).max(100),
    general: z.number().min(0).max(100),
  })
  .partial();

const PrefsSchema = z.object({
  onboarded: z.boolean().optional(),
  language: z.enum(["en", "zh", "both"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  briefingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  interests: WeightsSchema.optional(),
  rankWeights: z
    .object({
      relevance: z.number().min(0).max(1),
      authority: z.number().min(0).max(1),
      recency: z.number().min(0).max(1),
      geography: z.number().min(0).max(1),
      corroboration: z.number().min(0).max(1),
      novelty: z.number().min(0).max(1),
    })
    .partial()
    .optional(),
});

export async function PUT(req: NextRequest) {
  const body = PrefsSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, error: "Invalid preferences." }, { status: 400 });
  }
  const current = await getPreferences();
  const merged = await savePreferences({
    ...body.data,
    interests: body.data.interests
      ? { ...current.interests, ...body.data.interests }
      : undefined,
    rankWeights: body.data.rankWeights
      ? { ...current.rankWeights, ...body.data.rankWeights }
      : undefined,
  });
  return NextResponse.json({ ok: true, preferences: merged });
}
