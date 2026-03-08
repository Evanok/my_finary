import { fetchYahooPrice } from "./yahoo";
import { fetchFinnhubPrice } from "./finnhub";
import { fetchCoinGeckoPrice } from "./coingecko";
import { fetchCoinCapPrice } from "./coincap";
import { getCachedPrice, upsertCachedPrice } from "./cache";

// Max allowed divergence between two sources before flagging as unvalidated
const MAX_DIVERGENCE = 0.005; // 0.5%

export type PriceResult = {
  price: number;
  validated: boolean; // true = both sources agreed within 0.5%
  sources: string[];
};

export async function getAssetPrice(
  assetId: string,
  symbol: string,
  category: string
): Promise<PriceResult | null> {
  const isCrypto = category.toLowerCase() === "crypto";

  // Check cache for both sources
  const [source1Name, source2Name] = isCrypto
    ? ["coingecko", "coincap"]
    : ["yahoo", "finnhub"];

  const [cached1, cached2] = await Promise.all([
    getCachedPrice(assetId, source1Name, category),
    getCachedPrice(assetId, source2Name, category),
  ]);

  if (cached1 !== null && cached2 !== null) {
    const divergence = Math.abs(cached1 - cached2) / cached1;
    const validated = divergence <= MAX_DIVERGENCE;
    return { price: cached1, validated, sources: [source1Name, source2Name] };
  }

  // Fetch fresh from both sources in parallel
  const [price1, price2] = await (isCrypto
    ? Promise.all([fetchCoinGeckoPrice(symbol), fetchCoinCapPrice(symbol)])
    : Promise.all([fetchYahooPrice(symbol), fetchFinnhubPrice(symbol)]));

  if (price1 === null && price2 === null) return null;

  // If only one source returned a price, use it but mark as unvalidated
  if (price1 === null || price2 === null) {
    const price = (price1 ?? price2) as number;
    const source = price1 !== null ? source1Name : source2Name;
    await upsertCachedPrice(assetId, source, price, false);
    return { price, validated: false, sources: [source] };
  }

  const divergence = Math.abs(price1 - price2) / price1;
  const validated = divergence <= MAX_DIVERGENCE;

  await Promise.all([
    upsertCachedPrice(assetId, source1Name, price1, validated),
    upsertCachedPrice(assetId, source2Name, price2, validated),
  ]);

  return { price: price1, validated, sources: [source1Name, source2Name] };
}
