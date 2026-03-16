import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PERIODS: Record<string, number> = {
  "1w": 7,
  "1m": 30,
  "1y": 365,
};

const CATEGORY_GROUPS: Record<string, string[]> = {
  crypto:      ["crypto"],
  stock:       ["stock", "etf"],
  real_estate: ["real_estate"],
  cash:        ["cash"],
  other:       ["bond", "reit", "other"],
};

function snapshotTotal(totalUsd: number, breakdown: string | null, filterCategories: string[] | null): number {
  if (!filterCategories || !breakdown) return totalUsd;
  const items = JSON.parse(breakdown) as Array<{ category?: string; valueUsd?: number }>;
  return items
    .filter((item) => item.category && filterCategories.includes(item.category.toLowerCase()))
    .reduce((sum, item) => sum + (item.valueUsd ?? 0), 0);
}

// GET /api/portfolio/snapshots/reference?period=1w&category=stock
// Returns the last snapshot BEFORE (now - period), used as the P&L reference point.
// Also returns the most recent snapshot as the "current" value for consistent comparison.
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "1w";
  const categoryFilter = req.nextUrl.searchParams.get("category") ?? "all";
  const days = PERIODS[period];
  if (!days) return NextResponse.json(null);

  const filterCategories = categoryFilter !== "all" ? (CATEGORY_GROUPS[categoryFilter] ?? null) : null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [ref, latest] = await Promise.all([
    prisma.portfolioSnapshot.findFirst({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
      select: { date: true, totalUsd: true, breakdown: true },
    }),
    prisma.portfolioSnapshot.findFirst({
      orderBy: { date: "desc" },
      select: { date: true, totalUsd: true, breakdown: true },
    }),
  ]);

  if (!ref || !latest) return NextResponse.json(null);

  return NextResponse.json({
    refDate: ref.date.toISOString().split("T")[0],
    refTotalUsd: snapshotTotal(ref.totalUsd, ref.breakdown, filterCategories),
    latestDate: latest.date.toISOString().split("T")[0],
    latestTotalUsd: snapshotTotal(latest.totalUsd, latest.breakdown, filterCategories),
  });
}
