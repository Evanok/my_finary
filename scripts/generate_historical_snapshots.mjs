/**
 * Generate monthly portfolio snapshots from 2022-01 to current month.
 * Optimized: Yahoo Finance fetched once per symbol (full range), CryptoCompare batched.
 *
 * Usage: node scripts/generate_historical_snapshots.mjs
 */

import Database from "better-sqlite3";
import YahooFinance from "/home/arthur/work/my_finary/node_modules/yahoo-finance2/esm/src/index.js";
import { randomUUID } from "crypto";

const DB_PATH = "/home/arthur/work/my_finary/prisma/dev.db";
const db = new Database(DB_PATH);
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });

const HISTORY_START = "2021-12-01";
const HISTORY_END   = "2026-03-08";

// Crypto symbol → CryptoCompare symbol
const CC_SYMBOLS = {
  BTC: "BTC", ETH: "ETH", BNB: "BNB", SOL: "SOL", ADA: "ADA",
  ATOM: "ATOM", AVAX: "AVAX", DOT: "DOT", ALGO: "ALGO", GRT: "GRT",
  NEXO: "NEXO", POL: "MATIC", EGLD: "EGLD", LUNA: "LUNC",
  UCO: "UCO", USDT: "USDT", USDC: "USDC", WLD: "WLD",
};

