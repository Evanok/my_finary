import { fetchYahooPrice } from "./yahoo";
import { fetchFinnhubPrice } from "./finnhub";
import { fetchCoinGeckoPrice } from "./coingecko";
import { fetchCoinCapPrice } from "./coincap";
import { getCachedPriceUsd, upsertCachedPriceUsd } from "./cache";
import { toUsd } from "./fx";

const MAX_DIVERGENCE = 0.005; // 0.5%

// Map from ticker symbol to CoinGecko/CoinCap asset ID.
// Both APIs use the same slug-style IDs.
export const CRYPTO_ID_MAP: Record<string, string> = {
  BTC:   "bitcoin",
  ETH:   "ethereum",
  BNB:   "binancecoin",
  SOL:   "solana",
  ADA:   "cardano",
  XRP:   "ripple",
  DOT:   "polkadot",
  DOGE:  "dogecoin",
  AVAX:  "avalanche-2",
  MATIC: "matic-network",
  POL:   "polygon-ecosystem-token",
  LINK:  "chainlink",
  UNI:   "uniswap",
  ATOM:  "cosmos",
  LTC:   "litecoin",
  BCH:   "bitcoin-cash",
  XLM:   "stellar",
  ALGO:  "algorand",
  VET:   "vechain",
  FIL:   "filecoin",
  TRX:   "tron",
  ETC:   "ethereum-classic",
  EGLD:  "elrond-erd-2",
  GRT:   "the-graph",
  AAVE:  "aave",
  COMP:  "compound-governance-token",
  MKR:   "maker",
  SNX:   "havven",
  YFI:   "yearn-finance",
  SUSHI: "sushi",
  CRV:   "curve-dao-token",
  "1INCH": "1inch",
  USDT:  "tether",
  USDC:  "usd-coin",
  DAI:   "dai",
  NEAR:  "near",
  FTM:   "fantom",
  SAND:  "the-sandbox",
  MANA:  "decentraland",
  AXS:   "axie-infinity",
  THETA: "theta-token",
  XTZ:   "tezos",
  EOS:   "eos",
  XMR:   "monero",
  CAKE:  "pancakeswap-token",
  ICP:   "internet-computer",
  SHIB:  "shiba-inu",
  NEXO:  "nexo",
  WLD:   "worldcoin-wld",
  UCO:   "archethic",
  LUNA:  "terra-luna",
};

export type PriceResult = {
  priceUsd: number;
  validated: boolean;
  sources: string[];
};

export async function getAssetPrice(
  assetId: string,
  symbol: string,
  category: string,
  nativeCurrency: string = "USD",
  forceRefresh = false
): Promise<PriceResult | null> {
  // Cash assets: price = FX rate, no external API needed
  if (category.toLowerCase() === "cash") {
    const priceUsd = await toUsd(nativeCurrency);
    if (priceUsd === null) return null;
    return { priceUsd, validated: true, sources: ["fx"] };
  }

  // Real estate: manual valuation only, stored in cache under source "manual"
  if (category.toLowerCase() === "real_estate") {
    const cached = await getCachedPriceUsd(assetId, "manual");
    if (cached !== null) return { priceUsd: cached, validated: true, sources: ["manual"] };
    return null;
  }

  const isCrypto = category.toLowerCase() === "crypto";
  const [source1Name, source2Name] = isCrypto
    ? ["coingecko", "coincap"]
    : ["yahoo", "finnhub"];

  if (!forceRefresh) {
    // Check persistent cache — no TTL, only invalidated on explicit refresh
    const [cached1, cached2] = await Promise.all([
      getCachedPriceUsd(assetId, source1Name),
      getCachedPriceUsd(assetId, source2Name),
    ]);

    if (cached1 !== null && cached2 !== null) {
      const divergence = Math.abs(cached1 - cached2) / cached1;
      const validated = divergence <= MAX_DIVERGENCE;
      return { priceUsd: cached1, validated, sources: [source1Name, source2Name] };
    }

    // If at least one source is cached, use it rather than risking rate-limited re-fetch
    if (cached1 !== null) {
      return { priceUsd: cached1, validated: false, sources: [source1Name] };
    }
    if (cached2 !== null) {
      return { priceUsd: cached2, validated: false, sources: [source2Name] };
    }
  }

  // No cache — fetch fresh from both sources in parallel
  const coinId = isCrypto ? (CRYPTO_ID_MAP[symbol.toUpperCase()] ?? symbol.toLowerCase()) : symbol;
  const [raw1, raw2] = await (isCrypto
    ? Promise.all([fetchCoinGeckoPrice(coinId), fetchCoinCapPrice(coinId)])
    : Promise.all([fetchYahooPrice(symbol), fetchFinnhubPrice(symbol)]));

  if (raw1 === null && raw2 === null) return null;

  const fxRate = isCrypto ? 1 : await toUsd(nativeCurrency);
  if (fxRate === null) return null;

  const price1 = raw1 !== null ? raw1 * fxRate : null;
  const price2 = raw2 !== null ? raw2 * fxRate : null;

  if (price1 === null || price2 === null) {
    const priceUsd = (price1 ?? price2) as number;
    const source = price1 !== null ? source1Name : source2Name;
    await upsertCachedPriceUsd(assetId, source, priceUsd, false);
    return { priceUsd, validated: false, sources: [source] };
  }

  const divergence = Math.abs(price1 - price2) / price1;
  const validated = divergence <= MAX_DIVERGENCE;

  await Promise.all([
    upsertCachedPriceUsd(assetId, source1Name, price1, validated),
    upsertCachedPriceUsd(assetId, source2Name, price2, validated),
  ]);

  return { priceUsd: price1, validated, sources: [source1Name, source2Name] };
}

export async function convertFromUsd(
  priceUsd: number,
  targetCurrency: string
): Promise<number | null> {
  const normalized = targetCurrency.toUpperCase();
  if (normalized === "USD") return priceUsd;
  const fxRate = await toUsd(normalized);
  if (fxRate === null) return null;
  return priceUsd / fxRate;
}
