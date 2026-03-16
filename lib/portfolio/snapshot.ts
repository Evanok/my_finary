import { prisma } from "@/lib/prisma";
import { computePositions, sumPortfolioUsd } from "./positions";

function toSnapshotDate(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Re-fetch all prices from external APIs and update the cache (no clearing — stale data kept as fallback).
export async function refreshPrices(): Promise<void> {
  await computePositions(undefined, true);
}

export async function takeSnapshot(): Promise<{ totalUsd: number; date: Date; failedSymbols: string[] }> {
  const positions = await computePositions(undefined, true);
  const totalUsd = sumPortfolioUsd(positions);
  const date = toSnapshotDate(new Date());

  const breakdown = positions.map((p) => ({
    assetId: p.assetId,
    symbol: p.symbol,
    category: p.category,
    quantity: p.quantity,
    priceUsd: p.currentPriceUsd,
    valueUsd: p.valueUsd,
  }));

  await prisma.portfolioSnapshot.upsert({
    where: { date },
    update: { totalUsd, breakdown: JSON.stringify(breakdown) },
    create: { date, totalUsd, breakdown: JSON.stringify(breakdown) },
  });

  const failedSymbols = positions.filter((p) => p.currentPriceUsd === null).map((p) => p.symbol);
  return { totalUsd, date, failedSymbols };
}

export type SnapshotPoint = { date: string; totalUsd: number };

const CATEGORY_GROUPS: Record<string, string[]> = {
  crypto:      ["crypto"],
  stock:       ["stock", "etf"],
  real_estate: ["real_estate"],
  cash:        ["cash"],
  other:       ["bond", "reit", "other"],
};

export async function getSnapshotSeries(since?: Date, categoryFilter?: string): Promise<SnapshotPoint[]> {
  const filterCategories = categoryFilter && categoryFilter !== "all"
    ? (CATEGORY_GROUPS[categoryFilter] ?? null)
    : null;

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: since ? { date: { gte: since } } : undefined,
    orderBy: { date: "asc" },
    select: { date: true, totalUsd: true, ...(filterCategories ? { breakdown: true } : {}) },
  });

  return snapshots.map((s) => {
    let totalUsd = s.totalUsd;
    if (filterCategories && "breakdown" in s && s.breakdown) {
      const items = JSON.parse(s.breakdown as string) as Array<{ category?: string; valueUsd?: number }>;
      totalUsd = items
        .filter((item) => item.category && filterCategories.includes(item.category.toLowerCase()))
        .reduce((sum, item) => sum + (item.valueUsd ?? 0), 0);
    }
    return { date: s.date.toISOString().split("T")[0], totalUsd };
  });
}