// All 1st-of-month dates from 2022-01 to 2026-02
function generateMonthlyDates() {
  const dates = [];
  for (let year = 2022; year <= 2026; year++) {
    for (let month = 1; month <= 12; month++) {
      const d = `${year}-${String(month).padStart(2, "0")}-01`;
      if (d <= HISTORY_END) dates.push(d);
    }
  }
  return dates;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Step 1: Pre-fetch all stock/ETF/commodity prices (one call per symbol) ---

async function fetchStockHistory(symbol) {
  try {
    const history = await yf.historical(symbol, { period1: HISTORY_START, period2: HISTORY_END });
    const map = {};
    for (const h of history) {
      map[h.date.toISOString().split("T")[0]] = h.close;
    }
    return map;
  } catch (e) {
    console.error(`  Yahoo failed ${symbol}: ${e.message}`);
    return {};
  }
}

// Find the latest key in a date-keyed map that is <= targetDate
function closestBefore(map, targetDate) {
  const keys = Object.keys(map).sort();
  const available = keys.filter((d) => d <= targetDate);
  if (!available.length) return null;
  return map[available[available.length - 1]];
}

// --- Step 2: Pre-fetch FX timeseries (one call per pair) ---

async function fetchFxTimeseries(from, to) {
  if (from === to) return null; // signals "use rate 1.0"
  try {
    const res = await fetch(`https://api.frankfurter.app/${HISTORY_START}..${HISTORY_END}?from=${from}&to=${to}`);
    const data = await res.json();
    // data.rates = { "2022-01-03": { "USD": 1.13 }, ... }
    const flat = {};
    for (const [d, rates] of Object.entries(data.rates || {})) {
      flat[d] = rates[to];
    }
    return flat;
  } catch (e) {
    console.error(`  FX fetch failed ${from}/${to}: ${e.message}`);
    return {};
  }
}

// --- Step 3: Fetch crypto prices per date (CryptoCompare, batched) ---

async function fetchCryptoPriceUsd(ccSymbol, dateStr) {
  const ts = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
  const url = `https://min-api.cryptocompare.com/data/pricehistorical?fsym=${ccSymbol}&tsyms=USD&ts=${ts}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data?.[ccSymbol]?.USD ?? null;
  } catch {
    return null;
  }
}

// Fetch all crypto prices for a given date (batched 5 at a time)
async function fetchAllCryptosForDate(symbols, dateStr) {
  const results = {};
  const BATCH = 5;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const res = await Promise.all(batch.map(async (sym) => ({
      sym,
      price: await fetchCryptoPriceUsd(CC_SYMBOLS[sym] || sym, dateStr),
    })));
    for (const { sym, price } of res) results[sym] = price;
    if (i + BATCH < symbols.length) await sleep(600);
  }
  return results;
}

// ============================================================
// MAIN
// ============================================================

const DATES = generateMonthlyDates();
console.log(`Generating ${DATES.length} monthly snapshots from ${DATES[0]} to ${DATES[DATES.length - 1]}\n`);

// Load all assets + transactions from DB
const allAssets = db.prepare('SELECT * FROM Asset').all();
const allTxs    = db.prepare('SELECT t.*, a.symbol, a.category, a.nativeCurrency FROM "Transaction" t JOIN Asset a ON t.assetId = a.id ORDER BY t.date ASC').all();

const cryptoAssets = allAssets.filter((a) => a.category === "crypto");
const stockAssets  = allAssets.filter((a) => ["stock", "etf", "commodity"].includes(a.category));

// --- Pre-fetch all stock prices ---
console.log("Fetching stock/ETF price histories from Yahoo Finance...");
const stockPrices = {}; // symbol → { date → price }
for (const asset of stockAssets) {
  process.stdout.write(`  ${asset.symbol}... `);
  stockPrices[asset.symbol] = await fetchStockHistory(asset.symbol);
  const n = Object.keys(stockPrices[asset.symbol]).length;
  console.log(`${n} data points`);
  await sleep(300);
}

// --- Pre-fetch FX timeseries ---
console.log("\nFetching FX timeseries...");
const fxSeries = {};
const fxPairs = [["EUR", "USD"], ["CAD", "USD"]];
for (const [from, to] of fxPairs) {
  process.stdout.write(`  ${from}/${to}... `);
  fxSeries[`${from}/${to}`] = await fetchFxTimeseries(from, to);
  console.log(`${Object.keys(fxSeries[`${from}/${to}`]).length} data points`);
  await sleep(300);
}

function getFx(fromCurrency, toCurrency, dateStr) {
  if (fromCurrency === toCurrency) return 1.0;
  const key = `${fromCurrency}/${toCurrency}`;
  const series = fxSeries[key];
  if (!series) return 1.0;
  return closestBefore(series, dateStr) ?? 1.0;
}

// --- Process each snapshot date ---
console.log("\nBuilding snapshots...");

for (const dateStr of DATES) {
  // Compute positions at this date
  const txsBefore = allTxs.filter((tx) => tx.date.slice(0, 10) <= dateStr);
  if (!txsBefore.length) {
    console.log(`${dateStr}: no transactions, skip`);
    continue;
  }

  const posMap = new Map();
  for (const tx of txsBefore) {
    const pos = posMap.get(tx.assetId) || {
      symbol: tx.symbol, category: tx.category,
      nativeCurrency: tx.nativeCurrency, quantity: 0, totalCostUsd: 0,
    };
    const fxRate = getFx(tx.currency, "USD", dateStr);
    const priceUsd = fxRate * tx.price;
    const sign = tx.type === "sell" ? -1 : 1;
    pos.quantity    += sign * tx.quantity;
    pos.totalCostUsd += sign * tx.quantity * priceUsd;
    posMap.set(tx.assetId, pos);
  }

  const active = [...posMap.entries()].filter(([, p]) => p.quantity > 0.000001);
  const cryptoSymbols = [...new Set(active.filter(([, p]) => p.category === "crypto").map(([, p]) => p.symbol))];

  // Fetch crypto prices for this date
  const cryptoPrices = cryptoSymbols.length ? await fetchAllCryptosForDate(cryptoSymbols, dateStr) : {};

  let totalUsd = 0;
  const breakdown = [];

  for (const [assetId, pos] of active) {
    let priceUsd = null;

    if (pos.category === "crypto") {
      priceUsd = cryptoPrices[pos.symbol] ?? null;
    } else if (pos.category === "cash") {
      priceUsd = getFx(pos.nativeCurrency, "USD", dateStr);
    } else if (pos.category === "real_estate") {
      priceUsd = pos.totalCostUsd / pos.quantity;
    } else {
      const nativePrice = closestBefore(stockPrices[pos.symbol] || {}, dateStr);
      if (nativePrice !== null && nativePrice !== undefined) {
        const rate = pos.nativeCurrency !== "USD" ? getFx(pos.nativeCurrency, "USD", dateStr) : 1;
        priceUsd = nativePrice * rate;
      }
    }

    if (priceUsd !== null && priceUsd !== undefined) {
      const valueUsd = priceUsd * pos.quantity;
      totalUsd += valueUsd;
      breakdown.push({ assetId, symbol: pos.symbol, quantity: pos.quantity, priceUsd, valueUsd });
    }
  }

  // Upsert snapshot
  const isoDate = new Date(dateStr + "T00:00:00Z").toISOString();
  const existing = db.prepare('SELECT id FROM PortfolioSnapshot WHERE date = ?').get(isoDate);
  if (existing) {
    db.prepare('UPDATE PortfolioSnapshot SET totalUsd = ?, breakdown = ? WHERE date = ?')
      .run(totalUsd, JSON.stringify(breakdown), isoDate);
  } else {
    db.prepare('INSERT INTO PortfolioSnapshot (id, date, totalUsd, breakdown, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), isoDate, totalUsd, JSON.stringify(breakdown), new Date().toISOString());
  }

  const totalDisplay = (totalUsd / 1000).toFixed(0);
  const posCount = breakdown.length;
  console.log(`${dateStr}  $${totalDisplay}k  (${posCount} positions)`);
}

db.close();
console.log("\nDone.");
