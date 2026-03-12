import { NextRequest, NextResponse } from "next/server";
import { getSnapshotSeries } from "@/lib/portfolio/snapshot";

const PERIODS: Record<string, number> = {
  "1d": 1,
  "1w": 7,
  "1m": 30,
  "1y": 365,
};

// GET /api/portfolio/snapshots?period=1w|1m|1y|all
export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "all";
  const days = PERIODS[period];
  const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
  const series = await getSnapshotSeries(since);
  return NextResponse.json(series);
}
