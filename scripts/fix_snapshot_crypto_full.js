#!/usr/bin/env node
// Retroactively fix crypto positions in all past snapshots.
// For each snapshot:
//   1. Compute net crypto positions from transactions up to that date
//   2. Fetch historical prices from CoinGecko for positions missing or priced at 0
//   3. Replace crypto items in the breakdown and recompute totalUsd

const Database = require("better-sqlite3");
const https = require("https");
const fs = require("fs");

// Load .env.local
const envPath = `${__dirname}/../.env.local`;
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}

const CRYPTO_ID_MAP = {
  BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin", SOL: "solana",
  ADA: "cardano", DOT: "polkadot", AVAX: "avalanche-2",
  POL: "polygon-ecosystem-token", ATOM: "cosmos", ALGO: "algorand",
  EGLD: "elrond-erd-2", GRT: "the-graph", NEXO: "nexo",
  WLD: "worldcoin-wld", UCO: "archethic", LUNA: "terra-luna",
  USDT: "tether", USDC: "usd-coin",
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function fetchJson(url) {
  const headers = { "User-Agent": "my-finary-fix/1.0" };
  if (process.env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error (${url.slice(-40)}): ${data.slice(0, 100)}`)); }
      });
    }).on("error", reject);
  });
}

// Binance symbol map (symbol -> Binance pair, e.g. BTC -> BTCUSDT)
// Only coins that trade against USDT on Binance
const BINANCE_SYMBOL_MAP = {
  BTC: "BTCUSDT", ETH: "ETHUSDT", BNB: "BNBUSDT", SOL: "SOLUSDT",
  ADA: "ADAUSDT", DOT: "DOTUSDT", AVAX: "AVAXUSDT", ATOM: "ATOMUSDT",
  ALGO: "ALGOUSDT", EGLD: "EGLDUSDT", GRT: "GRTUSDT", NEXO: "NEXOUSDT",
  WLD: "WLDUSDT", POL: "POLUSDT", USDT: null, USDC: null, // stablecoins = $1
  LUNA: "LUNAUSDT",
};

// Cache: "source:coinId:YYYY-MM-DD" -> priceUsd | null
const priceCache = new Map();

// Fetch via Binance OHLC — free, no key, years of history
async function fetchBinancePrice(symbol, dateStr) {
  const pair = BINANCE_SYMBOL_MAP[symbol.toUpperCase()];
  if (pair === null) return 1.0; // stablecoin
  if (!pair) return null;

  const startMs = new Date(dateStr + "T00:00:00Z").getTime();
  const endMs = startMs + 86400000;
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&startTime=${startMs}&endTime=${endMs}&limit=1`;

  try {
    const data = await fetchJson(url);
    // kline format: [openTime, open, high, low, close, ...]
    if (!Array.isArray(data) || data.length === 0) return null;
    return parseFloat(data[0][4]); // close price
  } catch (err) {
    return null;
  }
}

async function fetchHistoricalPrice(symbol, coinId, dateStr) {
  const key = `${coinId}:${dateStr}`;
  if (priceCache.has(key)) return priceCache.get(key);

  // Try CoinGecko first (Demo tier: ~12 months of history)
  const [y, m, d] = dateStr.split("-");
  const cgUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${d}-${m}-${y}&localization=false`;

  await sleep(2000); // 30 req/min
  let price = null;
  try {
    const data = await fetchJson(cgUrl);
    price = data?.market_data?.current_price?.usd ?? null;
  } catch (err) {
    console.log(`    [CoinGecko error] ${coinId} ${dateStr}: ${err.message}`);
  }

  // Fallback to Binance for older dates or when CoinGecko has no data
  if (price === null) {
    price = await fetchBinancePrice(symbol, dateStr);
    if (price !== null) console.log(`    [Binance fallback] ${symbol}`);
  }

  priceCache.set(key, price);
  return price;
}

// Compute net crypto positions from transactions up to (and including) a date string "YYYY-MM-DD"
function cryptoPositionsAtDate(transactions, snapshotDateStr) {
  const cutoff = new Date(snapshotDateStr + "T23:59:59Z");
  const map = new Map(); // assetId -> { symbol, quantity }

  for (const tx of transactions) {
    const txDate = new Date(tx.date);
    if (txDate > cutoff) continue;

    const existing = map.get(tx.assetId) ?? { symbol: tx.symbol, quantity: 0 };
    const delta = tx.type === "sell" ? -tx.quantity : tx.quantity;
    existing.quantity += delta;
    map.set(tx.assetId, existing);
  }

  return [...map.entries()]
    .filter(([, v]) => v.quantity > 0.000001)
    .map(([assetId, { symbol, quantity }]) => ({ assetId, symbol, quantity }));
}

async function main() {
  const db = new Database("./prisma/dev.db");

  // Load all crypto transactions with asset symbol
  const transactions = db.prepare(`
    SELECT t.assetId, t.date, t.quantity, t.type, a.symbol
    FROM "Transaction" t
    JOIN Asset a ON a.id = t.assetId
    WHERE a.category = 'crypto'
    ORDER BY t.date ASC
  `).all();

  console.log(`Loaded ${transactions.length} crypto transactions`);

  const snapshots = db.prepare(
    "SELECT id, date, totalUsd, breakdown FROM PortfolioSnapshot ORDER BY date ASC"
  ).all();

  let totalFixed = 0;

  for (const snapshot of snapshots) {
    const dateStr = snapshot.date.split("T")[0];
    const positions = cryptoPositionsAtDate(transactions, dateStr);

    if (positions.length === 0) continue; // no crypto held at this date

    const breakdown = JSON.parse(snapshot.breakdown);

    // Build lookup of existing crypto items by assetId
    const existingCrypto = new Map(
      breakdown
        .filter((i) => i.category === "crypto")
        .map((i) => [i.assetId, i])
    );

    // Determine which positions need a price fetch
    const toFetch = positions.filter((p) => {
      const existing = existingCrypto.get(p.assetId);
      return !existing || !existing.priceUsd || existing.priceUsd === 0;
    });

    if (toFetch.length === 0) continue;

    console.log(`\n[${dateStr}] ${toFetch.length} crypto positions to fix: ${toFetch.map((p) => p.symbol).join(", ")}`);

    let anyFixed = false;

    for (const pos of toFetch) {
      const coinId = CRYPTO_ID_MAP[pos.symbol.toUpperCase()];
      if (!coinId) {
        console.log(`  ${pos.symbol}: no CoinGecko ID — skip`);
        continue;
      }

      const priceUsd = await fetchHistoricalPrice(pos.symbol, coinId, dateStr);
      if (priceUsd === null) {
        console.log(`  ${pos.symbol}: no price available`);
        continue;
      }

      const valueUsd = priceUsd * pos.quantity;
      console.log(`  ${pos.symbol}: qty=${pos.quantity.toFixed(4)} price=$${priceUsd.toFixed(4)} value=$${Math.round(valueUsd)}`);

      // Update or insert in breakdown
      if (existingCrypto.has(pos.assetId)) {
        const item = existingCrypto.get(pos.assetId);
        item.priceUsd = priceUsd;
        item.valueUsd = valueUsd;
      } else {
        breakdown.push({
          assetId: pos.assetId,
          symbol: pos.symbol,
          category: "crypto",
          quantity: pos.quantity,
          priceUsd,
          valueUsd,
        });
      }
      anyFixed = true;
    }

    if (!anyFixed) continue;

    const newTotal = breakdown.reduce((sum, i) => sum + (i.valueUsd ?? 0), 0);
    db.prepare("UPDATE PortfolioSnapshot SET totalUsd = ?, breakdown = ? WHERE id = ?")
      .run(newTotal, JSON.stringify(breakdown), snapshot.id);

    console.log(`  => $${Math.round(snapshot.totalUsd)} → $${Math.round(newTotal)}`);
    totalFixed++;
  }

  db.close();
  console.log(`\nDone. ${totalFixed} snapshots updated.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
