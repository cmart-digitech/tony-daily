# PROJECT: TONY DAILY

You are the lead product engineer, UX designer, data architect and AI engineer responsible for building a working MVP of a private, personalised intelligence dashboard for **Tony Wong**.

Do not merely produce a concept or mockup.

Build the working application.

---

# 1. PRODUCT VISION

Create a private daily intelligence dashboard for Tony Wong, a retired professional architect with strong interests in:

- Stock markets and investing
- Hong Kong and international equities
- Property development
- Real estate
- Architecture
- Urban development
- Construction and the built environment
- Design
- Infrastructure
- Hong Kong
- Greater China
- Asia-Pacific
- Important global business and economic developments

The application should feel like a highly curated combination of:

- a personal Bloomberg-style intelligence terminal
- a premium architecture/design publication
- a personalised daily newspaper
- a stock watchlist
- an AI research assistant

It must NOT feel like a generic RSS reader.

Working product name:

**TONY DAILY**

Alternative internal description:

**Tony's Personal Market + Built Environment Intelligence Terminal**

---

# 2. ABSOLUTE PRODUCT PRINCIPLES

These rules override everything else.

## FACTS FIRST

Never fabricate:

- news
- quotations
- prices
- statistics
- dates
- companies
- projects
- stock movements
- source names
- URLs
- government announcements
- architectural information
- property transactions
- images

If verified information is unavailable, say:

> Information unavailable from the currently connected sources.

Do not fill gaps using invented content.

---

# 3. ZERO-HALLUCINATION NEWS POLICY

Every displayed news story must have:

- source/publisher
- original headline
- publication date
- publication time if available
- direct source URL
- ingestion timestamp
- language
- image source where applicable

Every AI-generated summary must remain traceable to the underlying source.

Do not present AI-generated statements as sourced facts unless supported by retrieved source material.

For important claims involving:

- stock movements
- corporate actions
- earnings
- mergers/acquisitions
- government policy
- land sales
- planning decisions
- major property developments
- regulatory decisions
- major construction projects

use one of these verification paths:

### VERIFIED PRIMARY
The information comes directly from an authoritative primary source.

Examples:

- HKEX filing
- listed-company announcement
- government department
- regulator
- official company investor-relations announcement
- planning authority
- statutory body

Label internally:

`PRIMARY_VERIFIED`

### CORROBORATED
At least two credible independent sources report substantially the same event.

Label internally:

`CORROBORATED`

### SINGLE SOURCE
Only one credible source currently exists.

The application may show the story but must not embellish it.

Label internally:

`SINGLE_SOURCE`

Never convert speculation, rumours or anonymous social-media posts into factual news.

---

# 4. SOURCE HIERARCHY

Build the news ingestion system using configurable source adapters.

Prefer official APIs and RSS feeds before HTML scraping.

Never circumvent:

- paywalls
- authentication
- CAPTCHA
- robots restrictions
- publisher access controls
- rate limits
- copyright restrictions

Do not copy full copyrighted articles into our database.

Store only what is necessary:

- metadata
- headline
- permitted excerpt
- URL
- publication data
- classification
- AI-generated factual summary

---

# 5. TIER A — PRIMARY SOURCES

Give these the highest authority score.

## Hong Kong Markets / Finance

Prioritise sources such as:

- Hong Kong Exchanges and Clearing — HKEX
- HKEX issuer announcements
- Securities and Futures Commission — SFC
- Hong Kong Monetary Authority — HKMA
- Hong Kong Census and Statistics Department
- Rating and Valuation Department

## Hong Kong Government / Development

Prioritise:

- Hong Kong Government News
- Development Bureau
- Planning Department
- Lands Department
- Buildings Department
- Transport and Logistics Bureau
- Housing Bureau
- Housing Authority
- Urban Renewal Authority
- Legislative Council where relevant
- MTR official corporate announcements

## Built Environment

Prioritise authoritative professional or institutional sources where appropriate:

- Hong Kong Institute of Architects
- Hong Kong Green Building Council
- RIBA
- CTBUH
- relevant planning authorities
- recognised professional bodies
- official developer/project announcements

Primary-source information should normally outrank media commentary.

---

