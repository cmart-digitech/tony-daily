# TONY DAILY — Phase 1 Handover & Phase 2 Scope

Status as of **13 August 2026**. Written as the input to a Phase 2 brief:
Part A records what exists and is verified, Part B records what is missing,
weak or deliberately deferred.

---

## Part A — What exists

### A.1 Live deployment

| Thing | Where |
|---|---|
| Dashboard (the product) | https://tony-daily.vercel.app |
| Project showcase page | https://cmart-digitech.github.io/tony-daily/ |
| Source repository | https://github.com/cmart-digitech/tony-daily (public) |
| Database | Turso libSQL, `aws-ap-northeast-1` (Tokyo) |
| Hosting | Vercel Hobby, functions pinned to `hnd1` (Tokyo) |
| Health / diagnostics | `/api/health` |

Live configuration confirmed working: database reachable, onboarding
complete, `CRON_SECRET` set, AI provider **Google Gemini** (`gemini-3.6-flash`,
free tier), market data configured, timezone `Asia/Hong_Kong`.

Running cost today: **£0 / HK$0.** Vercel Hobby, Turso free tier, Gemini free
tier, GitHub Actions free on a public repository.

### A.2 Scale of the codebase

72 source files (~7,360 lines), 11 test files (~1,079 lines), 124 tests,
17 commits. `npm run lint`, `npm run typecheck`, `npm test` and
`npm run build` all pass.

### A.3 Subsystems built

**Ingestion** — 18 RSS sources, every endpoint verified live before commit
(HK Government News EN/繁 incl. infrastructure and finance desks, RTHK EN/繁
local/finance/Greater China/world, SCMP Hong Kong/Business/Property, BBC
Business, Dezeen, ArchDaily, designboom). Per-source 15-minute cooldowns,
timeouts, retry with backoff, sync logging, bounded concurrency.

**Deduplication and clustering** — canonical URL + content hash rejects
repeats. Near-duplicate stories across publishers are clustered so one event
is one card with every source retained. Clustering uses **IDF-weighted
containment**, calibrated against the live index, after plain Jaccard was
found to produce *zero* clusters on 472 real articles. Verified: correct
clusters, zero false merges, including Chinese-language pairs.

**Verification grading** — `PRIMARY_VERIFIED` (government/regulator),
`CORROBORATED` (≥2 independent sources in a cluster), `SINGLE_SOURCE`.
Displayed on every card.

**Classification** — lexical category/region rules covering EN and 繁, with
an incident guard so accidents, fires and crime do not land in the property,
architecture or infrastructure sections. Re-applied to stored rows on every
run, so rule changes take effect immediately.

**Ranking** — transparent weighted score: 30% personal relevance, 25% source
authority, 20% recency decay, 10% geography, 10% corroboration, 5% novelty.
All weights are user preferences, editable in Settings.

**Imagery** — feed image → publisher Open Graph preview → typographic
placeholder. OG enrichment was added after measurement showed 28% of articles
had no image and *all* of them were RTHK, whose pages do declare `og:image`.
Local index coverage rose from 72% to 84% and continues to climb (60
enriched per run). The placeholder is a designed editorial composition, not
an error box.

**Layout** — photo-led grids (Property, Architecture, visual brief sections)
group illustrated stories first while preserving ranked order; dense text
lists keep pure relevance order. Deliberately a layout concern, never a
ranking one.

**Market data** — `MarketDataProvider` abstraction with a Twelve Data
adapter, DB-backed caching (60s quotes, 15min series), stale-but-honest
fallback. Every price carries its fetch time and a conservative entitlement
label; delayed data is never called real-time.

**AI** — provider-agnostic. `src/lib/ai/providers.ts` supports Gemini, Groq,
xAI Grok, OpenRouter, Mistral, Anthropic, or any OpenAI-compatible endpoint;
one key switches provider. Features: three summary levels (cached by content
hash + language + level + provider:model), Daily Brief overview, and Ask
Tony Daily with retrieval-before-generation and clickable citations. Output
is rendered as clean typography — the model is asked for plain prose and any
Markdown that slips through is converted, never shown raw.

**UI** — Today, Markets, Property, Architecture, Watchlist (+ per-stock
detail), Saved, Search, Settings, Ask Tony Daily, Onboarding, Article view.
Light/dark/system themes, EN / 繁 / 雙語, responsive, time-aware bilingual
greeting on Hong Kong time.

**Automation** — Vercel cron rebuilds the brief daily at 07:00 HKT; a GitHub
Actions workflow refreshes news every 30 minutes during Hong Kong waking
hours (last run: success). Both endpoints are secret-protected and reject
unauthenticated calls with 401 (verified).

**Operational honesty** — a deployment that cannot reach its database renders
a *Setup required* page naming the missing variables rather than a blank 500.
`/api/health` reports subsystem status without exposing secrets.

### A.4 Original MVP checklist (brief §61)

All 23 required items are implemented: personalised dashboard, themes,
responsive layout, bilingual interface, RSS ingestion, source configuration,
deduplication, categories, ranking, Daily Brief, source links, article
imagery, watchlist, market-data abstraction, charts, chatbot, article
summarisation, daily summarisation, save article, settings, source health,
error handling, factual grounding.

---

## Part B — What is missing, weak, or deferred

### B.1 Security — the most urgent gap

- **There is no authentication.** The dashboard is readable by anyone with
  the URL. Vercel Deployment Protection is available but currently not
  blocking the production domain. For a private dashboard this should be
  closed first: either Vercel Deployment Protection, or a simple
  password/passkey gate in the app.
