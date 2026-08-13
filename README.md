# TONY DAILY

**Tony's Personal Market + Built Environment Intelligence Terminal**

A private, bilingual (English / 繁體中文) daily intelligence dashboard for Tony
Wong: Hong Kong markets, property, architecture, infrastructure and the built
environment — combining a Bloomberg-style terminal, a premium architecture
publication, a personalised daily paper, a stock watchlist and a grounded AI
research assistant.

Built on a strict **zero-hallucination policy**: every story shown comes from
a real, verified RSS source with publisher, timestamps and a link to the
original; every AI answer is grounded in retrieved sources with citations;
market data is always labelled with its timestamp and entitlement. When data
is unavailable the app says so — it never invents content.

## Architecture

```
Next.js 16 (App Router, TypeScript, Tailwind v4)
├── src/lib/db          SQLite (better-sqlite3) + Drizzle ORM, auto-migrating
├── src/lib/sources     Config-driven registry of 18 live-verified RSS feeds
├── src/lib/ingest      Fetch → normalise → dedupe → classify → entity-extract
│                       → cluster → corroborate → rank (all transparent)
├── src/lib/rank        Configurable scoring: 30% relevance · 25% authority ·
│                       20% recency · 10% geography · 10% corroboration · 5% novelty
├── src/lib/market      MarketDataProvider abstraction → Twelve Data adapter,
│                       server-side key, DB-backed quote/series cache
├── src/lib/ai          AIService (Claude, server-side only): summaries at three
│                       levels, Daily Brief overview, grounded Q&A with citations
├── src/lib/retrieval   Lexical retrieval over the indexed articles (EN + zh-HK)
├── src/lib/brief       Deterministic Daily Brief builder (+ optional AI overview)
└── src/app             Pages: Today · Markets · Property · Architecture ·
                        Watchlist (+ stock detail) · Saved · Search · Settings ·
                        Ask Tony Daily · Onboarding — plus JSON API routes
```

Data flows one way: **sources → SQLite index → UI/AI**. The AI never answers
news/market questions from model memory; it only sees retrieved rows.

## Setup (local)

```bash
npm install
cp .env.example .env.local   # fill in what you have (all optional)
npm run dev                  # http://localhost:3000
```

First launch opens a short onboarding (language, interests, watchlist,
briefing time, theme), then runs the first feed ingestion.

### Environment variables (`.env.local`)

| Variable | Needed for | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Summaries, Daily Brief overview, Ask Tony Daily | Honest "AI not configured" states |
| `ANTHROPIC_MODEL` | Optional model override (default `claude-sonnet-5`) | Default used |
| `MARKET_DATA_PROVIDER` | Provider selection (`twelvedata`) | Defaults to twelvedata |
| `TWELVE_DATA_API_KEY` | Quotes, charts, symbol search, market strip | Honest "market data not configured" states |
| `APP_TIMEZONE` | Display timezone (default `Asia/Hong_Kong`) | Default used |
| `CRON_SECRET` | Authenticating scheduled ingestion (required for `/api/cron/*`) | Cron endpoints refuse to run; UI refresh still works |
| `DATABASE_URL` | Local SQLite path (default `./data/tonydaily.db`) | Default used |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Hosted database for cloud deploys | Falls back to the local SQLite file |

Secrets stay server-side only; nothing is ever exposed to the browser.

## Deployment (free tier)

Free hosts give you no persistent disk, so the local SQLite file cannot be
used in the cloud — the app therefore ships a **dual-driver database layer**:
set `TURSO_DATABASE_URL` and it talks to hosted libSQL instead, with no other
code changes. Recommended free stack: **Vercel Hobby + Turso free tier**
(5 GB storage, 500M row reads/month, no credit card).

> **Why not GitHub Pages?** Pages is a static file host — it cannot run a
> Node.js server, API routes, a database, or scheduled feed ingestion, and it
> cannot hold server-side secrets. Tony Daily needs all of those, so a Pages
> deployment would render an empty shell with no news, no watchlist and no
> AI. GitHub is still used here for the repository and for free scheduled
> ingestion (see below); the app itself runs on Vercel's free tier, which
> provides a free `*.vercel.app` address.

### 1. Create the database (Turso)