# 6. TIER B — HIGH-QUALITY JOURNALISM

Support reputable editorial publishers where feeds, APIs, licensing or permitted metadata access are available.

Examples may include:

- Reuters
- Associated Press
- Bloomberg
- Financial Times
- Wall Street Journal
- South China Morning Post
- RTHK News

Do NOT bypass subscription systems.

If only the headline and metadata are legitimately available, show those and link to the publisher.

---

# 7. TIER C — BUILT ENVIRONMENT / DESIGN MEDIA

Use reputable specialist publications for architecture and design coverage.

Potential categories include sources such as:

- ArchDaily
- Dezeen
- Designboom
- CTBUH
- RIBA
- recognised architecture publications
- recognised property-development publications
- recognised construction publications

These should be treated as specialist editorial sources rather than government/primary evidence.

---

# 8. PROPERTY RESEARCH SOURCES

Support reputable research and market reports where legally accessible from firms such as:

- CBRE
- JLL
- Savills
- Colliers
- Knight Frank
- Cushman & Wakefield
- ULI
- RICS

Clearly distinguish:

**research / analysis**

from:

**official statistics / confirmed transactions**

Never make brokerage research appear to be an official government statistic.

---

# 9. CANTONESE + ENGLISH

This application must be bilingual.

Primary interface options:

**EN**
English

**繁**
Traditional Chinese / Hong Kong

**雙語**
Bilingual

Use `zh-HK` conventions.

Where appropriate, Tony's chatbot may respond in natural Hong Kong Cantonese written in Traditional Chinese.

However:

### ORIGINAL SOURCE

Never silently rewrite the original source headline.

Store:

- `original_title`
- `original_language`

### TRANSLATION

If translating:

- label translation clearly
- preserve names, numbers, stock codes, dates and technical terms accurately
- never change the meaning
- retain access to the original headline

Example:

**原文**
Original headline

**中文摘要**
AI-assisted Cantonese/Traditional Chinese summary

or

**English Summary**
AI-assisted English summary

AI translation must never be represented as text written by the original publisher.

---

# 10. NEWS PERSONALISATION

Build Tony's preference profile as editable settings.

Initial interest categories:

### HIGH PRIORITY

Markets & Equities

Property Development & Real Estate

Architecture & Built Environment

### SECONDARY

Hong Kong Economy

Greater China

Asia-Pacific

Global Economy

Infrastructure

Urban Development

Construction

Design

Technology relevant to property/architecture

Sustainability

AI relevant to markets or the built environment

Allow Tony to adjust the weighting later using sliders.

Example:

Markets & Equities  
`█████████ 90`

Property  
`████████ 80`

Architecture  
`████████ 80`

Infrastructure  
`██████ 60`

Technology  
`█████ 50`

Do not hardcode these values permanently.

---

# 11. GEOGRAPHIC PRIORITY

Default ranking:

1. Hong Kong
2. Greater China
3. Asia-Pacific
4. Global

But global stories can rank above regional stories if their importance is materially greater.

Example:

A major global market event affecting Hong Kong equities should rank highly.

---

# 12. NEWS RANKING ENGINE

Create a transparent relevance score.

Consider:

- recency
- source authority
- Tony's interest profile
- geographic relevance
- relationship to Tony's stock watchlist
- corroboration
- significance
- novelty

Do NOT optimise for:

- sensationalism
- outrage
- clickbait
- celebrity content
- engagement bait

A possible starting formula:

`30% personal relevance`

`25% source authority`

`20% recency`

`10% geographic relevance`

`10% corroboration`

`5% novelty`

Make weights configurable.

---

# 13. STORY CLUSTERING

Do not show five separate cards simply because five publishers reported the same event.

Cluster similar stories.

Example:

### Hong Kong residential transactions rise...

**Primary:** Rating and Valuation Department

Also reported by:

- Reuters
- RTHK
- SCMP

Then produce ONE consolidated story.

Store all supporting sources.

Use:

- canonical URLs
- title similarity
- entity matching
- semantic similarity if available

to reduce duplicates.

---

# 14. DAILY BRIEF

Create a primary homepage module:

# GOOD MORNING, TONY

`Wednesday · 12 August · Hong Kong`

