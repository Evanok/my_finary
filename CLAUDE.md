# my_finary

Personal portfolio tracker inspired by Finary. Web app to monitor wealth and investment performance.

## Project Goal

Track personal investments by importing CSV files or entering transactions manually. Monitor portfolio performance over time with charts.

## Tech Stack

- **Framework**: Next.js 16 (App Router, full-stack)
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

### Next.js 16 specifics

- Middleware is now `proxy.ts` (not `middleware.ts`), exporting `proxy` function (not `middleware`)
- Dynamic route params: `{ params }: { params: Promise<{ id: string }> }` — must `await params`

## Core Features

- Account management (institution + account type, e.g. WealthSimple CELI, Revolut Taxable)
- Transaction entry: date, quantity, price, currency, asset (symbol + category)
- CSV import for bulk transaction loading
- Portfolio view with P&L, per-position breakdown
- Account filter: view all accounts, by institution, or by specific account
- Category filter (client-side): All / Crypto / Stock+ETF / Real estate / Cash / Other
- Performance chart (1w/1m/1y/all) via daily snapshots
- Multi-currency display: USD, CAD, EUR
- Login page protected by credentials stored in `.env.local`

## Asset Categories

- `stock` — equities
- `etf` — ETFs
- `crypto` — cryptocurrencies (uses CoinGecko/CoinCap)
- `cash` — cash positions (price = FX rate, no API fetch)
- `real_estate` — property (manual valuation via "Update value" button, stored as source="manual" in PriceCache)
- `bond`, `reit`, `other`

## Price Sources (dual-source validation)

Every price fetch uses two independent sources. If prices diverge by more than 0.5%, mark as `validated=false`.

| Category    | Primary source               | Secondary source            |
|-------------|------------------------------|-----------------------------|
| Stocks/ETFs | yahoo-finance2 (no key)      | Finnhub (FINNHUB_API_KEY)   |
| Crypto      | CoinGecko (free, batch)      | CoinCap (COINCAP_API_KEY)   |
| Cash        | frankfurter.app FX rate      | —                           |
| Real estate | PriceCache source="manual"   | —                           |

FX rates: `frankfurter.app` (free, no key).

### Crypto price fetching

- All crypto prices are batch-fetched via a single CoinGecko call in `computePositions` before the per-asset loop
- `CRYPTO_ID_MAP` in `lib/prices/index.ts` maps ticker symbols to CoinGecko/CoinCap IDs
- Notable mappings: POL → `polygon-ecosystem-token`, EGLD → `elrond-erd-2`, WLD → `worldcoin-wld`, NEXO → `nexo`, UCO → `archethic`, LUNA → `terra-luna`

## Currency Handling

Supported display currencies: USD, CAD, EUR.

**All prices stored internally in USD.**

Yahoo Finance returns native exchange currency (TSX = CAD, NYSE = USD, etc.).
At fetch time: normalize to USD using current FX rate before writing to cache.
At display time: convert from USD to user's selected currency.

### Price Cache (no TTL)

Prices are NOT cleared before refresh. "Refresh prices" re-fetches and upserts — stale cache preserved as fallback if fetch fails.

- `forceRefresh=true` in `computePositions` bypasses cache check and always fetches fresh
- `refreshPrices()` and `takeSnapshot()` call `computePositions(undefined, true)`
- Single-source assets (e.g. cash, real estate, GC=F gold) get `validated=false`

Model: `PriceCache { assetId, source, priceUsd, fetchedAt, validated }` — @@unique([assetId, source])

### FX Rate Cache

TTL: 1 hour. Model: `FxRateCache { pair, rate, fetchedAt }` — e.g. pair = "EUR/USD"

## Authentication

- Credentials stored in `.env.local`: `APP_LOGIN`, `APP_PASSWORD_B64` (base64-encoded), `SESSION_SECRET`
- `proxy.ts` (Next.js 16 middleware) protects all routes, redirects to `/login`
- Session = HMAC-SHA256(SESSION_SECRET, "session") stored as httpOnly cookie
- Public paths: `/login`, `/api/auth/login`

