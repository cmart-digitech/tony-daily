# TONY DAILY — Phase 2 Technical Plan

Executes the priorities agreed in `PHASE_2_HANDOVER.md` Part C, under the
unchanged rules of the product brief and `CLAUDE.md`. Everything stays on
free tiers.

## In scope (this phase)

1. **Authentication** — the dashboard is currently readable by anyone with
   the URL. Add a password gate: `DASHBOARD_PASSWORD` env var, login page,
   HMAC-signed cookie checked in Next.js middleware (Web Crypto, edge-safe),
   constant-time comparison, basic rate limiting. Cron/health endpoints keep
   their existing secret auth and are never cookie-gated. **Honest fallback:**
   with no password configured the app stays open and `/api/health` reports
   `authEnabled: false` — a misconfigured deploy must not lock Tony out or
   pretend to be protected.
2. **FTS5 full-text search** — SQLite FTS5 virtual table (supported by
   Turso) over title + excerpt + entities, synced during ingest, bm25-ranked,
   used by both `/search` and AI retrieval. Falls back to the existing
   lexical scan if FTS is unavailable, so local dev and tests keep working.
3. **Structured built-environment metadata** (brief §57–58) — for property/
   architecture/infrastructure stories, one cached LLM extraction pass per
   cluster producing typed fields: project, location, developer, architect,
   land use, status. Extraction rules mirror the grounding rules: a field is
   filled only when the source text states it explicitly, otherwise left
   null — never inferred, never estimated. Rendered on the article page as
   the PROJECT / LOCATION / DEVELOPER / STATUS block plus KEY FACTS.
4. **Headline translation** — populate `translatedTitle` for top-ranked
   recent stories (bounded per run, cached), clearly labelled AI-assisted,
   original headline always retained. Shown when the interface language
   differs from the article language.
5. **Cross-language clustering** — with translations available, compare 繁
   articles' English translated titles against English headlines using the
   existing calibrated weighted similarity + shared entities, so the EN and
   繁 reports of one event become one cluster.
6. **HKEX / SFC as Tier A sources** — verified live before commit, like all
   sources. Only endpoints that actually return valid RSS are added.
7. **Telegram morning delivery** — free Bot API. When `TELEGRAM_BOT_TOKEN`
   and `TELEGRAM_CHAT_ID` are set, the daily cron sends the brief (top
   stories + overview, with source links) after generating it. Unconfigured →
   silently skipped and reported in `/api/health`.

## Explicitly deferred (needs Tony's decision or paid tier)

- **Hong Kong intraday equities** — no free tier exists (verified in Phase 1).
  Requires either Twelve Data Grow (~US$29/mo) or an EOD-only compromise.
- Price-threshold alerts, portfolio holdings, calendars, maps, notebooks.

## Order of work

Auth → FTS5 → sources verification → metadata extraction → translation →
cross-language clustering → Telegram → tests → gates → deploy → live
verification. Each lands as its own commit; gates must pass before every
push.
