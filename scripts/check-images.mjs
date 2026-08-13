/**
 * Image coverage per source — shows how much the Open Graph enrichment has
 * filled in.
 *   node scripts/check-images.mjs
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/tonydaily.db");

const rows = db
  .prepare(
    `select source_id,
            count(*) as total,
            sum(case when image_url is not null then 1 else 0 end) as with_image
     from articles group by source_id order by source_id`,
  )
  .all();

console.log("source                      images   coverage");
for (const r of rows) {
  const pct = Math.round((r.with_image / r.total) * 100);
  console.log(
    `  ${r.source_id.padEnd(26)}${String(r.with_image).padStart(3)}/${String(r.total).padEnd(4)} ${pct}%`,
  );
}

const overall = db
  .prepare(
    "select count(*) total, sum(case when image_url is not null then 1 else 0 end) with_image from articles",
  )
  .get();
console.log(
  `\noverall: ${overall.with_image}/${overall.total} (${Math.round(
    (overall.with_image / overall.total) * 100,
  )}%)`,
);

const sample = db
  .prepare(
    "select source_id, image_url from articles where source_id like 'rthk%' and image_url is not null limit 3",
  )
  .all();
if (sample.length) {
  console.log("\nsample enriched RTHK images:");
  for (const s of sample) console.log(`  ${s.image_url.slice(0, 100)}`);
}
