import { NextRequest, NextResponse } from "next/server";
import { computePositions, sumPortfolioUsd } from "@/lib/portfolio/positions";
import { lastPriceUpdate } from "@/lib/prices/cache";

export async function GET(req: NextRequest) {
  const accountIds = req.nextUrl.searchParams.get("accountIds")?.split(",").filter(Boolean);
  const [positions, updatedAt] = await Promise.all([
    computePositions(accountIds),
    lastPriceUpdate(),
  ]);
  const totalUsd = sumPortfolioUsd(positions);
  return NextResponse.json({ totalUsd, positions, updatedAt });
}