- The repository is public (required for free GitHub Pages). No secrets are
  committed — verified — but the code and the showcase page are public.

### B.2 Market data — the largest functional limitation

- **No free tier covers Hong Kong equities.** Twelve Data's free plan is US
  equities, forex and crypto only; HKEX requires their paid Grow plan
  (~US$29/month). Alpha Vantage has no Hong Kong suffix at all; Marketstack's
  free tier is end-of-day only at 100 requests/month.
- Consequence: Tony can watch US securities and HK-linked ADRs, but not
  `0700.HK` directly. Quotes that fail show an honest error, never a
  placeholder.
- Phase 2 options: pay for one provider tier; add an end-of-day HK source as
  a second provider behind the existing abstraction; or integrate HKEX data
  where licensing permits.
- Watchlist grouping exists in the schema (`grp`) but has no UI. No price
  alerts, no portfolio holdings, no dividend or earnings calendar.

### B.3 Content depth not yet built

- **Structured property and architecture metadata** (brief §57–58) is not
  implemented. Article pages show extracted entities as tags, but there are
  no typed fields for project, developer, architect, location, land use,
  status or completion. This is the single biggest gap against the original
  vision for the built-environment sections.
- **Entity extraction is lexical**, driven by a hand-maintained list of
  ~22 companies plus departments and districts. It will miss anything not on
  the list. An LLM-based extraction pass (cached, run once per article) would
  be far more complete.
- **Headline translation is not implemented.** The schema carries
  `translatedTitle` but nothing populates it; headlines display in their
  original language and translation only appears inside AI summaries.
- **No HKEX filings integration.** Company announcements come via media
  reporting rather than the exchange's own feed, so the "prefer the primary
  filing over commentary" rule is only partly realised.
- Article view has summaries, sources, entities and related stories, but not
  the separate "Key facts" block described in the brief.

### B.4 Retrieval and search

- Search and chat retrieval scan up to 400 recent rows in application code
  and score by token overlap. It works at current scale (~500 articles) but
  will not scale and cannot do phrase or fielded search. **SQLite FTS5 (which
  Turso supports) is the natural upgrade** and would improve both search and
  the quality of context handed to the AI.
- Retrieval covers a 7-day window; there is no archive or historical search.

### B.5 Known behavioural limitations

- **Clustering compares headlines within a language only.** The English and
  Chinese reports of one event remain separate cards. Chinese clustering is
  also more conservative because character-bigram tokenisation scores lower.
- **Classification is lexical**, so occasional misfiling is expected. The
  incident guard fixed the worst case; more will surface.
- **Vercel Hobby allows one cron run per day**, so intraday freshness depends
  on the GitHub Actions workflow. If the repo ever goes private, Actions
  minutes become metered.
- **Gemini free tier has rate limits.** Heavy chat use could hit them; the
  app surfaces the provider's own error message.
- Summaries are cached per `provider:model`, so switching model regenerates
  (correct, but costs tokens again).

### B.6 Testing gaps

124 tests cover ingestion, text processing, clustering similarity,
classification, entity extraction, ranking, the libSQL driver, AI provider
resolution, output formatting, layout ordering and greetings. Not covered:

- No component/interaction tests for the React UI (only pure functions and
  server-rendered markup).
- No end-to-end test of a full user journey.
- No test asserting the AI declines ungrounded questions against a live
  provider — the grounding contract is enforced by prompt and by the source
  block, and verified manually rather than automatically.
- No accessibility audit (semantic HTML, focus states and reduced-motion
  support were built in, but never formally tested).

### B.7 Deferred by design (brief §62)

Email morning brief, WhatsApp/Telegram delivery, voice Cantonese briefing,
portfolio holdings, dividend and earnings calendars, property-development
map, Hong Kong planning applications, personalised alerts, watchlist price
alerts, company filing alerts, weekly architecture digest, AI research
notebooks, PDF/report analysis, personal notes, historical topic timelines.

---

## Part C — Suggested Phase 2 priorities

Ordered by value against the product's purpose, not by effort.

1. **Close the access gap** — authentication in front of the dashboard.
2. **Hong Kong market data** — decide between a paid provider tier and an
   end-of-day HK source behind the existing provider abstraction. Without
   this the watchlist cannot serve its main purpose.
3. **Structured built-environment metadata** — typed project/developer/
   architect/location/status fields, populated by an LLM extraction pass over
   the retained excerpt, with every field traceable to its source. This is
   what turns the Property and Architecture sections from a feed into an
   intelligence tool.
4. **Proper full-text search (FTS5)** — better search, better AI context, and
   removes the 400-row scan ceiling.
5. **HKEX filings as a primary source** — completes the "primary document
   outranks commentary" principle for the watchlist.
6. **Morning delivery** — email or Telegram at the configured briefing time,
   so Tony does not have to open the site to get the brief.
7. **Alerts** — watchlist price moves and company filings.
8. **Cross-language clustering** — link the EN and 繁 reports of one event,
   most plausibly via entity overlap plus translated-title similarity.
9. **Headline translation** — populate `translatedTitle`, clearly labelled
   as AI-assisted, never attributed to the publisher.
10. **UI and end-to-end tests**, plus a formal accessibility pass.

## Part D — Rules any Phase 2 work must keep

These are in `CLAUDE.md` and are not negotiable: never invent production
data; every external fact keeps its provenance and source URL; delayed market
data is never labelled real-time; retrieval always precedes factual
generation and missing evidence is stated rather than filled; never present a
generated image as a real event; feed endpoints are verified before being
committed; ingestion and market providers stay modular behind their
interfaces; lint, typecheck, tests and build must pass before work is
considered done.