## Data Models

- `Account`: id, name, institution, type (CELI, REER, Taxable, etc.)
- `Asset`: id, symbol, name, category (etf/stock/crypto/cash/real_estate/...), nativeCurrency
- `Transaction`: id, accountId, assetId, date, quantity, price, currency, type (buy/sell)
- `PriceCache`: id, assetId, source, priceUsd, fetchedAt, validated
- `FxRateCache`: id, pair, rate, fetchedAt
- `PortfolioSnapshot`: id, date (unique), totalUsd, breakdown (JSON), createdAt

## Project Structure

```
app/
  page.tsx                     # Main portfolio page (account + category filters, P&L)
  layout.tsx                   # Root layout with Nav
  login/page.tsx               # Login page
  accounts/page.tsx            # Account CRUD
  transactions/page.tsx        # Transactions list + CSV/manual import
  api/
    auth/login/route.ts        # POST — verify credentials, set session cookie
    auth/logout/route.ts       # POST — clear session cookie
    accounts/route.ts
    accounts/[id]/route.ts
    assets/route.ts
    assets/[id]/valuation/route.ts  # POST — set manual valuation for real_estate
    transactions/route.ts
    transactions/[id]/route.ts
    transactions/import/route.ts   # Bulk CSV import (upserts assets + accounts)
    prices/route.ts
    portfolio/route.ts             # GET ?accountIds=id1,id2 (optional filter)
    portfolio/refresh/route.ts     # POST — re-fetches prices (no cache clear)
    portfolio/snapshot/route.ts    # POST — takes daily snapshot
    portfolio/snapshots/route.ts   # GET ?period=1w|1m|1y|all
components/
  nav.tsx                      # Nav with Sign out button
  accounts/account-form.tsx
  transactions/transaction-form.tsx
  transactions/csv-import.tsx
  portfolio/currency-selector.tsx
  portfolio/account-filter.tsx    # Dropdown: all / by institution / by account
  portfolio/category-filter.tsx   # Dropdown: all / crypto / stock+etf / real_estate / cash / other
  portfolio/performance-chart.tsx
  portfolio/positions-table.tsx   # "Update value" button for real_estate rows
lib/
  prisma.ts                    # Prisma singleton with BetterSqlite3 adapter
  prices/
    yahoo.ts                   # Returns native currency price
    finnhub.ts                 # Returns native currency price
    coingecko.ts               # fetchCoinGeckoPrice + fetchCoinGeckoPrices (batch)
    coincap.ts                 # Returns USD price
    fx.ts                      # toUsd(currency) — 1h cached FX rates
    cache.ts                   # getCachedPriceUsd / upsertCachedPriceUsd / lastPriceUpdate
    index.ts                   # getAssetPrice(forceRefresh?) + CRYPTO_ID_MAP
  portfolio/
    positions.ts               # computePositions(accountIds?, forceRefresh?) / sumPortfolioUsd
    snapshot.ts                # refreshPrices / takeSnapshot / getSnapshotSeries
proxy.ts                       # Auth proxy (Next.js 16 middleware replacement)
scripts/
  convert_revolut.js           # trading_revolut.csv -> csv/revolut_import.csv
  convert_wealthsimple.js      # Hard-coded WealthSimple transactions -> csv/wealthsimple_import.csv
  convert_interactive_broker.js # interactive_broker.csv -> csv/interactive_broker_import.csv
  add_xau.js                   # One-off: insert XAU (GC=F) transaction manually
csv/
  revolut_import.csv
  wealthsimple_import.csv
  interactive_broker_import.csv
  meria_import.csv
  nexo_import.csv
  ledger_import.csv
  kraken_import.csv
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
- `AIR` on Interactive Brokers = `AIR.PA` on Yahoo Finance (Airbus, Euronext Paris)

## Code Style

- TypeScript everywhere
- English for all code, comments, variables
- No emojis in code or UI
