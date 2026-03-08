import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertCachedPriceUsd } from "@/lib/prices/cache";
import { toUsd } from "@/lib/prices/fx";

// POST /api/assets/[id]/valuation — set manual valuation for real_estate assets
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { value, currency = "USD" } = await req.json();

  if (typeof value !== "number" || value <= 0) {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }

  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (asset.category.toLowerCase() !== "real_estate") {
    return NextResponse.json({ error: "Only real_estate assets support manual valuation" }, { status: 400 });
  }

  const fxRate = await toUsd(currency);
  if (fxRate === null) return NextResponse.json({ error: "Unknown currency" }, { status: 400 });

  const priceUsd = value * fxRate;
  await upsertCachedPriceUsd(id, "manual", priceUsd, true);

  return NextResponse.json({ priceUsd });
}
