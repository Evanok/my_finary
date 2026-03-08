import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Expected CSV columns (case-insensitive):
// date, symbol, name, category, native_currency, quantity, price, currency, type, account_institution, account_type
//
// Example row:
// 2024-01-15,AAPL,Apple Inc,stock,USD,10,180.50,USD,buy,WealthSimple,CELI

interface CsvRow {
  date: string;
  symbol: string;
  name: string;
  category: string;
  native_currency: string;
  quantity: string;
  price: string;
  currency: string;
  type: string;
  account_institution: string;
  account_type: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rows }: { rows: CsvRow[] } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const results = { created: 0, errors: [] as string[] };

  for (const row of rows) {
    try {
      const symbol = row.symbol?.trim().toUpperCase();
      if (!symbol || !row.date || !row.quantity || !row.price) {
        results.errors.push(`Skipped row with missing fields: ${JSON.stringify(row)}`);
        continue;
      }

      // Upsert asset
      const asset = await prisma.asset.upsert({
        where: { symbol },
        update: {},
        create: {
          symbol,
          name: row.name?.trim() || symbol,
          category: row.category?.trim().toLowerCase() || "stock",
          nativeCurrency: row.native_currency?.trim().toUpperCase() || "USD",
        },
      });

      // Find or create account
      const institution = row.account_institution?.trim();
      const accountType = row.account_type?.trim();
      if (!institution || !accountType) {
        results.errors.push(`Skipped row — missing account info: ${symbol}`);
        continue;
      }

      let account = await prisma.account.findFirst({
        where: { institution, type: accountType },
      });
      if (!account) {
        account = await prisma.account.create({
          data: {
            name: `${institution} ${accountType}`,
            institution,
            type: accountType,
          },
        });
      }

      await prisma.transaction.create({
        data: {
          accountId: account.id,
          assetId: asset.id,
          date: new Date(row.date.trim()),
          quantity: parseFloat(row.quantity),
          price: parseFloat(row.price),
          currency: row.currency?.trim().toUpperCase() || "USD",
          type: row.type?.trim().toLowerCase() || "buy",
        },
      });

      results.created++;
    } catch (err) {
      results.errors.push(`Error on row ${row.symbol}: ${err}`);
    }
  }

  return NextResponse.json(results, { status: 200 });
}
