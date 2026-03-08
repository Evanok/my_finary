import { prisma } from "@/lib/prisma";
import { getAssetPrice } from "@/lib/prices";
import { toUsd } from "@/lib/prices/fx";

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

export async function computePositions(): Promise<Position[]> {
  const transactions = await prisma.transaction.findMany({
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

  // Fetch current prices in parallel
  const entries = [...map.entries()].filter(([, v]) => v.quantity > 0.000001);

  const positions = await Promise.all(
    entries.map(async ([assetId, { asset, quantity, totalCostUsd }]) => {
      const result = await getAssetPrice(assetId, asset.symbol, asset.category, asset.nativeCurrency);
      const currentPriceUsd = result?.priceUsd ?? null;
      const valueUsd = currentPriceUsd !== null ? currentPriceUsd * quantity : null;
      const costBasisUsd = totalCostUsd;
      const avgCostUsd = quantity > 0 ? costBasisUsd / quantity : 0;
      const plUsd = valueUsd !== null ? valueUsd - costBasisUsd : null;
      const plPct = plUsd !== null && costBasisUsd > 0 ? (plUsd / costBasisUsd) * 100 : null;

      return {
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
      } satisfies Position;
    })
  );

  return positions.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
}

export function sumPortfolioUsd(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + (p.valueUsd ?? 0), 0);
}
