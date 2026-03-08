import { fetchYahooPrice } from "./yahoo";
import { fetchFinnhubPrice } from "./finnhub";
import { fetchCoinGeckoPrice } from "./coingecko";
import { fetchCoinCapPrice } from "./coincap";
import { getCachedPriceUsd, upsertCachedPriceUsd } from "./cache";
import { toUsd } from "./fx";

const MAX_DIVERGENCE = 0.005; // 0.5%

export type PriceResult = {
  priceUsd: number;
  validated: boolean;
  sources: string[];
};

export async function getAssetPrice(
  assetId: string,
  symbol: string,
  category: string,
  nativeCurrency: string = "USD"
): Promise<PriceResult | null> {
  const isCrypto = category.toLowerCase() === "crypto";
  const [source1Name, source2Name] = isCrypto
    ? ["coingecko", "coincap"]
    : ["yahoo", "finnhub"];

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

  // No cache — fetch fresh from both sources in parallel
  const [raw1, raw2] = await (isCrypto
    ? Promise.all([fetchCoinGeckoPrice(symbol), fetchCoinCapPrice(symbol)])
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
