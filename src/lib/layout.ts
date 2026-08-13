import type { ArticleRow } from "@/lib/retrieval";

/**
 * Visual ordering helpers.
 *
 * These affect the ARRANGEMENT of stories that ranking has already selected —
 * never which stories are selected, and never whether one appears at all.
 * Relevance decides what Tony sees; these decide where it sits on the page,
 * so photo-led sections read evenly instead of scattering text-only cards
 * through the grid.
 */

/** A story counts as illustrated only if it has a real, authentic image. */
export function hasImage(a: ArticleRow): boolean {
  return Boolean(a.imageUrl);
}

/**
 * Group illustrated stories ahead of text-only ones, preserving the ranked
 * order inside each group. Stable: two illustrated stories keep their
 * relative ranking.
 *
 * Used only in photo-led grids (Property, Architecture, and the visual
 * sections of the Daily Brief). Dense text lists — the markets rail,
 * "more for you", search results — keep pure relevance order, because a
 * missing photo says nothing about how important a story is.
 */
export function imageFirst(articles: ArticleRow[]): ArticleRow[] {
  const withImage: ArticleRow[] = [];
  const withoutImage: ArticleRow[] = [];
  for (const a of articles) (hasImage(a) ? withImage : withoutImage).push(a);
  return [...withImage, ...withoutImage];
}

/**
 * Choose the lead story for a photo-led page.
 *
 * Prefers the best-ranked illustrated story, but will not reach far down the
 * ranking for a picture: if nothing in the top `window` has an image, the
 * top-ranked story leads without one rather than promoting a minor item on
 * the strength of a photograph.
 */
export function pickLead(articles: ArticleRow[], window = 5): ArticleRow | undefined {
  if (articles.length === 0) return undefined;
  const illustrated = articles.slice(0, window).find(hasImage);
  return illustrated ?? articles[0];
}
