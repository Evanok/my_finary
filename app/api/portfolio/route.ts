import { NextResponse } from "next/server";
import { computePositions, sumPortfolioUsd } from "@/lib/portfolio/positions";
import { lastPriceUpdate } from "@/lib/prices/cache";

export async function GET() {
  const [positions, updatedAt] = await Promise.all([
    computePositions(),
    lastPriceUpdate(),
  ]);
  const totalUsd = sumPortfolioUsd(positions);
  return NextResponse.json({ totalUsd, positions, updatedAt });
}
