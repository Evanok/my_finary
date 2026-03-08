# my_finary

Personal portfolio tracker inspired by Finary. Web app to monitor wealth and investment performance.

## Project Goal

Track personal investments by importing CSV files or entering transactions manually. Monitor portfolio performance over time with charts.

## Core Features

- Account management (institution + account type, e.g. WealthSimple + CELI)
- Transaction entry: date, purchase price, quantity, asset name, category (ETF, stock, crypto, etc.)
- CSV import for bulk transaction loading
- Portfolio global view with current valuations
- Performance charts: 1d, 1w, 1m, 1y, all

## Tech Stack

- **Framework**: Next.js 14 (App Router, full-stack)
- **Database**: SQLite via Prisma ORM
- **UI**: shadcn/ui + Tailwind CSS
- **Charts**: Recharts
- **Package manager**: npm

## Price Sources (dual-source validation)

Every price fetch MUST use two independent sources. If prices diverge by more than 0.5%, mark the data as unvalidated rather than displaying silently wrong data.

| Category   | Primary source              | Secondary source          |
|------------|-----------------------------|---------------------------|
| Stocks/ETFs | yahoo-finance2 (npm, no key) | Finnhub (free: 60 req/min) |
| Crypto     | CoinGecko (free: 30 req/min) | CoinCap.io (free, no key) |

## Currency handling

Supported display currencies: **USD, CAD, EUR** (user preference, stored in localStorage).

**Rule: all prices stored internally in USD.**

Yahoo Finance returns prices in the native exchange currency (TSX = CAD, NYSE = USD, Euronext = EUR).
At fetch time, normalize to USD using the current FX rate before writing to cache.
At display time, convert from USD to the user's selected currency using the cached FX rate.

FX rates source: `frankfurter.app` (free, no key, no quota issues).

### FX Rate Cache (SQLite)

Model: `FxRateCache { pair, rate, fetchedAt }` — e.g. pair = "EUR/USD", "CAD/USD"

TTL: 1 hour (FX rates move slowly compared to asset prices)

### Price Cache (SQLite)

Model: `PriceCache { assetId, source, price, fetchedAt, validated }` — price always in USD

TTL rules:
- Stocks/ETFs: 15 min during market hours, 12h outside market hours
- Crypto: 5 min (24/7 market)

Fetch logic:
1. Check cache — if within TTL, return immediately (no API call)
2. Otherwise, call both sources in parallel
3. Normalize each result to USD using FX rate cache
4. Compare prices, validate (diff < 0.5%), persist to cache in USD
5. Return validated USD price

This reduces API calls by ~95% under normal usage.

## Data Models

- `Account`: id, name, institution, type (CELI, REER, TFSA, taxable, etc.)
- `Asset`: id, symbol, name, category (ETF, stock, crypto, etc.), nativeCurrency (USD/CAD/EUR)
- `Transaction`: id, accountId, assetId, date, quantity, price, currency, type (buy/sell)
- `PriceCache`: id, assetId, source, priceUsd, fetchedAt, validated
- `FxRateCache`: id, pair, rate, fetchedAt

## Project Structure

```
src/
  app/              # Next.js App Router pages and API routes
    api/
      prices/       # Price fetching endpoints
      accounts/
      transactions/
  components/       # React components
  lib/
    prices/         # Price service: fetch, cache, validate
      yahoo.ts
      finnhub.ts
      coingecko.ts
      coincap.ts
      cache.ts
      index.ts      # Unified price service
    prisma.ts       # Prisma client singleton
  types/            # TypeScript types
prisma/
  schema.prisma     # Data models
```

## Code Style

- TypeScript everywhere
- English for all code, comments, variables
- No emojis in code or UI
