import type { InterestWeights, RankWeights } from "@/lib/prefs";

export interface ScorableArticle {
  category: string;
  region: "hk" | "china" | "apac" | "global";
  authority: number; // 0–100 from source config
  publishedAt: number | null; // epoch ms
  corroborationCount: number; // other sources reporting the same story
  watchlistMatch: boolean; // mentions a watched company/ticker
  isNovel: boolean; // first story in its cluster
}

const GEO_SCORE: Record<ScorableArticle["region"], number> = {
  hk: 100,
  china: 75,
  apac: 55,
  global: 45,
};

/**
 * Transparent relevance score (0–100).
 * Weighted sum of: personal interest match, source authority, recency decay,
 * geographic priority, corroboration, novelty. Weights are user-configurable.
 * Deliberately ignores engagement/clickbait signals.
 */
export function scoreArticle(
  a: ScorableArticle,
  interests: InterestWeights,
  weights: RankWeights,
  now: number = Date.now(),
): number {
  const interest =
    interests[a.category as keyof InterestWeights] ?? interests.general;
  // Watchlist relationship is part of personal relevance.
  const relevance = Math.min(100, interest + (a.watchlistMatch ? 25 : 0));

  const authority = Math.max(0, Math.min(100, a.authority));

  // Recency: full score < 3h old, exponential half-life of 12h, floor 0.
  let recency = 0;
  if (a.publishedAt) {
    const ageHours = Math.max(0, (now - a.publishedAt) / 3_600_000);
    recency = ageHours <= 3 ? 100 : 100 * Math.pow(0.5, (ageHours - 3) / 12);
  }

  const geography = GEO_SCORE[a.region];
  const corroboration = Math.min(100, a.corroborationCount * 34);
  const novelty = a.isNovel ? 100 : 30;

  const score =
    weights.relevance * relevance +
    weights.authority * authority +
    weights.recency * recency +
    weights.geography * geography +
    weights.corroboration * corroboration +
    weights.novelty * novelty;

  return Math.round(score * 100) / 100;
}
