import { NextRequest, NextResponse } from "next/server";
import { searchArticles } from "@/lib/retrieval";

export const dynamic = "force-dynamic";

/** GET /api/search?q=Kai+Tak — full-text search across indexed articles. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: true, results: [] });
  const results = await searchArticles(q, 30);
  return NextResponse.json({ ok: true, results });
}
