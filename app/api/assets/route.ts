import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const assets = await prisma.asset.findMany({ orderBy: { symbol: "asc" } });
  return NextResponse.json(assets);
}

// Upsert: create asset if it doesn't exist, return existing if it does.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { symbol, name, category, nativeCurrency = "USD" } = body;

  if (!symbol || !name || !category) {
    return NextResponse.json(
      { error: "Missing required fields: symbol, name, category" },
      { status: 400 }
    );
  }

  const asset = await prisma.asset.upsert({
    where: { symbol: symbol.toUpperCase() },
    update: { name, category, nativeCurrency },
    create: { symbol: symbol.toUpperCase(), name, category, nativeCurrency },
  });
  return NextResponse.json(asset, { status: 201 });
}
