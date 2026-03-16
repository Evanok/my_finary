import { prisma } from "@/lib/prisma";
import { getAssetPrice, CRYPTO_ID_MAP } from "@/lib/prices";
import { toUsd } from "@/lib/prices/fx";
import { fetchCoinGeckoPrices } from "@/lib/prices/coingecko";
import { upsertCachedPriceUsd } from "@/lib/prices/cache";

export interface Position {
  assetId: string;
  symbol: string;
  name: string;
  category: string;
  nativeCurrency: string;
  quantity: number;
  avgCostUsd: number;   // average purchase price in USD
  currentPriceUsd: number | null;
  valueUsd: number | null;
  costBasisUsd: number; // total amount invested in USD
  plUsd: number | null; // unrealized P&L in USD
  plPct: number | null; // unrealized P&L in %
  priceValidated: boolean;
}

export async function computePositions(accountIds?: string[], forceRefresh = false): Promise<Position[]> {
  const transactions = await prisma.transaction.findMany({
    where: accountIds && accountIds.length > 0 ? { accountId: { in: accountIds } } : undefined,
    include: { asset: true },
    orderBy: { date: "asc" },
  });

  // Aggregate net quantity and cost basis per asset
  const map = new Map<string, {
    asset: typeof transactions[0]["asset"];
    quantity: number;
    totalCostUsd: number;
  }>();

  for (const tx of transactions) {
    const existing = map.get(tx.assetId);
    const fxRate = await toUsd(tx.currency);
    const priceUsd = fxRate ? tx.price * fxRate : tx.price;
    const delta = tx.type === "sell" ? -tx.quantity : tx.quantity;
    const costDelta = tx.type === "sell" ? -(tx.quantity * priceUsd) : tx.quantity * priceUsd;

    if (existing) {
      existing.quantity += delta;
      existing.totalCostUsd += costDelta;
    } else {
      map.set(tx.assetId, {
        asset: tx.asset,
        quantity: delta,
        totalCostUsd: costDelta,
      });
    }
  }

  const entries = [...map.entries()].filter(([, v]) => v.quantity > 0.000001);

  // Pre-fetch all crypto prices in one CoinGecko batch call to avoid per-asset rate limits.
  // Always runs when forceRefresh=true, otherwise only for assets not yet in cache.
  const cryptoEntries = entries.filter(([, v]) => v.asset.category.toLowerCase() === "crypto");
  const coinIds = cryptoEntries.map(([, v]) => CRYPTO_ID_MAP[v.asset.symbol.toUpperCase()] ?? v.asset.symbol.toLowerCase());
  const batchPrices = await fetchCoinGeckoPrices(coinIds);

  // Populate cache from batch results so getAssetPrice finds them
  await Promise.all(
    cryptoEntries.map(async ([assetId, { asset }], i) => {
      const coinId = coinIds[i];
      const priceUsd = batchPrices[coinId];
      if (priceUsd !== undefined) {
        await upsertCachedPriceUsd(assetId, "coingecko", priceUsd, false);
      }
    })
  );

  const positions: Position[] = [];
  for (const [assetId, { asset, quantity, totalCostUsd }] of entries) {
    // For crypto, the batch CoinGecko call already populated the cache above,
    // so always read from cache (forceRefresh=false) to avoid 16 individual API calls.
    const isCrypto = asset.category.toLowerCase() === "crypto";
    let result = await getAssetPrice(assetId, asset.symbol, asset.category, asset.nativeCurrency, isCrypto ? false : forceRefresh);
    // Real estate with no manual valuation yet: use avg cost as current price (P&L = 0)
    if (result === null && asset.category.toLowerCase() === "real_estate") {
      const fxRate = await toUsd(asset.nativeCurrency);
      const avgCostUsd = totalCostUsd / quantity;
      if (fxRate !== null) result = { priceUsd: avgCostUsd, validated: false, sources: ["cost_basis"] };
    }
    const currentPriceUsd = result?.priceUsd ?? null;
    const valueUsd = currentPriceUsd !== null ? currentPriceUsd * quantity : null;
    const costBasisUsd = totalCostUsd;
    const avgCostUsd = quantity > 0 ? costBasisUsd / quantity : 0;
    const plUsd = valueUsd !== null ? valueUsd - costBasisUsd : null;
    const plPct = plUsd !== null && costBasisUsd > 0 ? (plUsd / costBasisUsd) * 100 : null;

    positions.push({
      assetId,
      symbol: asset.symbol,
      name: asset.name,
      category: asset.category,
      nativeCurrency: asset.nativeCurrency,
      quantity,
      avgCostUsd,
      currentPriceUsd,
      valueUsd,
      costBasisUsd,
      plUsd,
      plPct,
      priceValidated: result?.validated ?? false,
    } satisfies Position);
  }

  return positions.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
}

export function sumPortfolioUsd(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + (p.valueUsd ?? 0), 0);
}
