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
| AI (summaries, brief, chat, facts, translation, audio scripts) | Google Gemini, then Groq | Free tier (both) | Gemini primary; Groq serves the request when Gemini returns a quota or 5xx error. Translation moved to once-daily to protect the primary quota |
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

### Second provider: Groq (configured)

Groq's free tier — 30 req/min, 14,400 req/day, no credit card — is far
larger than Gemini's, which makes it the right fallback. It is configured
and verified working through the app's own adapter.

**Its reachability is intermittent, and that is worth recording.** On
9 Sept 2026 both `api.groq.com` and the `console.groq.com` signup pages
returned `HTTP 403 "Access denied. Please check your network settings."`
from this project's network, while OpenRouter, Mistral, xAI and Together
were all reachable at the same moment. The next day the same two checks
returned 200 and 401 — the block had cleared without any action. Treat it
as a transient per-IP/region block, not a permanent exclusion. If the
console will not load, retry later; OpenRouter (free models, no card,
~50 req/day) and Mistral are the alternatives.

**The default model needed updating.** `llama-3.3-70b-versatile`, the
model this project had configured, now 404s as retired. Checking the live
model list on 10 Sept 2026 and comparing the general-purpose candidates on
a Traditional Chinese task — the thing this provider is a fallback *for* —
`openai/gpt-oss-120b` and `qwen/qwen3.8-27b` both rendered "Northern
Metropolis" correctly as 北部都會區, while `openai/gpt-oss-20b` produced
北方都市. The 120b is now the default. Provider default models are worth
re-checking periodically; vendors retire them without notice.

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
