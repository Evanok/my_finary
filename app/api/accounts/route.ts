import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { transactions: true } } },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, institution, type } = body;

  if (!name || !institution || !type) {
    return NextResponse.json(
      { error: "Missing required fields: name, institution, type" },
      { status: 400 }
    );
  }

  const account = await prisma.account.create({
    data: { name, institution, type },
  });
  return NextResponse.json(account, { status: 201 });
}
