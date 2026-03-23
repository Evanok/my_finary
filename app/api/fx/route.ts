import { NextRequest, NextResponse } from "next/server";
import { toUsd } from "@/lib/prices/fx";

export async function GET(req: NextRequest) {
  const currency = req.nextUrl.searchParams.get("currency")?.toUpperCase();
  if (!currency || currency === "USD") {
    return NextResponse.json({ rate: 1 });
  }

  // toUsd returns "1 currency = X USD", but we want "1 USD = X currency"
  const usdPerCurrency = await toUsd(currency);
  if (!usdPerCurrency) {
    return NextResponse.json({ rate: 1 });
  }

  return NextResponse.json({ rate: 1 / usdPerCurrency });
}
