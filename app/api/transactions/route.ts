import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const accountId = searchParams.get("accountId");

  const transactions = await prisma.transaction.findMany({
    where: accountId ? { accountId } : undefined,
    include: { asset: true, account: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { accountId, assetId, date, quantity, price, currency = "USD", type } = body;

  if (!accountId || !assetId || !date || quantity == null || price == null || !type) {
    return NextResponse.json(
      { error: "Missing required fields: accountId, assetId, date, quantity, price, type" },
      { status: 400 }
    );
  }

  const transaction = await prisma.transaction.create({
    data: {
      accountId,
      assetId,
      date: new Date(date),
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      currency,
      type,
    },
    include: { asset: true, account: true },
  });
  return NextResponse.json(transaction, { status: 201 });
}
