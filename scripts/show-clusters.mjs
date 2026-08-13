/**
 * Print the current story clusters so merges can be eyeballed for accuracy.
 *   node scripts/show-clusters.mjs
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/tonydaily.db");
const rows = db
  .prepare(
    "select cluster_id, source_id, original_title, verification_status from articles where cluster_id is not null order by cluster_id",
  )
  .all();

const byCluster = new Map();
for (const r of rows) {
  if (!byCluster.has(r.cluster_id)) byCluster.set(r.cluster_id, []);
  byCluster.get(r.cluster_id).push(r);
}
for (const [id, members] of byCluster) {
  console.log(`\n── cluster ${id} (${members.length} sources, ${members[0].verification_status})`);
  for (const m of members) console.log(`   [${m.source_id}] ${m.original_title}`);
}
