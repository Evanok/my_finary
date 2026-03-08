import { NextRequest, NextResponse } from "next/server";
import { getAssetPrice, convertFromUsd } from "@/lib/prices";

// GET /api/prices?symbol=AAPL&category=stock&assetId=xxx&nativeCurrency=USD&displayCurrency=CAD
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = searchParams.get("symbol");
  const category = searchParams.get("category");
  const assetId = searchParams.get("assetId");
  const nativeCurrency = searchParams.get("nativeCurrency") ?? "USD";
  const displayCurrency = searchParams.get("displayCurrency") ?? "USD";

  if (!symbol || !category || !assetId) {
    return NextResponse.json(
      { error: "Missing required params: symbol, category, assetId" },
      { status: 400 }
    );
  }

  const result = await getAssetPrice(assetId, symbol, category, nativeCurrency);

  if (!result) {
    return NextResponse.json(
      { error: "Could not fetch price from any source" },
      { status: 502 }
    );
  }

  const displayPrice = await convertFromUsd(result.priceUsd, displayCurrency);

  return NextResponse.json({
    priceUsd: result.priceUsd,
    displayPrice,
    displayCurrency: displayCurrency.toUpperCase(),
    validated: result.validated,
    sources: result.sources,
  });
}
