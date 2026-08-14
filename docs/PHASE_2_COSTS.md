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

## Why a Claude subscription cannot power this app

Claude Pro/Max cover the official surfaces only — claude.ai, Desktop and
Claude Code. **As of 4 April 2026 Anthropic explicitly ended subscription
quota access for third-party tools**, which is what Tony Daily would be.
Programmatic use requires API-key billing. Proxy tools that present a Max
subscription as an API endpoint exist; they breach the terms and are not
used here. The same is true of other vendors' consumer subscriptions
(ChatGPT Plus, Gemini Advanced): a chat subscription is not an API plan.

## Free-tier failover (implemented)

Rather than depend on one free quota, the AI layer now **fails over across
configured providers**: if one returns a quota/rate-limit or transient
error, the next configured provider serves the request. Order is Gemini
first (best Traditional Chinese), then Groq, OpenRouter, Mistral, xAI,
Anthropic. A rejected API key never triggers failover — it would fail
identically elsewhere. Setting `AI_PROVIDER` explicitly pins one provider
and disables failover.

Practical effect: adding a second free key roughly removes daily-quota
outages.

### Which second provider — Groq is not available on this network

Groq's free tier (verified 13 Aug 2026: 30 req/min, 14,400 req/day, no
credit card) is far larger than Gemini's and would be the obvious choice.
**It cannot be used from this network.** Both `api.groq.com` and the
`console.groq.com` signup pages return `HTTP 403 "Access denied. Please
check your network settings."`, so no key can be created in the first
place. Groq support treats this as a regional/IP block rather than an
account problem.

Reachability from this project's network, all probed 14 Aug 2026:

| Provider | Result | Verdict |
|---|---|---|
| OpenRouter | HTTP 200 | Reachable — **recommended second provider** |
| Mistral | HTTP 401 (no key sent) | Reachable |
| Together AI | HTTP 401 (no key sent) | Reachable |
| xAI | HTTP 401 (no key sent) | Reachable, but paid |
| Groq | HTTP 403 access denied | **Blocked, API and console** |

OpenRouter is therefore the second provider to configure: free models, no
credit card, ~50 requests/day. That daily cap is far smaller than Groq's,
so it is a safety net for a Gemini outage rather than a co-primary — but a
free tier that answers beats a larger one that refuses the connection.

Note the production app runs on Vercel in Tokyo, not on this network, so
Groq's API might well be reachable from the deployed functions. It stays
unusable regardless, because the key has to be created through the blocked
console first.

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
