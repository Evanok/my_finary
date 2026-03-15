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

export async function getSnapshotSeries(since?: Date): Promise<SnapshotPoint[]> {
  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: since ? { date: { gte: since } } : undefined,
    orderBy: { date: "asc" },
    select: { date: true, totalUsd: true },
  });

  return snapshots.map((s) => ({
    date: s.date.toISOString().split("T")[0],
    totalUsd: s.totalUsd,
  }));
}
