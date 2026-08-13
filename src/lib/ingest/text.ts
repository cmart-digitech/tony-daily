import crypto from "node:crypto";

/** Strip HTML tags/entities from feed excerpts. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#822[01];/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise a headline for duplicate comparison. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‘’'"“”]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenise for similarity. Chinese text falls back to character bigrams. */
export function tokenize(text: string): string[] {
  const normalized = normalizeTitle(text);
  const hasCjk = /[一-鿿]/.test(normalized);
  if (hasCjk) {
    const chars = normalized.replace(/\s+/g, "");
    const grams: string[] = [];
    for (let i = 0; i < chars.length - 1; i++) grams.push(chars.slice(i, i + 2));
    return grams;
  }
  return normalized.split(" ").filter((w) => w.length > 2);
}

/** Jaccard similarity between two token sets (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Minimum distinctive tokens a headline pair must share to be the same story. */
export const MIN_SHARED_TOKENS = 3;

/**
 * Build an inverse-document-frequency lookup over a corpus of headlines.
 * Common tokens ("hong", "kong", "new") get low weight; distinctive ones
 * ("consultation", "speedboats", "licences") get high weight.
 */
export function buildIdf(titles: string[]): (token: string) => number {
  const df = new Map<string, number>();
  for (const title of titles) {
    for (const t of new Set(tokenize(title))) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = titles.length;
  // Smoothed (+1 floor): a token present in every document still carries
  // weight, so two near-identical headlines alone in a window can match.
  return (token: string) => Math.log((n + 1) / ((df.get(token) ?? 0) + 1)) + 1;
}

export interface SimilarityVerdict {
  score: number;
  sharedTokens: number;
}

/**
 * IDF-weighted containment: shared information as a fraction of the
 * information in the *shorter* headline.
 *
 * Plain Jaccard fails on real news because publishers write the same event
 * at very different lengths — "Building laws consultation begins" (gov) vs
 * "Consultation on building management law reform begins" (RTHK) scores only
 * 0.43 — while generic geography tokens inflate unrelated pairs. Containment
 * handles the length asymmetry and IDF discounts the generic tokens.
 *
 * Calibrated against the live index: genuine same-event pairs score ≥0.62,
 * the strongest false pair scores 0.56.
 */
export function weightedSimilarity(
  a: string,
  b: string,
  idf: (token: string) => number,
): SimilarityVerdict {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return { score: 0, sharedTokens: 0 };

  let shared = 0;
  let interWeight = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      shared++;
      interWeight += idf(t);
    }
  }
  const weight = (set: Set<string>) => [...set].reduce((s, t) => s + idf(t), 0);
  const smaller = Math.min(weight(ta), weight(tb));
  return {
    score: smaller > 0 ? interWeight / smaller : 0,
    sharedTokens: shared,
  };
}

/** Stable content hash for dedupe + summary caching. */
export function contentHash(parts: (string | null | undefined)[]): string {
  return crypto
    .createHash("sha256")
    .update(parts.filter(Boolean).join("␟"))
    .digest("hex")
    .slice(0, 32);
}

/** Canonicalise a URL: drop tracking params, fragments, trailing slashes. */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const drop = [...u.searchParams.keys()].filter(
      (k) =>
        k.startsWith("utm_") ||
        ["fbclid", "gclid", "cmpid", "ref", "share", "s"].includes(k),
    );
    for (const k of drop) u.searchParams.delete(k);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}
