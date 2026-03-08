import { prisma } from "@/lib/prisma";

// TTL in minutes per asset category
const TTL: Record<string, number> = {
  crypto: 5,
  default: 15, // stocks, ETFs
};

export function getTtlMinutes(category: string): number {
  return TTL[category.toLowerCase()] ?? TTL.default;
}

export async function getCachedPrice(
  assetId: string,
  source: string,
  category: string
): Promise<number | null> {
  const ttlMinutes = getTtlMinutes(category);
  const cutoff = new Date(Date.now() - ttlMinutes * 60 * 1000);

  const cached = await prisma.priceCache.findUnique({
    where: { assetId_source: { assetId, source } },
  });

  if (!cached || cached.fetchedAt < cutoff) return null;
  return cached.price;
}

export async function upsertCachedPrice(
  assetId: string,
  source: string,
  price: number,
  validated: boolean
): Promise<void> {
  try {
    await prisma.priceCache.upsert({
      where: { assetId_source: { assetId, source } },
      update: { price, fetchedAt: new Date(), validated },
      create: { assetId, source, price, validated },
    });
  } catch {
    // Cache write failure is non-blocking — price is still returned to caller
  }
}
