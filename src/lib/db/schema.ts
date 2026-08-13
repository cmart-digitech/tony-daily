import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Per-source sync state. The source definitions themselves live in
 * src/lib/sources/registry.ts (config-driven); this table only records
 * runtime state so failures are visible in the admin panel.
 */
export const sourceState = sqliteTable("source_state", {
  sourceId: text("source_id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSyncAt: integer("last_sync_at"),
  lastStatus: text("last_status"), // healthy | error
  lastError: text("last_error"),
  lastItemCount: integer("last_item_count"),
});

export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: text("source_id").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    originalTitle: text("original_title").notNull(),
    originalLanguage: text("original_language").notNull(), // en | zh-HK
    excerpt: text("excerpt"),
    author: text("author"),
    publishedAt: integer("published_at"), // epoch ms; null if feed omits it
    fetchedAt: integer("fetched_at").notNull(),
    imageUrl: text("image_url"),
    imageAttribution: text("image_attribution"),
    contentHash: text("content_hash").notNull(),
    verificationStatus: text("verification_status")
      .notNull()
      .default("SINGLE_SOURCE"), // PRIMARY_VERIFIED | CORROBORATED | SINGLE_SOURCE
    category: text("category").notNull().default("general"),
    region: text("region").notNull().default("global"), // hk | china | apac | global
    clusterId: integer("cluster_id"),
    score: real("score").notNull().default(0),
  },
  (t) => [
    uniqueIndex("articles_url_unique").on(t.canonicalUrl),
    uniqueIndex("articles_hash_unique").on(t.contentHash),
    index("articles_cluster_idx").on(t.clusterId),
    index("articles_published_idx").on(t.publishedAt),
    index("articles_category_idx").on(t.category),
  ],
);

export const storyClusters = sqliteTable("story_clusters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repArticleId: integer("rep_article_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const articleEntities = sqliteTable(
  "article_entities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    articleId: integer("article_id").notNull(),
    entity: text("entity").notNull(),
    entityType: text("entity_type").notNull(), // company | ticker | location | project | department | architect
  },
  (t) => [
    index("entities_article_idx").on(t.articleId),
    index("entities_entity_idx").on(t.entity),
  ],
);

/** Flexible key/value preferences: language, theme, briefingTime, interests, rankWeights, onboarded… */
export const userPreferences = sqliteTable("user_preferences", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updatedAt: integer("updated_at").notNull(),
});

export const watchlistItems = sqliteTable(
  "watchlist_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbol: text("symbol").notNull(), // e.g. 0700.HK, AAPL
    name: text("name").notNull(),
    exchange: text("exchange"),
    currency: text("currency"),
    instrumentType: text("instrument_type"), // equity | index | etf
    grp: text("grp"), // optional user-defined group
    favourite: integer("favourite", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: integer("added_at").notNull(),
  },
  (t) => [uniqueIndex("watchlist_symbol_unique").on(t.symbol)],
);

export const savedArticles = sqliteTable("saved_articles", {
  articleId: integer("article_id").primaryKey(),
  savedAt: integer("saved_at").notNull(),
});

/** Server-side quote cache so provider rate limits are respected. */
export const marketQuotes = sqliteTable("market_quotes", {
  symbol: text("symbol").primaryKey(),
  data: text("data").notNull(), // JSON Quote
  fetchedAt: integer("fetched_at").notNull(),
});

export const marketTimeSeries = sqliteTable(
  "market_time_series",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbol: text("symbol").notNull(),
    interval: text("interval").notNull(), // 1day etc.
    data: text("data").notNull(), // JSON array of bars
    fetchedAt: integer("fetched_at").notNull(),
  },
  (t) => [uniqueIndex("series_symbol_interval_unique").on(t.symbol, t.interval)],
);

export const dailyBriefs = sqliteTable(
  "daily_briefs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    dateKey: text("date_key").notNull(), // YYYY-MM-DD in Asia/Hong_Kong
    generatedAt: integer("generated_at").notNull(),
    model: text("model"),
    content: text("content").notNull(), // JSON: sections with article ids + AI overview
  },
  (t) => [uniqueIndex("briefs_date_unique").on(t.dateKey)],
);

export const chatConversations = sqliteTable("chat_conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title"),
  createdAt: integer("created_at").notNull(),
});

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    conversationId: integer("conversation_id").notNull(),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    citations: text("citations"), // JSON [{articleId,title,source,url,publishedAt}]
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);

export const syncLogs = sqliteTable(
  "sync_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: text("source_id").notNull(),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    status: text("status").notNull(), // ok | error
    message: text("message"),
    itemsFound: integer("items_found").notNull().default(0),
    itemsNew: integer("items_new").notNull().default(0),
  },
  (t) => [index("sync_source_idx").on(t.sourceId)],
);

/** Cache of AI-generated summaries keyed by content hash + language + level + model. */
export const aiSummaries = sqliteTable(
  "ai_summaries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contentHash: text("content_hash").notNull(),
    language: text("language").notNull(), // en | zh-HK
    level: text("level").notNull(), // 30s | 2min | deep
    model: text("model").notNull(),
    summary: text("summary").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("summaries_key_unique").on(t.contentHash, t.language, t.level, t.model),
  ],
);
