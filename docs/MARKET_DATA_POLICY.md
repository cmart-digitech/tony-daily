# Market Data Policy

## Entitlement honesty (brief §34)
"LIVE"/"REAL-TIME" may appear only when the provider entitlement genuinely
supplies real-time data for that instrument. Twelve Data quote payloads do
not assert entitlement, so everything is labelled **Delayed** with
`Updated HH:MM HKT`. Stale cache served during provider failure keeps its
original timestamp. Delayed data is never refreshed rapidly to imitate
streaming; no WebSocket is claimed where none exists.

## Coverage (verified)
- Twelve Data free: US equities/ETFs, forex, crypto — 800 req/day, 8/min.
- Hong Kong equities need Twelve Data Grow (~US$29/mo, verified 12 Aug 2026)
  or another licensed provider. **Open decision for Tony** — until then HK
  symbols honestly error, and HKEX corporate/regulatory news arrives via the
  verified HKEX RSS feeds instead.
- Never scraped: Google Finance, Yahoo Finance, HKEX pages (§35).

## Alerts (brief §39)
Created only by explicit user action; evaluated on the ingestion schedule
against cached (delayed) quotes; every notification carries the quote's own
timestamp and "delayed"; a triggered alert re-arms after ~20 h; no quote →
no judgement, never a synthetic trigger.

## Charts (brief §37)
Range switching (1M/3M/6M/1Y) over daily closes with crosshair OHLC; every
chart states period, currency, source (Twelve Data) and update time.
Intraday series can be added where the provider entitlement allows.

## No trading
No order execution, no buy/sell controls, no personalised advice. The
standing disclaimer remains on all market surfaces.
