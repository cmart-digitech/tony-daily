/**
 * Open Graph image enrichment.
 *
 * Several publishers (notably RTHK) omit images from their RSS feed even
 * though the article page carries an og:image. Fetching that preview image
 * is the second step of the product's image priority list, after an
 * authentic feed image and before any placeholder.
 *
 * Rules observed here:
 * - only the publisher's own declared preview image is used, never a
 *   substitute or generated picture
 * - one polite request per article, capped bytes, short timeout
 * - failures are silent and simply leave the article without an image
 */

const FETCH_TIMEOUT_MS = 8_000;
/** Preview metadata lives in <head>; no need to download entire pages. */
const MAX_BYTES = 120_000;

const OG_PATTERNS: RegExp[] = [
  /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
];

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/** Read at most MAX_BYTES of the response, then stop. */
async function readHead(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, MAX_BYTES);
  const decoder = new TextDecoder();
  let html = "";
  try {
    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break; // everything we need has arrived
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return html;
}

/**
 * Fetch a page's Open Graph preview image. Returns an absolute URL, or null
 * when the publisher declares none.
 */
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": "TonyDaily/0.1 (personal news dashboard)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return null;

    const html = await readHead(res);
    for (const pattern of OG_PATTERNS) {
      const match = html.match(pattern);
      if (!match?.[1]) continue;
      const raw = decodeEntities(match[1].trim());
      if (!raw || raw.startsWith("data:")) continue;
      // Resolve protocol-relative and root-relative URLs against the page.
      const absolute = new URL(raw, res.url || pageUrl).toString();
      if (!/^https?:/i.test(absolute)) continue;
      return absolute;
    }
    return null;
  } catch {
    return null; // an image is optional; never fail ingestion over one
  }
}

/** Resolve several pages at once, with bounded concurrency. */
export async function fetchOgImages(
  pages: { id: number; url: string }[],
  concurrency = 4,
): Promise<Map<number, string>> {
  const found = new Map<number, string>();
  for (let i = 0; i < pages.length; i += concurrency) {
    const chunk = pages.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(async (p) => ({ id: p.id, image: await fetchOgImage(p.url) })),
    );
    for (const r of results) if (r.image) found.set(r.id, r.image);
  }
  return found;
}