## Your Daily Brief

Automatically build a high-quality daily briefing.

Aim for approximately 8–15 meaningful stories rather than 50 low-value articles.

Suggested structure:

### MARKET SNAPSHOT

Major indexes relevant to Tony.

### TONY'S WATCHLIST

Important movements or filings involving companies he follows.

### HONG KONG

Most important local developments.

### PROPERTY + DEVELOPMENT

Land, housing, commercial property, development, urban renewal and major projects.

### ARCHITECTURE + BUILT ENVIRONMENT

Important architecture, design, infrastructure and construction developments.

### GREATER CHINA / ASIA

Only meaningful items.

### GLOBAL WATCH

Major events relevant to markets/property/business.

Prioritise quality over quantity.

---

# 15. THREE SUMMARY LEVELS

Every story should allow Tony to choose:

### 30 SEC

2–3 factual bullets.

### 2 MIN

A concise summary covering essential context.

### DEEP DIVE

More detailed synthesis using all available verified sources.

The source list must remain visible.

---

# 16. STOCK WATCHLIST

Create a personal stock-market dashboard.

Tony must be able to:

- search ticker
- add stock
- remove stock
- reorder stocks
- group stocks
- favourite stocks

Do NOT invent an initial investment portfolio.

Start with an empty watchlist during onboarding.

Allow:

- Hong Kong equities
- US equities
- major indexes
- ETFs where supported
- other markets supported by the connected provider

---

# 17. STOCK CARD

Each stock should display available factual information such as:

**0700.HK**

Tencent Holdings

`HK$ XXX.XX`

`+X.XX%`

Then where supported:

- current/latest price
- absolute change
- percentage change
- previous close
- open
- day high
- day low
- volume
- 52-week range
- small price chart
- exchange
- currency
- market status
- quote timestamp

CRITICAL:

Always display something like:

`Updated 16:02 HKT`

and:

`Real-time`

or

`Delayed`

or

`End-of-day`

based only on the actual market-data entitlement.

Never label delayed prices as live.

---

# 18. MARKET DATA ARCHITECTURE

Use a provider abstraction:

```text
MarketDataProvider

getQuote()
getTimeSeries()
searchSymbol()
getMarketStatus()
```

For MVP, support a legitimate market-data provider such as Twelve Data if credentials are available.

Keep the abstraction clean so another licensed provider or official feed can replace it later.

Do NOT scrape Google Finance or similar websites as the primary financial-data architecture.

Store API keys server-side only.

Never expose financial API credentials to the browser.

---

# 19. STOCK ↔ NEWS INTELLIGENCE

Link Tony's watchlist to relevant news.

For each watched company show:

### RELATED TODAY

Company announcements

Earnings

Management changes

Regulatory filings

Corporate actions

Major credible news

Relevant market developments

When possible, prioritise the company's official filing or exchange announcement over commentary about that announcement.

---

# 20. NO FINANCIAL HALLUCINATION

The chatbot must never invent reasons for price movements.

Bad:

> The stock fell because investors were worried about margins.

unless sources explicitly support this.

Better:

> Shares declined 3.2% today. Reuters reported X, while the company's HKEX filing announced Y. The available sources do not establish a definitive single cause for the price movement.

Separate:

**FACT**

from:

**INTERPRETATION**

If offering interpretation, label it clearly.

Do not provide personalised buy/sell instructions by default.

Include:

`Market information is provided for informational purposes and is not financial advice.`

---

# 21. PHOTOS ARE A MAJOR PART OF THE PRODUCT

The dashboard should be highly visual.

Architecture and property stories in particular should contain substantial imagery whenever legitimate imagery is available.

Use:

1. publisher-provided permitted preview images
2. RSS media/enclosure images
3. permitted Open Graph preview images where appropriate
4. official government/project imagery
5. official developer/architect imagery where permitted
6. licensed image APIs such as Unsplash/Pexels as contextual fallback

Always preserve required attribution.

---

# 22. CRITICAL IMAGE RULE

NEVER use generative AI to create an image pretending to show an actual news event.

Never create:

- fake building photographs
- fake politicians
- fake stock exchange photographs
- fake project renderings
- fake construction photographs

