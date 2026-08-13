# Phase 2 — Cost Position

Rule: nothing is purchased without Tony's explicit go-ahead (§76). Prices
below are stated only where they were verified during this project; anything
else says "verify current pricing" rather than guessing.

## Running today: HK$0 / month

| Component | Provider | Tier | Notes |
|---|---|---|---|
| Hosting + functions + daily cron | Vercel Hobby | Free | Functions pinned to Tokyo |
| Database | Turso | Free (no card) | 5 GB, 500M row reads/mo — verified 13 Aug 2026 |
| News ingestion (25 feeds) | Publishers' RSS | Free | Polite cadence, cooldowns |
| 30-min refresh + Pages | GitHub Actions/Pages | Free (public repo) | Unmetered on public repos |
| AI (summaries, brief, chat, facts, translation, audio scripts) | Google Gemini | Free tier | Daily request quota — exhausting it degrades honestly to 429 messages; translation moved to once-daily for this reason |
| Market data (US/FX) | Twelve Data | Free (800 req/day) | Quotes cached 60 s |
| Speech-to-text (EN + 廣東話) | Browser Web Speech API | Free | Chromium supports yue-Hant-HK |
| Text-to-speech (briefs, answers) | Browser speechSynthesis | Free | Device voices incl. zh-HK; no audio hosted |
| Telegram delivery + alerts | Telegram Bot API | Free | |

## Paid options awaiting Tony's decision

| Service | Why | Verified cost | Status |
|---|---|---|---|
| Twelve Data Grow | Hong Kong equities (0700.HK etc.) intraday | ~US$29/mo (verified 12 Aug 2026) | **Decision needed** — the single biggest functional gap |
| Google Cloud Speech-to-Text | Server-grade Cantonese STT beyond the browser | Verify current pricing before any commitment | Optional; browser STT works today |
| Google Cloud / other neural TTS | Higher-quality voices than device TTS | Verify current pricing | Optional; abstraction ready (`TextToSpeechProvider`) |
| Anthropic API | Alternative AI provider | ~US$5 starter credits, then paid (verified 13 Aug 2026) | Declined by Tony; provider abstraction keeps it available |
| Notebook/Audio-Overview API | Podcast generation service | Availability/pricing unverified | Not built; native pipeline works without it (§18) |

## Cost controls in place

Summaries cached by content hash + provider:model · audio scripts cached per
day/format/language · translation once daily, bounded · facts extracted once
per article, verbatim-validated · quotes cached 60 s, series 15 min · all AI
and speech endpoints rate-limited · nothing regenerates unless asked.
