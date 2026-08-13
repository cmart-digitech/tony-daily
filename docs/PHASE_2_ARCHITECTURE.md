# Phase 2 Architecture

One Next.js application, one database, provider abstractions at every
external boundary (brief §59). Additions land beside Phase 1 systems —
nothing was rebuilt.

```
Browser
  ├─ Voice: SpeechRecognitionProvider (browser) ─ mic → editable transcript
  ├─ TTS: TextToSpeechProvider (browser) ─ Listen buttons, MiniPlayer
  ├─ player-store: module-level state → persistent MiniPlayer (layout)
  └─ Reading Comfort: root data-attrs ← preferences

middleware.ts ─ session cookie gate (password and/or Google Sign-In,
  allowlist) · exempt: /login, /api/auth, /api/cron (bearer), /api/health

API routes
  /api/chat            retrieval → grounded answer (+ memories as prefs)
  /api/conversations*  library: list/search/rename/pin/archive/delete
  /api/memories        explicit user-controlled memory CRUD
  /api/audio           grounded broadcast scripts, cached per day/format/lang
  /api/alerts          user-created market alerts CRUD
  /api/facts           structured built-environment extraction (cached)
  /api/cron/ingest     feeds → dedupe → classify → cluster → rank → alerts
  /api/cron/brief      daily: ingest → translate → brief → Telegram

Data (Turso libSQL / local SQLite, additive migrations)
  articles(+translated_title), story_clusters, article_entities,
  article_facts, articles_fts, chat_conversations(+pinned/archived/lang),
  chat_messages, chat_fts, user_memories, audio_briefs, stock_alerts,
  alert_events, users, watchlist, saved, quotes/series cache, briefs,
  sync_logs, ai_summaries, user_preferences(comfort, lastVisitAt)

AI (provider-agnostic: Gemini free today)
  summaries · brief overview · chat · facts (verbatim-validated) ·
  headline translation (daily) · audio scripts (grounded, source ids kept)
```

Grounding invariants across every new surface: retrieval precedes
generation; citations map to real rows; conversation history is never
current evidence; memories are preferences, not facts; missing data states
itself; provenance travels with every fact (news URL, quote timestamp,
filing link, episode source list).
