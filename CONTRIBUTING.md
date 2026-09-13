# Contributing to The Daily

The Daily is a private daily intelligence dashboard: Hong Kong and
international news, markets, property and architecture, assembled into one
brief. It is built on an absolute zero-hallucination policy — that rule
shapes almost every design decision here, so read
[CLAUDE.md](CLAUDE.md) before your first change. It is short, and it is not
negotiable.

## Get it running

You need Node 24 or newer — the version CI verifies against.

```bash
git clone https://github.com/cmart-digitech/tony-daily.git
cd tony-daily
npm install
cp .env.example .env.local
npm run dev
```

The app runs at http://localhost:3000.

It starts with **no keys at all**. News ingestion works immediately; AI and
market data show honest "not configured" states rather than failing. That is
by design — you can contribute to most of the codebase without registering
for anything.

### Getting your own keys

**Use your own keys. Never ask for, share, or commit someone else's.**
Both providers below are free and need no credit card.

| What it enables | Where to get one | Variable |
|---|---|---|
| AI summaries, brief, chat, audio scripts | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `GEMINI_API_KEY` |
| Market quotes and charts | [twelvedata.com](https://twelvedata.com) | `TWELVE_DATA_API_KEY` |

Put them in `.env.local`, which is gitignored and must stay that way. Every
other variable is documented in [.env.example](.env.example).

Configuring a **second** AI provider is worthwhile — when one free tier hits
its daily quota the next one serves the request automatically. See the
provider table in the [README](README.md#ai).

You do not need a hosted database. Without `TURSO_DATABASE_URL` the
dual-driver layer uses a local SQLite file, which is the right setup for
development.

### Useful commands

```bash
npm run dev        # dev server
npm test           # 190 tests
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build      # production build
node scripts/diagnose.mjs   # subsystem health check
```

## How we work

`main` is the deployed branch — pushing to it publishes to production. So all
work happens on a branch and lands through a pull request.

```bash
git checkout -b your-change
# ... work ...
npm run lint && npm run typecheck && npm test && npm run build
git push -u origin your-change
```

Then open a PR against `main`. CI runs the four gates on every push and
reports back on the PR.

**All four gates must pass before a PR is ready.** Fix failures rather than
documenting them.

Review your change by **running it locally** (`npm run dev`). Vercel does
build a preview for every branch, but those URLs sit behind Vercel's own
SSO — only accounts with access to the Vercel project can open them, which
is not the same list as this repository's collaborators. Do not rely on a
preview link being clickable for reviewers.

Previews run against their own database (`tony-daily-preview` on Turso),
never production: `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are scoped
per environment in Vercel. A preview therefore starts empty and fills itself
on first visit. Keep it that way — a preview sharing the production database
would run your branch's migrations and ingest against Tony's live data,
including the saved articles that cannot be recovered. Environment variables
apply to new deployments only, so a preview built before a variable changed
keeps the old value until it is rebuilt.

## Things that will get a PR sent back

These come from [CLAUDE.md](CLAUDE.md) and matter more than style:

- **Invented production data.** No fabricated news, prices, quotes,
  statistics, sources, URLs or images — ever. Missing data shows an honest
  empty or error state. Mock data is for tests only and must be labelled.
- **A source URL that was not fetched first.** Every feed in
  `src/lib/sources/registry.ts` was verified live before being committed.
  Never add a guessed URL.
- **Delayed market data presented as real-time.** Every price carries its
  fetch timestamp and a conservative entitlement label.
- **AI output that is not grounded in retrieval.** The model answers only
  from retrieved sources. Missing evidence is stated, never filled in.
  Citations must map to real retrieved articles.
- **A committed secret.** If you commit one by accident, say so immediately
  and rotate the key — rewriting history is not enough on a public repo.
- **A synchronous database call.** The data layer is async throughout so the
  same code runs on local SQLite and hosted libSQL.

## Where things live

| | |
|---|---|
| `src/app` | Routes and pages (Next.js App Router) |
| `src/lib/sources` | Feed registry and ingestion |
| `src/lib/ingest` | Dedup, clustering, classification, ranking |
| `src/lib/ai` | Providers, retrieval, grounding, audio scripts |
| `src/lib/market` | Market-data provider abstraction |
| `src/lib/db` | Dual-driver database layer + schema |
| `docs/` | Architecture, costs, policies, handover |
| `tests/` | Vitest suites |

`docs/PHASE_2_ARCHITECTURE.md` explains how the pieces fit together, and
`docs/PHASE_2_HANDOVER.md` records what exists, what is missing and why.

## Questions

Open an issue. If something in `CLAUDE.md` seems to block a sensible change,
raise it rather than working around it — the rules are deliberate, but they
are allowed to be discussed.
