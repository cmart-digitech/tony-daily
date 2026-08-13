# TONY DAILY — MVP Technical Plan

Private daily intelligence dashboard for Tony Wong: Hong Kong markets, property,
architecture and the built environment. Bilingual (EN / 繁體中文), factual,
source-grounded, zero hallucination.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript 5 | Server rendering, API routes, one deployable unit |
| Styling | Tailwind CSS v4 | Fast, consistent, easy light/dark theming |
| Persistence | SQLite (better-sqlite3) + Drizzle ORM | Zero-infra local MVP; swappable for Postgres later |
| Ingestion | rss-parser + native fetch | Official RSS feeds only, no scraping, no paywall bypass |
| Market data | `MarketDataProvider` abstraction → Twelve Data adapter | Legitimate API; keys server-side only; honest empty state without a key |
| AI | `@anthropic-ai/sdk` server-side only (`AIService`) | Summaries, Daily Brief, Ask Tony Daily — always retrieval-grounded |
| Charts | Hand-rolled inline SVG sparklines/line charts | No heavy chart dependency for MVP |

No client-side secrets. All external calls happen in server routes/actions.

## 2. Architecture

```
src/
  app/                    # App Router pages + API routes
    page.tsx              # TODAY — Daily Brief dashboard
    markets/ property/ architecture/ watchlist/ saved/ settings/ chat/
    article/[id]/
    onboarding/
    api/
      ingest/             # cron-protected ingestion trigger
      quotes/  symbols/   # market data (server-side provider)
      chat/  summarize/  brief/
      watchlist/  saved/  preferences/  sources/  search/
  lib/
    db/                   # Drizzle schema + client + migrations
    sources/              # source registry (config-driven) + RSS adapter
    ingest/               # fetch → normalise → dedupe → cluster → classify → rank
    market/               # MarketDataProvider interface + TwelveDataProvider
    ai/                   # AIService (summaries, brief, chat) — grounded only
    rank/                 # transparent scoring (configurable weights)
    i18n/                 # EN + zh-HK dictionaries
  components/             # UI building blocks
```

## 3. Data model (Drizzle / SQLite)

sources, articles, story_clusters, article_entities, user_preferences,
watchlist_items, saved_articles, market_quotes (cache), daily_briefs,
daily_brief_items, chat_conversations, chat_messages, sync_logs,
ai_summaries (cache keyed by contentHash+language+level+model).

Article fields: id, sourceId, canonicalUrl, originalTitle, originalLanguage,
excerpt, publishedAt, fetchedAt, imageUrl, imageAttribution, author,
contentHash, verificationStatus (PRIMARY_VERIFIED | CORROBORATED |
SINGLE_SOURCE), category, region, clusterId.

Only metadata + permitted excerpt stored — never full copyrighted articles.

## 4. Sources (verified before commit)

Config-driven registry (`src/lib/sources/registry.ts`). Each entry:
id, name, language, region, type, authority (0–100), categories, feedUrl,
enabled. Candidate feeds (RTHK EN/ZH, news.gov.hk EN/ZH, HKMA, Dezeen,
ArchDaily, Designboom, BBC Business, SCMP…) are **verified live** during
development; anything unreachable is excluded, not guessed.

Authority tiers: Government/regulator ≈ 95–100 · Public broadcaster ≈ 90 ·
Quality journalism ≈ 80–88 · Specialist design media ≈ 70–78.

## 5. Ingestion pipeline

fetch feed → parse → normalise (title, url, date, image via media/enclosure)
→ hash content → dedupe (canonical URL, hash, normalised-title similarity)
→ classify category/region (keyword + source defaults) → cluster near-identical
stories (title similarity + shared entities) → verification status
(source tier + corroboration count) → rank score.

Rank = 30% interest match + 25% source authority + 20% recency decay +
10% geography + 10% corroboration + 5% novelty (weights stored in
user_preferences, editable).

Triggered by `/api/ingest` (CRON_SECRET-protected) and a "Refresh" action in
the UI. Per-source cooldown ≈ 15 min, timeouts, retry/backoff, sync_logs for
the source-health panel.

## 6. Market data

`MarketDataProvider` interface: getQuote, getTimeSeries, searchSymbol,
getMarketStatus. Twelve Data adapter (free tier, HK + US equities, indexes,
FX). Server-side cache (~1 min quotes) to respect rate limits. Every quote
labelled with timestamp + entitlement (delayed/EOD — never claimed live).
Without `TWELVE_DATA_API_KEY`: honest "Market data not configured" state.

## 7. AI (Claude)

`AIService` — all factual calls receive retrieved context (articles, quotes,
watchlist). Flows: summarizeArticle (30s/2min/deep, cached by
hash+lang+level+model), generateDailyBrief, answerQuestion (retrieval →
grounded context → citations). System prompts enforce: cite sources, say
"Information unavailable from the currently connected sources" when evidence
is missing, separate FACT from INTERPRETATION, no invented causes for price
moves, no personalised financial advice. Responds in EN or 廣東話/繁體中文 to
match the question.

## 8. UI

Design: minimal, architectural, editorial. Bloomberg density for data,
Apple restraint for chrome, generous photography for architecture/property.
Light/Dark/System (class strategy, persisted). EN / 繁 / 雙語 toggle.

Pages: TODAY (brief + hero + market strip), MARKETS, PROPERTY, ARCHITECTURE,
WATCHLIST, SAVED, SETTINGS (interests, weights, sources health, briefing
time, theme, language), ARTICLE view, ASK TONY DAILY chat, ONBOARDING.

Every module shows freshness ("News refreshed 4 min ago"). Every error state
is honest — no fake data, ever.

## 9. Build order

1. Scaffold Next.js + Tailwind + Drizzle + schema
2. Source registry with live-verified feeds; RSS adapter
3. Ingestion pipeline (dedupe, cluster, classify, verify, rank)
4. Market provider abstraction + Twelve Data + watchlist API
5. Core UI: layout, theme, i18n, market strip, TODAY dashboard
6. Section pages + article view + saved
7. Watchlist UI + charts
8. AIService: summaries, Daily Brief, chat with citations
9. Onboarding + settings + source health
10. Error/empty states, tests (factuality, dedupe, ranking), lint, typecheck, build

## 10. Out of scope for MVP

Email/WhatsApp delivery, voice briefing, portfolio holdings, alerts, maps,
multi-user, native apps, trading. Architecture keeps these addable.
