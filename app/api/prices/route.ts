import { NextRequest, NextResponse } from "next/server";
import { getAssetPrice } from "@/lib/prices";

// GET /api/prices?symbol=AAPL&category=stock&assetId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = searchParams.get("symbol");
  const category = searchParams.get("category");
  const assetId = searchParams.get("assetId");

  if (!symbol || !category || !assetId) {
    return NextResponse.json(
      { error: "Missing required params: symbol, category, assetId" },
      { status: 400 }
    );
  }

  const result = await getAssetPrice(assetId, symbol, category);

  if (!result) {
    return NextResponse.json(
      { error: "Could not fetch price from any source" },
      { status: 502 }
    );
  }

  return NextResponse.json(result);
}
