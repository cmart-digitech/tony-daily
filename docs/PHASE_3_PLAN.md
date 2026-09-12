# THE DAILY — Phase 3 Plan

**Theme: from *what happened* to *what changed, and can you trust it*.**

Phase 1 built a verified feed. Phase 2 made it personal and spoken. Phase 3
adds **video**, and makes the record **accountable** — tracking how stories
move and when a publisher quietly rewrites one.

**Delivery mode:** branch → PR → `main`, as now. Nothing merges until
`npm run lint && npm run typecheck && npm test && npm run build` pass.

## Baseline

Commit `c1c95f8` live · 246 tests · Gemini→Groq failover with a circuit
breaker · 25 RSS sources · clustering, verification grading, entity
extraction, FTS5, `article_facts`, browser voice and audio briefings.

## Measured before planning

Two findings shape the two lead increments. Both were checked against the
live system rather than assumed.

**No video exists in the current sources.** Probed three times across
Phase 1 and Phase 3 planning: no `media:content medium="video"`, no video
enclosures, no `og:video`, and no embedded players on real article pages
from RTHK, SCMP, Dezeen or BBC. Video therefore cannot be an enrichment of
what we already fetch — it needs its own source class and its own
acquisition path. That is why P0 and P1 share machinery.

**Headline edits already arrive and are discarded.** `contentHash` covers
the title, but ingestion drops any item whose `canonical_url` is already
held, whatever changed. Every silent headline or excerpt edit a publisher
makes flows through the 30-minute refresh and is thrown away. P1 stops
throwing it away.

---

## P0 — Video news feed

The headline feature. Hong Kong **and** international.

### Acquisition

Three legitimate paths, in order of expected yield:

1. **YouTube channel RSS** — `youtube.com/feeds/videos.xml?channel_id=…`,
   an official documented feed returning title, thumbnail, publish time and
   video id. Most target outlets publish there, so one connector covers
   most of both lists. Channel-ID discovery is real work: the handle pages
   are JavaScript-rendered and cannot be scraped in one line.
2. **Publisher video-section feeds** where they exist separately from text.
3. **`og:video` / oEmbed during OG enrichment** — the page-fetching path
   already exists for images, so read video metadata while we are there.
   Current yield is zero; added sources may change that.

### Candidate sources — none enters the registry unverified

| Region | Candidates |
|---|---|
| Hong Kong | RTHK, TVB, Now News, HK01, SCMP |
| International — markets | BBC, Reuters, Bloomberg |
| International — built environment | Dezeen, ArchDaily |

Each is fetched and confirmed before being committed, exactly as every RSS
feed in `src/lib/sources/registry.ts` was. **Never a guessed URL.**

### The rule that shapes everything: embed, never re-host

Video is the most rights-encumbered content there is. Re-hosting it, or
extracting the media file to play in our own player, is straightforward
infringement — a far harder breach than the excerpt rule text lives under.

- Play through **the publisher's own embed**, branding and pre-roll intact.
  Stripping either circumvents their monetisation.
- Store **metadata only**: title, thumbnail, duration, source, canonical
  URL, video id. Never the file.
- **No autoplay**, ever, and never with sound.
- **Click-to-load, via `youtube-nocookie.com`.** The page makes no
  third-party request until Tony presses play — a thumbnail and a play
  button until then. Without this, opening TODAY would silently ping Google
  once per video card on screen.

### Product surface

- Video cards inside the existing photo-led grids, marked as video with a
  duration. They rank by the **same transparent weights** — never promoted
  for being video.
- A **VIDEO** section alongside ART and AUDIO.
- Clustering treats a video and a text report of one event as **one story
  with two renditions**, not two cards.

### Where video does not go

**Not into AI grounding.** A video we cannot read is not a source we can
cite, and the citation contract requires text actually retrieved. Officially
published, licensed captions are a separate later question — never an
assumption.

`docs/VIDEO_POLICY.md` is written **before** the first source is added, as
`ART_SOURCE_POLICY.md` was.

---

## P1 — Revision tracking

News sites quietly change headlines and figures after publishing, and tell
nobody. We already see it and discard it.

- New `article_revisions` table: `article_id`, `fetched_at`, `title`,
  `excerpt`, `content_hash`
- Ingestion records a revision instead of dropping a known URL whose hash
  changed
- Article view shows *"Headline changed 40 minutes after publishing"* with
  both versions
- A `REVISED` badge beside the existing verification grades

**Risk:** feeds sometimes re-emit cosmetically different titles. Calibrate
against the live index before a badge ships, with the same discipline the
clustering thresholds get.

---

## P2 — Primary sources and the scraping adapter

A `ContentSource` abstraction beside the RSS registry — **not** a second
pipeline. Shared with P0, which is why the two are sequenced together.

- **robots.txt honoured per host**, cached and re-checked
- Conditional requests (`ETag` / `If-Modified-Since`), which also makes P1
  affordable
- Per-domain concurrency limits and cooldowns
- Same provenance row; metadata and permitted excerpts only
- **Never** paywalls, CAPTCHAs, or rate-limit evasion

Verified during planning:

| Source | Status |
|---|---|
| `api.data.gov.hk` | Documented JSON API, bilingual, 11,027 archived files |
| Buildings Department | robots allows all but `/ecard/`; sitemap published |
| Lands Department | robots allows all but `/json/` |
| e-Gazette | Reachable; format needs assessment |
| Town Planning Board | **Not located** — guessed path 404s, no robots.txt. Discover properly or drop |

---

## P3 — Story threading

Promote clusters into **timelines**: first report → corroboration →
revision → follow-up. "Since your last visit" becomes *how your stories
moved*, not merely what is new. A `/story/[clusterId]` page holds the arc
with every source retained. Depends on P1 — revisions are what make a
thread worth reading.

## P4 — Divergence detection

Where a cluster's sources state different values for the same fact, surface
the disagreement rather than silently choosing one. Builds on
`article_facts` plus clustering, and makes structural what `CLAUDE.md`
currently only asks the model to do in a prompt.

## P5 — Entity dossiers

A page per developer, architect, project or district, assembling everything
held with full provenance. Entity extraction is currently lexical over ~22
names; this is where a cached LLM extraction pass earns its place.

## P6 — Forward calendar

Extract *dated future events* from sources — tender closings, results
dates, planning meetings — into "what to watch this week". Forward-looking
rather than archival.

## P7 — Provenance signals

The long bet, for a web filling with generated content.

- **C2PA content credentials** on images: read and display verifiable photo
  provenance
- **Earned source authority** — weights are hand-set constants today; let
  corroboration and revision history move them

---

## Testing and docs

Per increment: video metadata parsing and embed rendering, click-to-load
behaviour, revision detection against real feed churn, robots compliance,
thread assembly, divergence on known-disagreeing pairs, calendar accuracy.

Docs: `VIDEO_POLICY`, `SCRAPING_POLICY`, `REVISION_POLICY`,
`PHASE_3_ARCHITECTURE`, `PHASE_3_HANDOVER`. `CLAUDE.md` gains a video rule
beside the image rule, and a revision rule beside the data rules.

## Cost stance

Everything here runs on the current free tiers. Embedded video is served by
the publisher, so it costs nothing and hosts nothing. The cached LLM
extraction pass in P5 is the only meaningful new AI spend. The open Hong
Kong market-data decision (~US$29/mo) is unchanged and unrelated.

## Deliberately excluded

Comments, social feeds, sentiment scores, engagement metrics and price
prediction. Fashionable, noisy, and against the UX rule: maximum signal,
minimum noise.
