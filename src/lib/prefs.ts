import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export interface InterestWeights {
  markets: number;
  property: number;
  architecture: number;
  art: number;
  infrastructure: number;
  government: number;
  hk: number;
  china: number;
  world: number;
  general: number;
}

export interface RankWeights {
  relevance: number;
  authority: number;
  recency: number;
  geography: number;
  corroboration: number;
  novelty: number;
}

/** Reading Comfort (brief §24–25): adapts the design, never replaces it. */
export interface ComfortSettings {
  textSize: "normal" | "large" | "xlarge" | "max";
  lineSpacing: "compact" | "comfortable" | "spacious";
  density: "compact" | "comfortable" | "large";
  contrast: "standard" | "high";
  articleWidth: "standard" | "focused" | "wide";
  motion: "standard" | "reduced";
  comfortMode: boolean;
}

export interface Preferences {
  onboarded: boolean;
  language: "en" | "zh" | "both";
  theme: "light" | "dark" | "system";
  briefingTime: string; // "07:00"
  timezone: string;
  interests: InterestWeights;
  rankWeights: RankWeights;
  comfort: ComfortSettings;
  /** Epoch ms of the previous visit, for "Since your last visit". */
  lastVisitAt: number | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  onboarded: false,
  language: "en",
  theme: "system",
  briefingTime: "07:00",
  timezone: process.env.APP_TIMEZONE ?? "Asia/Hong_Kong",
  interests: {
    markets: 90,
    property: 80,
    architecture: 80,
    art: 70,
    infrastructure: 60,
    government: 55,
    hk: 85,
    china: 60,
    world: 50,
    general: 40,
  },
  rankWeights: {
    relevance: 0.3,
    authority: 0.25,
    recency: 0.2,
    geography: 0.1,
    corroboration: 0.1,
    novelty: 0.05,
  },
  comfort: {
    textSize: "normal",
    lineSpacing: "comfortable",
    density: "comfortable",
    contrast: "standard",
    articleWidth: "standard",
    motion: "standard",
    comfortMode: false,
  },
  lastVisitAt: null,
};

/**
 * Preferences are read by the layout and again by most pages; `cache`
 * collapses that into a single query per request.
 */
export const getPreferences = cache(async function getPreferences(): Promise<Preferences> {
  const db = await getDb();
  const row = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.key, "preferences"))
    .get();
  if (!row) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(row.value) as Partial<Preferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      interests: { ...DEFAULT_PREFERENCES.interests, ...parsed.interests },
      rankWeights: { ...DEFAULT_PREFERENCES.rankWeights, ...parsed.rankWeights },
      comfort: { ...DEFAULT_PREFERENCES.comfort, ...parsed.comfort },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
});

/**
 * Track dashboard visits for "Since your last visit". Returns the PREVIOUS
 * visit time (null on first visit) and refreshes the marker only after a
 * 30-minute quiet gap, so a browsing session counts as one visit.
 */
export async function trackVisit(now: number = Date.now()): Promise<number | null> {
  const prefs = await getPreferences();
  const previous = prefs.lastVisitAt;
  if (!previous || now - previous > 30 * 60 * 1000) {
    void savePreferences({ lastVisitAt: now }).catch(() => {});
  }
  return previous;
}

export async function savePreferences(prefs: Partial<Preferences>): Promise<Preferences> {
  const db = await getDb();
  // Drop undefined values so a partial update never wipes stored settings.
  const clean = Object.fromEntries(
    Object.entries(prefs).filter(([, v]) => v !== undefined),
  ) as Partial<Preferences>;
  const merged = { ...(await getPreferences()), ...clean };
  const now = Date.now();
  const existing = await db
    .select()
    .from(schema.userPreferences)
    .where(eq(schema.userPreferences.key, "preferences"))
    .get();
  if (existing) {
    await db
      .update(schema.userPreferences)
      .set({ value: JSON.stringify(merged), updatedAt: now })
      .where(eq(schema.userPreferences.key, "preferences"))
      .run();
  } else {
    await db
      .insert(schema.userPreferences)
      .values({ key: "preferences", value: JSON.stringify(merged), updatedAt: now })
      .run();
  }
  return merged;
}
