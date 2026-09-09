# THE DAILY — Phase 2 Plan (Personal Intelligence OS)

Maps the full Phase 2 brief ("Advanced Intelligence Platform") onto the
existing production application. Upgrade in place — no rebuild, no
regression of Phase 1 behaviour, all Phase 1 factuality rules intact.

**Delivery mode: LOCAL ONLY until Tony approves deployment.** Work is
committed locally and verified against the local dev server; nothing is
pushed while this flag stands.

## Baseline (verified before work began)

Commit `bba0261` · 153 tests, lint, typecheck, production build all passing
· production healthy (Turso, Gemini free tier, market data, cron + Actions
refresh). Already delivered earlier in Phase 2: password auth gate, FTS5
search, structured built-environment facts with verbatim grounding,
headline translation, cross-language clustering, HKEX/SFC Tier A sources,
Telegram brief delivery.

## Increments (brief priority order)

### P0 — Security & identity
- **Google Sign-In** (authorization-code flow, no new dependency) with an
  `AUTHORIZED_EMAILS` allowlist; issues the same HMAC session cookie as the
  password gate, which remains as fallback. `users` + additive columns.
  Needs Tony to create an OAuth client (GOOGLE_CLIENT_ID/SECRET) before it
  activates; code ships ready, fails closed to password/open reporting.
- Drive OAuth is a **separate later consent** (least privilege, drive.file)
  — documented in DRIVE_INTEGRATION.md, not bundled with sign-in.

### P1 — Ask Tony intelligence workspace
- Conversation library: list/open/continue/rename/pin/archive/delete,
  titles, timestamps, language; indexed search over messages (FTS5 table
  `chat_fts`), not a browser-side scan.
- **User memories**: explicit, inspectable, editable, deletable ("What Tony
  Daily Remembers" in Settings). Injected into chat context under a header
  that marks them as preferences — never as current facts; fresh retrieval
  always overrides old conversation content (tested).

### P2 — Voice
- `SpeechRecognitionProvider` abstraction; browser implementation
  (Web Speech API: `en-US`/`en-GB`, `yue-Hant-HK`) as the free path.
  Google Cloud STT documented as the upgrade path (needs GCP billing) in
  VOICE_ARCHITECTURE.md — not built until approved (§76).
- Mic button in Ask Tony: explicit start, visible recording state, live
  transcript, editable before send, language selector, graceful permission
  errors. No audio stored.
- Spoken answers: `TextToSpeechProvider` abstraction; browser
  `speechSynthesis` implementation (free, offline, has zh-HK voices).
  Listen button with play/pause/stop/replay and 0.75–1.5× speed. Voice and
  speed preferences persisted.

### P3 — The Daily Audio
- Anchor scripts generated server-side from the day's verified brief
  articles only (quick ≈2min / morning ≈5min / deep ≈10min), plus
  two-presenter dialogue formats. Stored in `audio_briefs` with date,
  language, format, transcript, source IDs and model — replayable, never
  presented as today's when old.
- Playback via browser TTS (no audio files to host = zero cost, no
  copyright-audio risk); persistent mini-player that survives navigation;
  AUDIO library page with regenerate/delete.

### P4 — Markets
- Interactive charts: range switching (1M/3M/6M/1Y from existing daily
  series; intraday when provider allows), crosshair with date + OHLC,
  accessible in both themes.
- Watchlist groups UI (schema already has `grp`); +/- signs and arrows so
  colour is never the only signal.
- **Alerts**: `stock_alerts` (price above/below, daily % move) checked from
  the cron using cached quotes, Telegram notification, full CRUD UI. Only
  ever created by explicit user action.
- Filings rail: HKEX regulatory announcements matched to watchlist names.
- HK intraday entitlement remains a **stop-and-report paid decision** (§76)
  — provider comparison lives in PHASE_2_COSTS.md.

### P5 — Art
- New ART section, image-led. Sources added only after live verification of
  feeds/terms (candidate set: The Art Newspaper, Artnet News, ArtAsiaPacific,
  Hyperallergic, e-flux; auction houses only if they expose legitimate
  feeds). `art` category + classifier rules + ART page. Structured auction
  entities (AuctionEvent/Lot) only where a legitimate structured source
  exists — otherwise deferred, never scraped or invented.

### P6 — Drive
- Deferred to its own increment: needs the same Google OAuth client plus
  Picker; design and scopes documented in DRIVE_INTEGRATION.md first.

### P7 — Reading Comfort
- Settings section: text size, line spacing, content density, contrast,
  article width, motion; Comfort Mode (≥44px targets, larger controls);
  Focus Reading on articles. All persisted, applied via CSS variables on
  the root — the premium design adapts, it is not replaced.

### P8 — Intelligence infrastructure
- "Since your last visit" on TODAY from tracked last-visit time + existing
  ranking. Chat/messages FTS. (FTS articles, translation, cross-language
  clustering, structured facts: already delivered.)

## Testing & docs
Tests per increment (auth allowlist, chat persistence/search/memories,
stale-conversation-vs-fresh-data, alert triggering, comfort persistence,
audio metadata dating, art classification). Docs: PHASE_2_ARCHITECTURE,
PHASE_2_COSTS (verified pricing only), VOICE_ARCHITECTURE,
MARKET_DATA_POLICY, ART_SOURCE_POLICY, DRIVE_INTEGRATION. CLAUDE.md gains
the Phase 2 rules (§75).

## Cost stance
Everything in this increment runs on free tiers (browser speech APIs, no
hosted audio, existing Gemini/Twelve Data/Turso). Paid options (Google STT/
TTS quality, HKEX entitlement, Notebook audio) are documented with verified
prices and await Tony's explicit go-ahead. Nothing is purchased.