Sign up at [turso.tech](https://turso.tech), create a database, and copy its
URL (`libsql://…`) and an auth token. Nothing needs to be created in it —
the app migrates its own schema on first boot.

### 2. Push the repo to GitHub

Create an empty repository on GitHub (no README/licence), then:

```bash
git remote add origin https://github.com/<you>/tony-daily.git
git push -u origin main
```

`.gitignore` excludes `.env*.local`, `/data` and `node_modules`, so no
secrets or database files are ever committed.

### 3. Deploy on Vercel

Import the repo at [vercel.com/new](https://vercel.com/new) (framework
auto-detects as Next.js), then add environment variables under
**Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `TURSO_DATABASE_URL` | from Turso |
| `TURSO_AUTH_TOKEN` | from Turso |
| `CRON_SECRET` | any long random string |
| `APP_TIMEZONE` | `Asia/Hong_Kong` |
| `TWELVE_DATA_API_KEY` | optional — enables market data |
| `ANTHROPIC_API_KEY` | optional — enables AI features |

Deploy, open the URL, and complete onboarding. The first run ingests the
feeds and builds the brief.

### 4. Keep it fresh

`vercel.json` registers a daily cron on `/api/cron/brief` (23:00 UTC =
07:00 HKT), which ingests feeds then rebuilds the brief. Vercel sends
`Authorization: Bearer $CRON_SECRET` automatically.

**Hobby plans allow only one cron run per day**, which is enough for the
morning brief but leaves the day's news stale. Two free options for
more frequent ingestion:

- Tony presses **Refresh brief** in the UI whenever he wants (throttled to
  once a minute, with 15-minute per-source cooldowns).
- **GitHub Actions** (included): `.github/workflows/refresh-news.yml` pings
  the ingestion endpoint every 30 minutes during Hong Kong waking hours.
  Scheduled Actions are free on public repositories. Add two repository
  secrets under **Settings → Secrets and variables → Actions**:

  | Secret | Value |
  |---|---|
  | `APP_URL` | `https://your-app.vercel.app` (no trailing slash) |
  | `CRON_SECRET` | same value as in the host's env vars |

  You can trigger it manually from the Actions tab to test it.
- Or any external scheduler, e.g. [cron-job.org](https://cron-job.org):

```bash
curl -H "x-cron-secret: $CRON_SECRET" https://your-app.vercel.app/api/cron/ingest
```

### 5. Lock it down

The dashboard is private by design but has no built-in login, so a public
deployment is readable by anyone with the URL. On Vercel free, either keep
the URL unguessable and undisclosed, or add
[Vercel Authentication](https://vercel.com/docs/deployment-protection)
(Settings → Deployment Protection) so only your account can view it. Cron
endpoints are already secret-protected and refuse to run without
`CRON_SECRET`.

### Alternative hosts

Any Node host works. On **Render**/**Railway** free tiers, the same Turso
setup applies (their disks are also ephemeral). A machine that sleeps when
idle only delays a page load; cron-driven ingestion still needs an external
pinger. Self-hosting on an always-on machine is the one case where you can
skip Turso entirely and keep the local SQLite file.

## News ingestion

- 18 RSS sources (HK Government News EN/繁 incl. infrastructure + finance
  desks, RTHK EN/繁 local/finance/Greater China/world, SCMP Hong Kong /
  Business / Property, BBC Business, Dezeen, ArchDaily, designboom).
  **Every feed URL was verified live before being committed** — see
  `src/lib/sources/registry.ts`. Never add an unverified endpoint.
- Per-source cooldown of 15 minutes, request timeouts, retry with backoff,
  and sync logging. Failures appear in Settings → Source health.
- Deduplication by canonical URL and content hash; near-duplicate stories
  from different sources are clustered so one event = one card, with all
  supporting sources listed. Clustering uses **IDF-weighted containment**
  rather than plain Jaccard, because publishers write the same event at very
  different lengths ("Building laws consultation begins" vs "Consultation on
  building management law reform begins") while generic tokens like
  "Hong Kong" inflate naive similarity. Thresholds were calibrated against
  the live index — see `scripts/cluster-probe.mjs`, which prints the
  similarity distribution and lets you re-tune.
- Verification labels: `PRIMARY_VERIFIED` (official/government source),
  `CORROBORATED` (≥2 independent sources in a cluster), `SINGLE_SOURCE`.
- Only headline, permitted excerpt, image URL and metadata are stored —
  never full copyrighted articles. No paywall/robots circumvention.

### Scheduled jobs

Two GET endpoints are built for schedulers and require the shared secret
(`Authorization: Bearer $CRON_SECRET`, `x-cron-secret:` header, or
`?secret=`):

| Endpoint | Does |
|---|---|
| `/api/cron/ingest` | Refresh feeds (respecting per-source cooldowns) |
| `/api/cron/brief` | Refresh feeds, then rebuild today's Daily Brief |

```bash
curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/ingest
```

Run ingest every 15–30 minutes and the brief once before Tony's configured
briefing time (default 07:00 HKT, editable in Settings). The dashboard also
has a manual **Refresh brief** button. `POST /api/ingest` and `POST /api/brief`
remain available for the UI.

## Market data

`MarketDataProvider` (quote / time series / symbol search) with a Twelve Data
adapter. Quotes are cached server-side (~60 s) and series (~15 min) to respect
rate limits; stale cache is served (with its honest timestamp) if the provider
fails. All prices display `Updated HH:mm HKT` and are labelled **Delayed** —
never claimed real-time. Note: free Twelve Data plans cover US equities well;
HK equities and some indexes may require a paid plan — anything unavailable
shows an honest error, never a fake number.

## AI (Claude)

All calls run server-side through `src/lib/ai`. Grounding rules (enforced in
the system prompt and by construction):

- retrieval before generation — the model only sees indexed sources + labelled quotes
- citations `[n]` map to the exact retrieved articles and render as links
- missing evidence → "Information unavailable from the currently connected sources"
- no invented causes for price moves; FACT separated from labelled INTERPRETATION
- no personalised financial advice; Cantonese questions answered in 繁體中文
- summaries cached by content-hash + language + level + model

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm start          # serve production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest (dedupe/clustering/ranking/factuality suites)
npm run db:push    # drizzle-kit push (schema evolution; tables auto-create on boot)

node scripts/check-db.mjs       # index integrity: counts, dupes, sync errors
node scripts/show-clusters.mjs  # inspect current story clusters
node scripts/cluster-probe.mjs  # similarity distribution, for re-tuning
```

The `scripts/*.mjs` helpers read the local SQLite file directly and are
diagnostics only — they are not part of the app.

## Testing

53 tests cover: HTML stripping and CJK-aware title similarity, IDF-weighted
clustering similarity (real headline pairs that must match, and near-miss
pairs that must not), URL canonicalisation, EN/繁 category + region
classification, entity extraction (no invented entities), ranking behaviour
(recency decay, watchlist boost, geography, corroboration, configurable
interest weights), clustering + corroboration upgrades against a real SQLite
database, retrieval, and the factuality guard (empty evidence → empty source
block; the AI is told when no sources exist rather than being allowed to
guess). A dedicated suite exercises the **libSQL/Turso driver** (schema
migration, row ids, unique constraints, clustering) so the hosted-database
path used in production is actually run, not merely typechecked.

## Known limitations

- Keyword classification is lexical; an occasional general story lands in a
  specialist section (e.g. a tunnel traffic accident under Infrastructure).
- Clustering compares headlines within a language only (EN↔EN, 繁↔繁); the
  English and Chinese reports of one event stay separate cards. Chinese
  clustering works but is more conservative, since character-bigram
  tokenisation produces lower containment scores than English words.
- Free-tier market data may not include HKEX symbols or index quotes; the UI
  omits/flags them honestly.
- Headlines are shown in their original language; AI summaries provide the
  translation, clearly labelled — original headlines are never rewritten.
- Single-user by design and there is no built-in login. A public deployment
  is readable by anyone with the URL — use Vercel Deployment Protection or a
  reverse proxy with auth (see Deployment step 5).
- On Vercel's free plan cron may run only once per day, so intraday freshness
  depends on the Refresh button or an external scheduler.

## Licensing / source considerations

RSS feeds are consumed as published by their owners with a polite fetch
cadence and a descriptive User-Agent. Only metadata + permitted excerpts are
stored; full articles stay with the publisher, one click away. Publisher
preview images are hot-linked with attribution, not copied. If a publisher
objects or a feed disappears, disable the source in Settings.
