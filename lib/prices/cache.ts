import { prisma } from "@/lib/prisma";

// Prices are cached indefinitely — only refreshed on manual request or daily snapshot.
export async function getCachedPriceUsd(
  assetId: string,
  source: string,
): Promise<number | null> {
  const cached = await prisma.priceCache.findUnique({
    where: { assetId_source: { assetId, source } },
  });
  return cached?.priceUsd ?? null;
}

export async function upsertCachedPriceUsd(
  assetId: string,
  source: string,
  priceUsd: number,
  validated: boolean
): Promise<void> {
  try {
    await prisma.priceCache.upsert({
      where: { assetId_source: { assetId, source } },
      update: { priceUsd, fetchedAt: new Date(), validated },
      create: { assetId, source, priceUsd, validated },
    });
  } catch {
    // Cache write failure is non-blocking — price is still returned to caller
  }
}

// Clear all cached prices to force a full re-fetch on next request.
export async function clearPriceCache(): Promise<void> {
  await prisma.priceCache.deleteMany();
}

// Returns the most recent fetchedAt across all cached prices.
export async function lastPriceUpdate(): Promise<Date | null> {
  const latest = await prisma.priceCache.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });
  return latest?.fetchedAt ?? null;
}