and display them as news imagery.

If no authentic story image is legally available:

use either:

- properly licensed contextual imagery clearly identified as illustrative

or preferably:

- an elegant graphic placeholder

An unavailable photograph is better than a misleading photograph.

---

# 23. IMAGE-RICH EDITORIAL DESIGN

Use photographs substantially.

Homepage:

- large hero story
- large 16:9 hero image
- secondary editorial cards
- architecture/property cards with generous imagery
- occasional full-width visual feature

Avoid turning everything into tiny thumbnails.

For visual subjects such as architecture:

allow more space for photographs than ordinary finance stories.

Use responsive `object-fit` behaviour and appropriate image optimisation.

Use lazy loading.

---

# 24. VISUAL DESIGN DIRECTION

Design should draw inspiration from the principles of:

### BLOOMBERG

Information density

Market intelligence

Data hierarchy

### APPLE

Whitespace

Clarity

Typography

Restraint

Precision

### ZAHA HADID ARCHITECTS

Architectural sophistication

Strong compositions

Controlled asymmetry

### 10 DESIGN

Contemporary architectural editorial presentation

### DOA / ODA REFERENCE

Do not assume which specific "DOA" design reference is intended unless a reference URL is supplied later.

Do not copy another company's website.

Use these only as conceptual design references.

---

# 25. DESIGN LANGUAGE

Overall:

**Minimal. Architectural. Intelligent. Timeless.**

Avoid:

- excessive gradients
- crypto-dashboard aesthetics
- excessive neon
- unnecessary animation
- glassmorphism everywhere
- overly rounded children's-app cards
- clutter
- giant empty hero typography
- generic AI purple styling

Use strong grids.

Allow occasional asymmetrical architecture-inspired layouts.

Typography should be premium, highly readable and restrained.

Use system fonts or legally distributable web fonts.

---

# 26. WHITE + DARK MODE

Provide:

☀ Light

☾ Dark

◐ System

Persist preference.

### LIGHT MODE

White / off-white

Black / charcoal typography

Fine grey separators

Minimal accent colour

### DARK MODE

Near-black / charcoal

Off-white typography

Muted separators

Images retain natural appearance

Do not simply invert images.

Both themes must have equivalent accessibility and readability.

---

# 27. HOME NAVIGATION

Desktop navigation could include:

**TODAY**

**MARKETS**

**PROPERTY**

**ARCHITECTURE**

**WATCHLIST**

**SAVED**

and:

**ASK TONY DAILY**

Mobile should use a compact navigation pattern.

---

# 28. TOP MARKET STRIP

Create a restrained Bloomberg-inspired data strip.

Example:

```text
HSI      24,xxx   +0.xx%
S&P 500   x,xxx   -0.xx%
NASDAQ    xx,xxx  +0.xx%
USD/HKD    x.xxxx
```

Only display markets for which actual current data exists.

Never populate missing values using placeholders that look real.

---

# 29. PERSONAL AI ASSISTANT

Create a persistent assistant:

# ASK TONY DAILY

It should understand Tony's:

- daily news
- saved articles
- stock watchlist
- interests
- available market data
- indexed source material

Example questions:

> What's important today?

> 今日香港地產有咩重要新聞？

> Summarise the latest property-development news.

> What happened to my watchlist today?

> Any major HKEX announcements from companies I follow?

> Summarise these five articles.

> Give me the architecture news only.

> 最近香港城市發展有咩值得留意？

> Compare what Reuters and RTHK reported about this story.

---

# 30. CHATBOT GROUNDING RULES

The chatbot must use retrieval before answering factual questions.

Recommended flow:

```text
question
↓
detect intent
↓
search indexed source database
↓
retrieve relevant articles / filings / stock data
↓
construct grounded context
↓
Claude
↓
answer with citations
```

For current market questions:

retrieve fresh market data first.

For current news questions:

retrieve the latest stored sources first.

Never answer a time-sensitive question using model memory when current information is expected.

---

# 31. CHATBOT CITATIONS

Answers should include clickable citations.

Example:

> The URA received seven tenders for the project on 27 July. [URA]

Clicking the citation should:

- identify publisher
- show article title
- show publication date
- open original source

