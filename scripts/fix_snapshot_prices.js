#!/usr/bin/env node
// One-off script: retroactively fix crypto prices = 0 in past snapshots
// using CoinGecko historical price API (/coins/{id}/history?date=dd-mm-yyyy).

const Database = require("better-sqlite3");
const https = require("https");
const fs = require("fs");

// Load COINGECKO_API_KEY from .env.local
const envPath = `${__dirname}/../.env.local`;
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}

const CRYPTO_ID_MAP = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  POL: "polygon-ecosystem-token",
  ATOM: "cosmos",
  ALGO: "algorand",
  EGLD: "elrond-erd-2",
  GRT: "the-graph",
  NEXO: "nexo",
  WLD: "worldcoin-wld",
  UCO: "archethic",
  LUNA: "terra-luna",
  USDT: "tether",
  USDC: "usd-coin",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  const headers = { "User-Agent": "my-finary-fix-script/1.0" };
  if (process.env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error for ${url}: ${data.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

// Returns price in USD for a given CoinGecko coin ID on a given date (YYYY-MM-DD).
async function fetchHistoricalPrice(coinId, dateStr) {
  const [year, month, day] = dateStr.split("-");
  const cgDate = `${day}-${month}-${year}`; // CoinGecko format: dd-mm-yyyy
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${cgDate}&localization=false`;
  const data = await fetchJson(url);
  return data?.market_data?.current_price?.usd ?? null;
}

async function main() {
  const db = new Database("./prisma/dev.db");

  const snapshots = db
    .prepare("SELECT id, date, totalUsd, breakdown FROM PortfolioSnapshot ORDER BY date ASC")
    .all();

  // Cache fetched prices to avoid duplicate API calls for the same (coinId, date)
  const priceCache = new Map();

  for (const snapshot of snapshots) {
    const items = JSON.parse(snapshot.breakdown);
    const toFix = items.filter(
      (i) => i.category === "crypto" && (!i.priceUsd || i.priceUsd === 0) && i.quantity > 0
    );

    if (toFix.length === 0) continue;

    const dateStr = snapshot.date.split("T")[0]; // YYYY-MM-DD
    console.log(`\n[${dateStr}] Fixing ${toFix.length} assets: ${toFix.map((i) => i.symbol).join(", ")}`);

    for (const item of toFix) {
      const coinId = CRYPTO_ID_MAP[item.symbol.toUpperCase()];
      if (!coinId) {
        console.log(`  ${item.symbol}: no CoinGecko ID — skipping`);
        continue;
      }

      const cacheKey = `${coinId}:${dateStr}`;
      let priceUsd;

      if (priceCache.has(cacheKey)) {
        priceUsd = priceCache.get(cacheKey);
        console.log(`  ${item.symbol}: (cached)`);
      } else {
        await sleep(1200); // ~50 req/min with API key (Demo tier: 30 req/min guaranteed)
        try {
          priceUsd = await fetchHistoricalPrice(coinId, dateStr);
          priceCache.set(cacheKey, priceUsd);
        } catch (err) {
          console.log(`  ${item.symbol}: ERROR — ${err.message}`);
          continue;
        }
      }

      if (priceUsd === null) {
        console.log(`  ${item.symbol}: no price returned from CoinGecko`);
        continue;
      }

      item.priceUsd = priceUsd;
      item.valueUsd = priceUsd * item.quantity;
      console.log(`  ${item.symbol}: $${priceUsd.toFixed(4)} → value $${Math.round(item.valueUsd)}`);
    }

    // Recompute totalUsd from updated breakdown
    const newTotal = items.reduce((sum, i) => sum + (i.valueUsd ?? 0), 0);
    const newBreakdown = JSON.stringify(items);

    db.prepare("UPDATE PortfolioSnapshot SET totalUsd = ?, breakdown = ? WHERE id = ?").run(
      newTotal,
      newBreakdown,
      snapshot.id
    );

    console.log(`  => totalUsd updated: $${Math.round(snapshot.totalUsd)} → $${Math.round(newTotal)}`);
  }

  db.close();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
