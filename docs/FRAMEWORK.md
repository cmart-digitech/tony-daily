# The Daily — Framework

What exists, what is live, and what comes next. The phase-specific documents
carry the detail and the reasoning; this page is the whole picture on one
screen.

Live: https://tony-daily.vercel.app

---

## Phase 1 — live

**News engine**
25 verified RSS sources (HK Gov, RTHK, SCMP, BBC, Dezeen, ArchDaily,
designboom, HKEX, SFC)
Duplicate rejection + story clustering — one event, one card, all sources kept
Verification grading on every card: `PRIMARY_VERIFIED` / `CORROBORATED` /
`SINGLE_SOURCE`
Auto-categorisation into Hong Kong, Markets, Property, Architecture, Greater
China, Global
Transparent ranking (relevance, authority, recency, geography, corroboration,
novelty) — all weights editable

**AI**
Article summaries at three depths
Daily Brief overview
Ask The Daily — answers only from retrieved sources, with clickable citations

**Markets**
Watchlist with per-stock detail pages and charts
Every price stamped with its fetch time; missing quotes show an error, never
a fake number

**Interface**
Today, Markets, Property, Architecture, Watchlist, Saved, Search, Settings, Ask
Light / dark / system themes · EN / 繁體中文 / bilingual
Photo-led layouts, editorial placeholders when no image exists
Time-aware bilingual greeting on Hong Kong time

**Automation** — daily brief at 07:00 HKT, news refresh every 30 min

---

## Phase 2 — live since 10 September 2026

**Security** — password gate + Google Sign-In with an email allowlist, both
built and ready. **Currently switched off by choice** — the dashboard is
open to anyone with the link. `/api/health` reports `authEnabled: false`.

**Ask The Daily workspace**
Conversation library: save, rename, pin, archive, search past chats
User memories — explicit, inspectable, editable, deletable

**Voice**
Speak your question (English + 廣東話), transcript editable before sending
Listen to answers aloud, 0.75–1.5× speed
Voices ranked by quality — neural voices preferred over the flat robotic
defaults most systems list first
Figures spoken as a person would say them, not read aloud as symbols

**The Daily Audio**
Generated news briefings: quick ~2 min, morning ~5 min, deep ~10 min, plus
two-presenter dialogue
Mini-player that survives navigation, audio library, always dated
Only offers a briefing the AI can actually finish — a format it would cut
short is withheld, with the reason given

**Markets**
Interactive charts with range switching and crosshair
Watchlist groups
Price alerts with Telegram notification
HKEX filings rail

**Content**
Full-text search (FTS5)
Headline translation, labelled AI-assisted
Cross-language clustering — EN and 繁 reports of one event now link
Structured property/architecture facts, each traceable to source
HKEX + SFC as primary sources
New ART section — art, artists, exhibitions and the art market, not
art-world politics

**Comfort & accessibility** — text size, spacing, contrast, Comfort Mode,
Focus Reading, ▲/▼ signals so colour is never the only cue

**Reliability** — two AI providers that take turns: when one hits its quota
it stands down for exactly as long as it asked, and the other carries the work

---

## Phase 3 — planned

Detail and reasoning: [PHASE_3_PLAN.md](PHASE_3_PLAN.md)

**Video news** *(headline feature)*
Hong Kong and international — RTHK, TVB, Now, HK01, SCMP · BBC, Reuters,
Bloomberg · Dezeen, ArchDaily
A VIDEO section, plus video cards ranked inside the existing grids by the
same weights — never promoted for being video
One event, one story: a video and a written report of the same news link as
two renditions, not two cards
Played through the publisher's own embed, never re-hosted — metadata only,
nothing downloaded
Click-to-load: nothing contacts Google until you press play

**Revision tracking**
News sites quietly change headlines and figures after publishing and tell
nobody
The app already sees every edit on its 30-minute refresh — it currently
discards them
Both versions kept, with a `REVISED` badge: *"SCMP changed this headline 40
minutes after publishing"*
Publishers that revise quietly lose standing; ones that do not, gain it

**Primary sources**
Straight to the documents behind the news — HK open data API, Buildings
Department, Lands Department, the Gazette
A scraping layer that honours robots.txt, never touches paywalls, and stores
only what it is permitted to

**Story timelines**
A cluster becomes an arc: first report → corroboration → revision →
follow-up
"Since your last visit" becomes *how your stories moved*, not just what is new

**Disagreement detection**
When two sources give different numbers for the same fact, say so — instead
of silently picking one

**Entity dossiers** — a page per developer, architect, project or district,
assembling everything known with full provenance

**Forward calendar** — what is coming: tender closings, results dates,
planning meetings

**Provenance signals** — verifiable photo credentials (C2PA), and source
authority earned from track record rather than assumed

**Deliberately excluded** — comments, social feeds, sentiment scores,
engagement metrics, price prediction

---

## The rule underneath all of it

Every story carries its source, its timestamps and a link to the original.
Every AI answer is grounded in retrieved sources with citations. Market data
always carries its fetch time and entitlement. When something is unavailable,
the app says so — it never invents content.

That policy is not a preference; it is enforced in [CLAUDE.md](../CLAUDE.md)
and is what a pull request gets rejected for breaking.