For multiple sources:

`Sources: HKEX · Reuters · RTHK`

Do not produce fake citations.

---

# 32. CHATBOT UNCERTAINTY

When the evidence is insufficient, say so.

Example:

> I found reports confirming the price movement, but none of the currently indexed reliable sources establishes a definitive cause.

This behaviour is preferred to speculation.

---

# 33. USER-CONTROLLED SUMMARY

Every article should provide:

`Summarise`

`Ask about this`

`Save`

`Open source`

When Tony presses **Summarise**, do not search unrelated material automatically.

Summarise the selected source or cluster faithfully.

---

# 34. MORNING BRIEFING

Build support for generating Tony's briefing once per day.

Default timezone:

`Asia/Hong_Kong`

Default briefing time can initially be configured as:

`07:00`

but it MUST be editable.

Store the user's preferred briefing time.

The dashboard should also have:

`Refresh Brief`

so Tony does not need to wait for the scheduled briefing.

---

# 35. TIMELY NEWS INGESTION

Design ingestion workers for:

### RSS/API SOURCES

Check approximately every 10–20 minutes where reasonable and permitted.

### SLOWER SOURCES

Check less frequently based on:

- publisher rules
- rate limits
- update patterns
- API allowance

### STOCK INFORMATION

Refresh frequency must comply with the connected provider.

Never hammer publishers.

Implement:

- caching
- retries
- exponential backoff
- rate limiting
- timeout handling

---

# 36. DATA MODEL

Create an appropriate schema around entities similar to:

```text
Source
Article
StoryCluster
ArticleSource
Category
Entity
ArticleEntity
UserPreference
Watchlist
WatchlistItem
SavedArticle
MarketQuote
MarketTimeSeries
DailyBrief
DailyBriefItem
ChatConversation
ChatMessage
SyncLog
```

Suggested Article fields:

```text
id
sourceId
canonicalUrl
originalTitle
originalLanguage
translatedTitle
excerpt
publishedAt
fetchedAt
imageUrl
imageAttribution
sourceAuthor
contentHash
verificationStatus
category
region
```

Do not store full copyrighted articles unless licensing explicitly permits it.

---

# 37. DEDUPLICATION

Implement duplicate detection using a combination of:

- canonical URL
- normalised headline
- source ID
- publication time
- title similarity
- entity overlap

Avoid sending duplicate content to Claude unnecessarily.

---

# 38. SEARCH

Create full-text search across:

- news titles
- summaries
- entities
- stock symbols
- company names
- architecture firms
- developments
- locations

Example:

`Kai Tak`

could return:

News

Property projects

Infrastructure

Companies

Saved stories

---

# 39. IMPORTANT ENTITIES

Extract entities where possible:

- company
- stock ticker
- architect
- developer
- contractor
- project
- government department
- location
- city
- building
- index
- regulator

This will later allow richer intelligence relationships.

Do not invent entity relationships.

---

# 40. TECHNOLOGY STACK

Use a pragmatic modern TypeScript stack.

Preferred:

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui where beneficial
- server-side API routes/actions
- SQLite for simple local MVP persistence OR PostgreSQL if deployment requires it
- ORM such as Drizzle or equivalent
- RSS parser
- permitted HTML parsing only where needed

Do NOT blindly use version numbers from model memory.

Before installing dependencies:

1. inspect the existing repository
2. verify current stable packages/documentation
3. avoid deprecated dependencies
4. choose the smallest practical dependency set

Keep the architecture modular.

---

# 41. CLAUDE INTEGRATION

Use the official Anthropic API from the SERVER only.

Never expose the Anthropic key to the browser.

Abstract AI functionality:

```text
AIService

summarizeArticle()
summarizeCluster()
answerQuestion()
translateSummary()
generateDailyBrief()
```

All factual AI operations must receive retrieved source material as context.

Use structured responses where appropriate.

---

# 42. COST CONTROL

Do not send entire articles to the LLM unnecessarily.

Before AI calls:

- deduplicate
- clean HTML
- remove navigation
- extract useful text
- truncate appropriately
- cache existing summaries

Store generated summaries keyed by:

- content hash
- language
- summary level
- model

