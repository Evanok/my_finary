import { NextResponse } from "next/server";
import { refreshPrices } from "@/lib/portfolio/snapshot";
import { lastPriceUpdate } from "@/lib/prices/cache";

// POST /api/portfolio/refresh — clear price cache and re-fetch all prices
export async function POST() {
  await refreshPrices();
  const updatedAt = await lastPriceUpdate();
  return NextResponse.json({ updatedAt });
}
