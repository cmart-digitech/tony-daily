/**
 * Quick local integrity check of the SQLite index.
 *   node scripts/check-db.mjs
 */
import Database from "better-sqlite3";

const db = new Database(process.env.DATABASE_URL ?? "./data/tonydaily.db");
const one = (sql) => db.prepare(sql).get().c;

console.log("articles:", one("select count(*) c from articles"));
console.log("clusters:", one("select count(*) c from story_clusters"));
console.log("entities:", one("select count(*) c from article_entities"));
console.log(
  "clustered articles:",
  one("select count(*) c from articles where cluster_id is not null"),
);
console.log(
  db
    .prepare("select verification_status, count(*) c from articles group by verification_status")
    .all(),
);
console.log("sync errors:", one("select count(*) c from sync_logs where status = 'error'"));
console.log(
  "duplicate urls:",
  one(
    "select count(*) c from (select canonical_url from articles group by canonical_url having count(*) > 1)",
  ),
);
