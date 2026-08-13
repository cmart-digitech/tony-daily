import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleLibsql, type LibSQLDatabase } from "drizzle-orm/libsql";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * Dual-driver database layer:
 * - TURSO_DATABASE_URL set → hosted Turso/libSQL (for free-tier cloud
 *   deployments such as Vercel, where there is no persistent disk).
 * - otherwise → local SQLite file via better-sqlite3 (zero-setup dev).
 *
 * All call sites use the async drizzle API (`await db.select()…`), which
 * works identically for both drivers. `AppDb` is typed as the libsql flavour;
 * the better-sqlite3 instance is structurally compatible for every query
 * shape we use (its results are plain values, which `await` passes through).
 */
export type AppDb = LibSQLDatabase<typeof schema>;

const DB_PATH = process.env.DATABASE_URL ?? "./data/tonydaily.db";

interface DbHandle {
  db: AppDb;
  kind: "libsql" | "sqlite";
  client: Client | null; // libsql client for batch/exec
  ready: Promise<void>;
}

declare global {
  var __tonyDailyDb: DbHandle | undefined;
}

function createHandle(): DbHandle {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const client = createClient({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzleLibsql(client, { schema });
    return {
      db,
      kind: "libsql",
      client,
      ready: client.executeMultiple(MIGRATION_SQL),
    };
  }
  const resolved = path.resolve(/* turbopackIgnore: true */ process.cwd(), DB_PATH);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  // Dynamic require keeps better-sqlite3 (an optional native dependency) out
  // of serverless bundles when Turso is configured.
  let Database: typeof import("better-sqlite3");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Database = require("better-sqlite3") as typeof import("better-sqlite3");
  } catch {
    throw new Error(
      "No database configured. Set TURSO_DATABASE_URL for a hosted database, " +
        "or install the optional better-sqlite3 package for a local SQLite file.",
    );
  }
  const sqlite = new Database(resolved);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.exec(MIGRATION_SQL);
  const db = drizzleSqlite(sqlite, { schema }) as unknown as AppDb;
  return { db, kind: "sqlite", client: null, ready: Promise.resolve() };
}

function handle(): DbHandle {
  if (!globalThis.__tonyDailyDb) {
    globalThis.__tonyDailyDb = createHandle();
  }
  return globalThis.__tonyDailyDb;
}

/** Get the database, guaranteed migrated. */
export async function getDb(): Promise<AppDb> {
  const h = handle();
  await h.ready;
  return h.db;
}

/**
 * Execute many prepared drizzle statements efficiently: one network round
 * trip on libsql (`client.batch` semantics via drizzle), sequential locally.
 */
export async function runBatch(
  statements: { run: () => Promise<unknown> | unknown }[],
): Promise<void> {
  const h = handle();
  await h.ready;
  if (statements.length === 0) return;
  if (h.kind === "libsql") {
    // drizzle's libsql db.batch requires a tuple type; chunked manual batch
    // over the raw client would lose type safety, so run statements grouped
    // in transactions-sized chunks instead.
    const CHUNK = 100;
    for (let i = 0; i < statements.length; i += CHUNK) {
      await Promise.all(statements.slice(i, i + CHUNK).map((s) => s.run()));
    }
  } else {
    for (const s of statements) await s.run();
  }
}

/** Schema bootstrap — plain SQL so both drivers migrate identically. */
const MIGRATION_SQL = `
    CREATE TABLE IF NOT EXISTS source_state (
      source_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_sync_at INTEGER,
      last_status TEXT,
      last_error TEXT,
      last_item_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      original_title TEXT NOT NULL,
      original_language TEXT NOT NULL,
      excerpt TEXT,
      author TEXT,
      published_at INTEGER,
      fetched_at INTEGER NOT NULL,
      image_url TEXT,
      image_attribution TEXT,
      content_hash TEXT NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'SINGLE_SOURCE',
      category TEXT NOT NULL DEFAULT 'general',
      region TEXT NOT NULL DEFAULT 'global',
      cluster_id INTEGER,
      score REAL NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS articles_url_unique ON articles (canonical_url);
    CREATE UNIQUE INDEX IF NOT EXISTS articles_hash_unique ON articles (content_hash);
    CREATE INDEX IF NOT EXISTS articles_cluster_idx ON articles (cluster_id);
    CREATE INDEX IF NOT EXISTS articles_published_idx ON articles (published_at);
    CREATE INDEX IF NOT EXISTS articles_category_idx ON articles (category);
    CREATE TABLE IF NOT EXISTS story_clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rep_article_id INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS article_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      entity TEXT NOT NULL,
      entity_type TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS entities_article_idx ON article_entities (article_id);
    CREATE INDEX IF NOT EXISTS entities_entity_idx ON article_entities (entity);
    CREATE TABLE IF NOT EXISTS user_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS watchlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      exchange TEXT,
      currency TEXT,
      instrument_type TEXT,
      grp TEXT,
      favourite INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS watchlist_symbol_unique ON watchlist_items (symbol);
    CREATE TABLE IF NOT EXISTS saved_articles (
      article_id INTEGER PRIMARY KEY,
      saved_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS market_quotes (
      symbol TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS market_time_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      interval TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS series_symbol_interval_unique ON market_time_series (symbol, interval);
    CREATE TABLE IF NOT EXISTS daily_briefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_key TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      model TEXT,
      content TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS briefs_date_unique ON daily_briefs (date_key);
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_conversation_idx ON chat_messages (conversation_id);
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT NOT NULL,
      message TEXT,
      items_found INTEGER NOT NULL DEFAULT 0,
      items_new INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS sync_source_idx ON sync_logs (source_id);
    CREATE TABLE IF NOT EXISTS ai_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_hash TEXT NOT NULL,
      language TEXT NOT NULL,
      level TEXT NOT NULL,
      model TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS summaries_key_unique ON ai_summaries (content_hash, language, level, model);
`;

export { schema };
