import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PERIODS: Record<string, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "1y": 365,
};

// GET /api/portfolio/snapshots/reference?period=1d
// Returns the last snapshot BEFORE (now - period), used as the P&L reference point.
// Also returns the most recent snapshot as the "current" value for consistent comparison.
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "1d";
  const days = PERIODS[period];
  if (!days) return NextResponse.json(null);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [ref, latest] = await Promise.all([
    prisma.portfolioSnapshot.findFirst({
      where: { date: { lt: since } },
      orderBy: { date: "desc" },
      select: { date: true, totalUsd: true },
    }),
    prisma.portfolioSnapshot.findFirst({
      orderBy: { date: "desc" },
      select: { date: true, totalUsd: true },
    }),
  ]);

  if (!ref || !latest) return NextResponse.json(null);

  return NextResponse.json({
    refDate: ref.date.toISOString().split("T")[0],
    refTotalUsd: ref.totalUsd,
    latestDate: latest.date.toISOString().split("T")[0],
    latestTotalUsd: latest.totalUsd,
  });
}