If the underlying article has not changed, reuse the cached summary.

---

# 43. IMAGE SERVICE

Create an abstraction:

```text
ImageService

getStoryImage()
getFallbackImage()
getAttribution()
```

Priority:

```text
authentic source image
↓
official project image
↓
permitted publisher preview image
↓
licensed contextual image
↓
neutral placeholder
```

Never use an unrelated dramatic image simply because it increases engagement.

---

# 44. ERROR STATES

Never show fake data to hide an API error.

Use clear states:

`Market data temporarily unavailable.`

`No verified stories found.`

`Source could not be refreshed.`

`Image unavailable.`

`API credentials not configured.`

---

# 45. DEVELOPMENT / MOCK DATA

Mock data may be used during development ONLY.

Development data must be unmistakably labelled:

**DEMO / MOCK DATA — NOT LIVE**

Production mode must never fall back to realistic-looking invented prices or news.

If production credentials are missing, show an empty state.

---

# 46. ONBOARDING

First launch should ask Tony for:

## LANGUAGE

English

繁體中文

Both

## INTERESTS

Markets

Property

Architecture

Built Environment

Infrastructure

Hong Kong

Greater China

Global Business

Technology

etc.

## WATCHLIST

Allow him to search and add securities.

Do not assume Tony owns any company.

## BRIEFING

Preferred morning briefing time.

## THEME

Light

Dark

System

Keep onboarding quick and elegant.

---

# 47. RESPONSIVE EXPERIENCE

Prioritise:

1. desktop
2. tablet
3. mobile

Desktop should feel like a premium professional intelligence environment.

Mobile should still make the Daily Brief exceptionally easy to consume.

---

# 48. ACCESSIBILITY

Implement:

- keyboard navigation
- appropriate colour contrast
- semantic HTML
- accessible buttons
- alt text where factual
- focus states
- reduced-motion support
- responsive text sizing

---

# 49. PERFORMANCE

Aim for:

- fast initial load
- server-rendered important content
- image optimisation
- lazy-loaded secondary imagery
- cached RSS/API responses
- minimal unnecessary client JavaScript
- skeleton states where appropriate

---

# 50. SECURITY

Treat this as a private personal dashboard.

At minimum:

- secrets server-side only
- `.env.local`
- `.env.example`
- `.gitignore`
- input validation
- sanitise parsed external content
- protect server endpoints
- rate-limit AI endpoints
- prevent arbitrary URL fetching
- protect cron endpoints
- do not commit secrets

If deployed publicly, add simple secure authentication.

---

# 51. ENVIRONMENT VARIABLES

Prepare an `.env.example` similar to:

```bash
ANTHROPIC_API_KEY=

MARKET_DATA_PROVIDER=
TWELVE_DATA_API_KEY=

UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=

APP_TIMEZONE=Asia/Hong_Kong

CRON_SECRET=

DATABASE_URL=
```

Only require credentials that are actually used.

---

# 52. SOURCE CONFIGURATION

Sources should be configuration-driven rather than scattered through code.

Example concept:

```typescript
{
  id: "rthk-en",
  name: "RTHK",
  language: "en",
  region: "HK",
  type: "rss",
  authority: 90,
  categories: ["general", "markets"],
  enabled: true
}
```

and:

```typescript
{
  id: "hk-gov-zh",
  name: "香港政府新聞網",
  language: "zh-HK",
  region: "HK",
  type: "rss",
  authority: 100,
  categories: ["government", "property", "infrastructure"],
  enabled: true
}
```

Verify actual feed endpoints before committing them.

Never invent an endpoint.

---

# 53. SOURCE ADMIN PANEL

Create a simple settings page showing:

SOURCE

LANGUAGE

TYPE

LAST SYNC

STATUS

ENABLED

Example:

```text
RTHK              EN     RSS      3 min ago    ● Healthy
香港政府新聞網       繁     RSS      6 min ago    ● Healthy
HKEX               EN/ZH  API      2 min ago    ● Healthy
```

This will make failures visible instead of silently producing stale content.

---

# 54. DATA FRESHNESS

Every major module should tell Tony how fresh it is.

Examples:

`News refreshed 4 minutes ago`

