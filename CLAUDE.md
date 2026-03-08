# my_finary

Personal portfolio tracker inspired by Finary. Web app to monitor wealth and investment performance.

## Project Goal

Track personal investments by importing CSV files or entering transactions manually. Monitor portfolio performance over time with charts.

## Tech Stack

- **Framework**: Next.js 14 (App Router, full-stack)
- **Database**: SQLite via Prisma 7 + `@prisma/adapter-better-sqlite3`
- **UI**: shadcn/ui + Tailwind CSS v4
- **Charts**: Recharts
- **CSV parsing**: papaparse
- **Package manager**: npm

### Prisma 7 specifics

- No `url` in `schema.prisma` — configured via `prisma.config.ts`
- Requires driver adapter: `PrismaBetterSqlite3` from `@prisma/adapter-better-sqlite3`
- PrismaClient instantiated with `{ adapter }` option in `lib/prisma.ts`
- Generated client at `@/app/generated/prisma/client`

### yahoo-finance2 v3

Must instantiate: `const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })`. Cannot call methods on the default export directly.

## Core Features

- Account management (institution + account type, e.g. WealthSimple CELI, Revolut Taxable)
- Transaction entry: date, quantity, price, currency, asset (symbol + category)
- CSV import for bulk transaction loading
- Portfolio view with P&L, per-position breakdown
- Account filter: view all accounts, by institution, or by specific account
- Performance chart (1w/1m/1y/all) via daily snapshots
- Multi-currency display: USD, CAD, EUR

## Price Sources (dual-source validation)

Every price fetch uses two independent sources. If prices diverge by more than 0.5%, mark as `validated=false`.

| Category    | Primary source               | Secondary source            |
|-------------|------------------------------|-----------------------------|
| Stocks/ETFs | yahoo-finance2 (no key)      | Finnhub (FINNHUB_API_KEY)   |
| Crypto      | CoinGecko (free, 30 req/min) | CoinCap (COINCAP_API_KEY)   |

FX rates: `frankfurter.app` (free, no key).

## Currency Handling

Supported display currencies: USD, CAD, EUR.

**All prices stored internally in USD.**

Yahoo Finance returns native exchange currency (TSX = CAD, NYSE = USD, etc.).
At fetch time: normalize to USD using current FX rate before writing to cache.
At display time: convert from USD to user's selected currency.

### Price Cache (no TTL)

Prices are NOT refreshed on a timer. They are only updated:
1. When the user clicks "Refresh prices" (clears cache, re-fetches all)
2. When a daily snapshot is taken (same as above, then persists snapshot)

Model: `PriceCache { assetId, source, priceUsd, fetchedAt, validated }` — @@unique([assetId, source])

### FX Rate Cache

TTL: 1 hour. Model: `FxRateCache { pair, rate, fetchedAt }` — e.g. pair = "EUR/USD"

## Data Models

- `Account`: id, name, institution, type (CELI, REER, Taxable, etc.)
- `Asset`: id, symbol, name, category (etf/stock/crypto), nativeCurrency
- `Transaction`: id, accountId, assetId, date, quantity, price, currency, type (buy/sell)
- `PriceCache`: id, assetId, source, priceUsd, fetchedAt, validated
- `FxRateCache`: id, pair, rate, fetchedAt
- `PortfolioSnapshot`: id, date (unique), totalUsd, breakdown (JSON), createdAt

## Project Structure

```
app/
  page.tsx                     # Main portfolio page
  layout.tsx                   # Root layout with Nav
  accounts/page.tsx            # Account CRUD
  transactions/page.tsx        # Transactions list + CSV/manual import
  api/
    accounts/route.ts
    accounts/[id]/route.ts
    assets/route.ts
    transactions/route.ts
    transactions/[id]/route.ts
    transactions/import/route.ts  # Bulk CSV import (upserts assets + accounts)
    prices/route.ts
    portfolio/route.ts            # GET ?accountIds=id1,id2 (optional filter)
    portfolio/refresh/route.ts    # POST — clears cache + re-fetches prices
    portfolio/snapshot/route.ts   # POST — takes daily snapshot
    portfolio/snapshots/route.ts  # GET ?period=1w|1m|1y|all
components/
  nav.tsx
  accounts/account-form.tsx
  transactions/transaction-form.tsx
  transactions/csv-import.tsx
  portfolio/currency-selector.tsx
  portfolio/account-filter.tsx   # Dropdown: all / by institution / by account
  portfolio/performance-chart.tsx
  portfolio/positions-table.tsx
lib/
  prisma.ts                    # Prisma singleton with BetterSqlite3 adapter
  prices/
    yahoo.ts                   # Returns native currency price
    finnhub.ts                 # Returns native currency price
    coingecko.ts               # Returns USD price
    coincap.ts                 # Returns USD price
    fx.ts                      # toUsd(currency) — 1h cached FX rates
    cache.ts                   # getCachedPriceUsd / upsertCachedPriceUsd / clearPriceCache / lastPriceUpdate
    index.ts                   # getAssetPrice — dual-source, validates, normalizes to USD
  portfolio/
    positions.ts               # computePositions(accountIds?) / sumPortfolioUsd
    snapshot.ts                # refreshPrices / takeSnapshot / getSnapshotSeries
scripts/
  convert_revolut.js           # trading_revolut.csv -> revolut_import.csv
  convert_wealthsimple.js      # Hard-coded WealthSimple transactions -> wealthsimple_import.csv
  add_xau.js                   # One-off: insert XAU (GC=F) transaction manually
prisma/
  schema.prisma
  dev.db
```

## CSV Import Format

```
date,symbol,name,category,native_currency,quantity,price,currency,type,account_institution,account_type
2024-01-15,AAPL,Apple Inc,stock,USD,10,180.50,USD,buy,WealthSimple,CELI
```

- `native_currency`: currency the asset trades in (USD for NYSE, CAD for TSX)
- `currency`: currency the price is recorded in (may differ, e.g. CAD for WealthSimple purchases of USD ETFs)
- Cost basis in USD = `quantity * price * toUsd(currency)` using current FX rate

## Known Ticker Quirks

- `XDJP` on Revolut = `XDJP.DE` on Yahoo Finance (Frankfurt)
- `SGM` on Revolut = `SGM.F` on Yahoo Finance (STMicroelectronics Frankfurt)
- `GC=F` = Gold futures (Yahoo only, validated=false is expected — single source)
- `KILO.TO` = Purpose Gold Bullion ETF (CAD, TSX)
- `XETM.TO` = iShares S&P/TSX Energy Transition Materials ETF (CAD, TSX)

## Code Style

- TypeScript everywhere
- English for all code, comments, variables
- No emojis in code or UI
