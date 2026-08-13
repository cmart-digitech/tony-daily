/**
 * Diagnostic: compare headline-similarity metrics on the real index to
 * calibrate the clustering threshold.
 *   node scripts/cluster-probe.mjs
 *
 * Compares plain Jaccard against IDF-weighted containment, which handles
 * terse-government vs verbose-media headline pairs and discounts generic
 * tokens ("hong", "kong", "new") that inflate naive similarity.
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/tonydaily.db");

function normalizeTitle(t) {
  return t
    .toLowerCase()
    .replace(/[‘’'"“”]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokenize(text) {
  const n = normalizeTitle(text);
  if (/[一-鿿]/.test(n)) {
    const chars = n.replace(/\s+/g, "");
    const g = [];
    for (let i = 0; i < chars.length - 1; i++) g.push(chars.slice(i, i + 2));
    return g;
  }
  return n.split(" ").filter((w) => w.length > 2);
}
function jaccard(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let i = 0;
  for (const t of ta) if (tb.has(t)) i++;
  return i / (ta.size + tb.size - i);
}

const rows = db
  .prepare("select id, source_id, original_title, original_language from articles")
  .all();

// Build document frequency over the corpus.
const df = new Map();
for (const r of rows) {
  for (const t of new Set(tokenize(r.original_title))) {
    df.set(t, (df.get(t) ?? 0) + 1);
  }
}
const N = rows.length;
const idf = (t) => Math.log((N + 1) / ((df.get(t) ?? 0) + 1)) + 1;

/** IDF-weighted containment: shared信息 / information of the shorter headline. */
function weighted(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += idf(t);
  const wa = [...ta].reduce((s, t) => s + idf(t), 0);
  const wb = [...tb].reduce((s, t) => s + idf(t), 0);
  const smaller = Math.min(wa, wb);
  return smaller > 0 ? inter / smaller : 0;
}

const pairs = [];
for (let i = 0; i < rows.length; i++) {
  for (let j = i + 1; j < rows.length; j++) {
    if (rows[i].source_id === rows[j].source_id) continue;
    if (rows[i].original_language !== rows[j].original_language) continue;
    const w = weighted(rows[i].original_title, rows[j].original_title);
    if (w >= 0.3) {
      const ta = new Set(tokenize(rows[i].original_title));
      const tb = new Set(tokenize(rows[j].original_title));
      let shared = 0;
      for (const t of ta) if (tb.has(t)) shared++;
      pairs.push({
        w,
        shared,
        min: Math.min(ta.size, tb.size),
        j: jaccard(rows[i].original_title, rows[j].original_title),
        a: rows[i],
        b: rows[j],
      });
    }
  }
}
// Apply the production guards: ≥3 shared tokens and ≥3 tokens per headline.
const eligible = pairs.filter((p) => p.shared >= 3 && p.min >= 3);
pairs.sort((x, y) => y.w - x.w);
eligible.sort((x, y) => y.w - x.w);
console.log(`cross-source same-language pairs with weighted >= 0.30: ${pairs.length}`);
console.log(`  after shared-token guards: ${eligible.length}`);
for (const th of [0.8, 0.75, 0.7, 0.65, 0.62, 0.6, 0.55]) {
  console.log(`  eligible & weighted >= ${th}: ${eligible.filter((p) => p.w >= th).length}`);
}
console.log("\nEligible pairs ranked by IDF-weighted containment (jac = plain Jaccard):");
for (const p of eligible.slice(0, 20)) {
  console.log(
    `w=${p.w.toFixed(3)} jac=${p.j.toFixed(3)} shared=${p.shared}\n   [${p.a.source_id}] ${p.a.original_title}\n   [${p.b.source_id}] ${p.b.original_title}`,
  );
}
