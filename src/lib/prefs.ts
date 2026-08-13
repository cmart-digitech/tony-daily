import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export interface InterestWeights {
  markets: number;
  property: number;
  architecture: number;
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

export interface Preferences {
  onboarded: boolean;
  language: "en" | "zh" | "both";
  theme: "light" | "dark" | "system";
  briefingTime: string; // "07:00"
  timezone: string;
  interests: InterestWeights;
  rankWeights: RankWeights;
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
};

export async function getPreferences(): Promise<Preferences> {
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
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
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