`HKEX filings checked 7 minutes ago`

`Market data updated 16:02 HKT`

Never hide stale data.

---

# 55. SAVED / READING LIST

Allow Tony to:

- save article
- unsave
- filter saved stories
- search saved stories

Potential later addition:

personal notes.

For MVP, saving is enough.

---

# 56. ARTICLE VIEW

The article intelligence page should show:

Large authentic image when available

CATEGORY

Original headline

Translated headline if applicable

Source

Published timestamp

Verification status

### 30-SECOND SUMMARY

### KEY FACTS

### RELATED COMPANIES

### RELATED PROJECTS

### RELATED STORIES

### SOURCES

### ASK TONY DAILY ABOUT THIS

The original source should always remain one click away.

---

# 57. ARCHITECTURE MODE

Architecture stories deserve stronger imagery.

For architecture/design/project stories, if legitimate images are available:

- use larger hero photography
- allow image galleries
- show architect
- location
- project name
- developer/client where verified
- completion/status where verified

Never infer missing architect/project metadata.

---

# 58. PROPERTY MODE

Property stories should identify verified entities where possible:

PROJECT

LOCATION

DEVELOPER

LAND USE

STATUS

SOURCE

Only show fields backed by source data.

Do not automatically estimate:

- property value
- yield
- selling price
- construction cost

unless credible data exists.

---

# 59. MARKET MODE

Markets page should combine:

### MARKET OVERVIEW

### TONY'S WATCHLIST

### IMPORTANT COMPANY ANNOUNCEMENTS

### MARKET NEWS

### ECONOMIC / POLICY NEWS

Charts must clearly state:

- period
- currency
- data source
- update time

---

# 60. DAILY INTELLIGENCE DESIGN

The ideal opening screen should roughly communicate:

```text
TONY DAILY                            Wed, 12 Aug
──────────────────────────────────────────────────

GOOD MORNING, TONY

Your Daily Intelligence
Hong Kong · Markets · Property · Architecture


[ LARGE PRIMARY NEWS / ARCHITECTURE IMAGE ]

MAIN HEADLINE

Concise factual summary...

Source · 32 min ago · Primary Verified


MARKETS
HSI        …
Tencent    …
Watchlist  …


PROPERTY                     ARCHITECTURE
[image]                      [image]
Story                        Story


MORE FOR YOU
...
```

Do not reproduce this mechanically.

Use it as information architecture.

---

# 61. MVP SCOPE — MUST BUILD

For V1, implement these completely before optional extras:

1. personalised home dashboard
2. light/dark/system mode
3. responsive layout
4. English + Traditional Chinese interface
5. working RSS ingestion
6. source configuration
7. deduplication
8. categories
9. ranking
10. Daily Brief
11. source links
12. article imagery
13. stock watchlist
14. market-data provider abstraction
15. stock charts
16. personal Claude chatbot
17. article summarisation
18. daily summarisation
19. save article
20. settings
21. source health/freshness
22. strong error handling
23. strict factual grounding

Do not spend MVP development time on:

- social networking
- advertising
- subscription billing
- multi-user organisations
- complicated permissions
- mobile native apps
- speculative prediction models
- trading execution
- automated trading

---

# 62. OPTIONAL V2 — DO NOT BLOCK MVP

Architect the code so future versions could support:

- email morning brief
- WhatsApp/Telegram delivery
- voice Cantonese briefing
- portfolio holdings
- dividend calendar
- earnings calendar
- property-development map
- Hong Kong planning applications
- personalised alerts
- watchlist price alerts
- company filing alerts
- weekly architecture digest
- AI research notebooks
- PDF/report analysis
- Tony's personal notes
- historical topic timelines

But do not let these delay the MVP.

---

# 63. TESTING REQUIREMENTS

Test:

### NEWS

RSS failure

duplicate stories

missing images

missing dates

Chinese characters

English content

malformed feeds

stale sources

### STOCKS

invalid ticker

market closed

missing quote

rate limit

provider failure

null values

delayed data

### AI

no evidence found

one source only

multiple contradictory sources

Chinese question

English question

summary request

unsupported claim

### UI

light mode

dark mode

desktop

tablet

mobile

long Chinese headlines

