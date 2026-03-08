import { prisma } from "@/lib/prisma";

const FX_TTL_MS = 60 * 60 * 1000; // 1 hour
const FRANKFURTER_URL = "https://api.frankfurter.app/latest";

// Returns how many USD = 1 unit of the given currency.
// e.g. toUsd("CAD") => ~0.73 (1 CAD = 0.73 USD)
// For USD, always returns 1.
export async function toUsd(currency: string): Promise<number | null> {
  const normalized = currency.toUpperCase();
  if (normalized === "USD") return 1;

  const pair = `${normalized}/USD`;

  // Check cache
  const cached = await prisma.fxRateCache.findUnique({ where: { pair } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < FX_TTL_MS) {
    return cached.rate;
  }

  // Fetch fresh rate
  const rate = await fetchFxRate(normalized);
  if (rate === null) {
    // Return stale cache if available rather than failing
    return cached?.rate ?? null;
  }

  await prisma.fxRateCache.upsert({
    where: { pair },
    update: { rate, fetchedAt: new Date() },
    create: { pair, rate },
  });

  return rate;
}

// Fetch all supported non-USD rates in one call to minimize API requests.
export async function prefetchFxRates(): Promise<void> {
  const rates = await fetchAllRates();
  if (!rates) return;

  await Promise.all(
    Object.entries(rates).map(([currency, rate]) => {
      const pair = `${currency}/USD`;
      return prisma.fxRateCache.upsert({
        where: { pair },
        update: { rate, fetchedAt: new Date() },
        create: { pair, rate },
      });
    })
  );
}

async function fetchFxRate(currency: string): Promise<number | null> {
  try {
    // Request the rate of USD in terms of the given currency, then invert
    const res = await fetch(
      `${FRANKFURTER_URL}?from=${currency}&to=USD`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates?.USD ?? null;
  } catch {
    return null;
  }
}

async function fetchAllRates(): Promise<Record<string, number> | null> {
  try {
    // Fetch EUR and CAD to USD in a single call
    const res = await fetch(
      `${FRANKFURTER_URL}?from=USD&to=EUR,CAD`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // data.rates = { EUR: 0.92, CAD: 1.37 } — these are "1 USD = X currency"
    // We want "1 currency = Y USD", so invert
    const result: Record<string, number> = {};
    for (const [currency, rate] of Object.entries(data.rates as Record<string, number>)) {
      result[currency] = 1 / rate;
    }
    return result;
  } catch {
    return null;
  }
}
