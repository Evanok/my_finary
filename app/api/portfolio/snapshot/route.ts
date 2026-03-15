import { NextResponse } from "next/server";
import { takeSnapshot } from "@/lib/portfolio/snapshot";

// POST /api/portfolio/snapshot — compute and persist today's snapshot
export async function POST() {
  const result = await takeSnapshot();
  if (result.failedSymbols.length > 0) {
    return NextResponse.json(result, { status: 207 });
  }
  return NextResponse.json(result, { status: 201 });
}