long English headlines

no image

---

# 64. FACTUALITY TEST

Add tests ensuring the AI assistant does not answer from ungrounded context.

For example:

If no source contains the answer:

Expected:

`I couldn't verify that from the currently connected sources.`

NOT:

a plausible invented answer.

---

# 65. README

Create a strong `README.md` containing:

- project description
- architecture
- setup instructions
- environment variables
- data-source configuration
- market-data configuration
- Anthropic configuration
- news ingestion
- scheduled jobs
- development commands
- testing
- deployment
- known limitations
- source/licensing considerations

---

# 66. CLAUDE.md

Create a project-level `CLAUDE.md`.

Include enduring project rules:

## ABSOLUTE RULE

Never add fake production data.

## DATA RULE

External facts require provenance.

## NEWS RULE

Original source URL must be retained.

## MARKET RULE

Never call delayed data real-time.

## AI RULE

Retrieval before factual generation.

## IMAGE RULE

Never generate an artificial image and represent it as a real event.

## CODE RULE

Keep ingestion providers modular.

## UX RULE

Minimalist, architectural and information-rich.

This should guide future Claude Code sessions.

---

# 67. IMPLEMENTATION PROCESS

Work autonomously and systematically.

### STEP 1

Inspect the repository.

### STEP 2

Write a concise technical plan in:

`docs/MVP_PLAN.md`

### STEP 3

Create application architecture.

### STEP 4

Implement database/schema.

### STEP 5

Implement source adapters.

### STEP 6

Connect reliable RSS sources.

Verify endpoints rather than guessing them.

### STEP 7

Implement ingestion, deduplication and story clustering.

### STEP 8

Build dashboard UI.

### STEP 9

Implement market-data abstraction.

### STEP 10

Implement watchlist.

### STEP 11

Implement AI summaries.

### STEP 12

Implement Ask Tony Daily.

### STEP 13

Implement bilingual behaviour.

### STEP 14

Implement imagery.

### STEP 15

Implement settings/personalisation.

### STEP 16

Test all factuality/error states.

### STEP 17

Run:

- lint
- type checks
- unit tests
- production build

Fix errors instead of merely documenting them.

---

# 68. DO NOT STOP AT A SCAFFOLD

Do not simply create:

- placeholder cards
- TODO comments
- fake API responses
- beautiful static screens without backend logic

Build as much of the actual functional MVP as the environment permits.

If credentials are required:

1. implement the integration
2. put the required key in `.env.example`
3. display an honest empty state until credentials are supplied

Never substitute invented production data.

---

# 69. ACCEPTANCE CRITERIA

The MVP succeeds when Tony can open it and immediately understand:

### WHAT HAPPENED TODAY?

### WHAT HAPPENED TO THE MARKETS?

### IS THERE ANYTHING IMPORTANT ABOUT THE COMPANIES I FOLLOW?

### WHAT IS HAPPENING IN HONG KONG PROPERTY AND DEVELOPMENT?

### WHAT IMPORTANT ARCHITECTURE OR BUILT-ENVIRONMENT NEWS SHOULD I KNOW?

### CAN I ASK A QUESTION ABOUT ANY OF THIS?

and receive concise, attractive, source-backed answers.

---

# 70. FINAL EXPERIENCE

Tony should feel that the system knows what he cares about without creating a filter bubble.

It should remove:

- noise
- duplication
- clickbait
- irrelevant content

while preserving:

- important opposing information
- major unexpected developments
- authoritative sources
- primary documents

The purpose is not maximum engagement.

The purpose is:

**maximum signal with minimum noise.**

Build a calm, intelligent and trustworthy product Tony will genuinely want to open every morning.

---

# FINAL INSTRUCTION TO CLAUDE CODE

Begin now.

First inspect the repository and existing environment.

Then create `docs/MVP_PLAN.md`.

After that, proceed with implementation.

Do not ask me to make routine technical decisions that you can reasonably resolve yourself.

When uncertain about a current dependency, API, RSS endpoint or external service:

**verify it instead of guessing.**

When uncertain about a factual news or market value:

**leave it unavailable instead of inventing it.**

Prioritise a functional, factual MVP over unnecessary complexity.