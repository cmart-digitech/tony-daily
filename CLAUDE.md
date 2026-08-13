# CLAUDE.md — Tony Daily

Enduring rules for anyone (human or Claude) working on this codebase.

## Absolute rule

**Never add fake production data.** No invented news, prices, quotes,
statistics, sources, URLs, images or entity relationships — ever. Mock data
is allowed in development/tests only and must be unmistakably labelled
`DEMO / MOCK DATA — NOT LIVE`. Production shows honest empty/error states
when data is missing.

## Data rules

- External facts require provenance: every article row keeps its source id,
  original headline, original language, canonical URL, publish + fetch
  timestamps, and verification status (`PRIMARY_VERIFIED` / `CORROBORATED` /
  `SINGLE_SOURCE`).
- The original source URL must be retained and remain one click away in the UI.
- Never silently rewrite an original headline. Translations are labelled as
  AI-assisted and never attributed to the publisher.
- Store only metadata + permitted excerpts — never full copyrighted articles.
- Never circumvent paywalls, robots rules, CAPTCHAs or rate limits.

## Source rule

Every feed endpoint in `src/lib/sources/registry.ts` was verified live before
being committed. **Never add a guessed URL** — fetch it first and confirm it
returns valid RSS. Keep sources config-driven; never scatter feed URLs
through the code.

## Market rule

Never label delayed data as real-time. Every displayed price carries its
fetch timestamp (`Updated HH:mm HKT`) and a conservative entitlement label.
Missing quotes show an error state, never a plausible placeholder. Market
data API keys live server-side only.

## AI rules

- Retrieval before factual generation, always. The model answers only from
  retrieved indexed sources and labelled market data (`src/lib/ai`).
- Missing evidence → say "Information unavailable from the currently
  connected sources." Never fill gaps.
- Never invent causes for price movements. Separate FACT from labelled
  INTERPRETATION. No personalised buy/sell advice.
- Citations must map to real retrieved articles; never fabricate one.
- Cache summaries by content hash + language + level + model (cost control);
  truncate/clean inputs before sending to the API.
- `ANTHROPIC_API_KEY` is server-side only; never expose it to the browser.

## Image rule

Never generate an artificial image and present it as a real event. Image
priority: authentic source image → official project image → permitted
publisher preview → licensed contextual (labelled illustrative) → elegant
typographic placeholder. An unavailable photo beats a misleading photo.

## Code rules

- Keep ingestion providers and the market-data provider modular behind their
  interfaces (`src/lib/sources`, `src/lib/market/types.ts`).
- The database layer is dual-driver (`src/lib/db`): local SQLite file for dev,
  hosted libSQL/Turso when `TURSO_DATABASE_URL` is set. All data access is
  **async** (`await getDb()`, `await …run()/all()/get()`) so both drivers work
  identically — never reintroduce synchronous better-sqlite3 calls.
- Clustering similarity is calibrated against real headlines, not intuition.
  If you change the thresholds in `src/lib/ingest/index.ts`, re-run
  `node scripts/cluster-probe.mjs` and confirm true pairs stay above the cut
  and false pairs stay below it.
- Ranking weights and interest weights are user preferences, not constants.
- Validate all API input (zod), keep cron endpoints secret-protected,
  rate-limit AI endpoints.
- Before adding a dependency: check the repo, verify current stable versions,
  prefer the smallest practical set.
- `npm run lint && npm run typecheck && npm test && npm run build` must pass
  before considering work done. Fix errors, don't document them.

## UX rule

Minimal, architectural, information-rich. Bilingual (EN / 繁體中文 / 雙語).
Light + dark + system themes with equal readability. Every module shows its
data freshness. Quality over quantity — the product goal is maximum signal
with minimum noise, not engagement.
