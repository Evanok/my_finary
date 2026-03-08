const BASE_URL = "https://api.coingecko.com/api/v3";

// CoinGecko uses its own IDs (e.g. "bitcoin", "ethereum"), not ticker symbols.
// Returns price in USD.
export async function fetchCoinGeckoPrice(coinId: string): Promise<number | null> {
  const result = await fetchCoinGeckoPrices([coinId]);
  return result[coinId] ?? null;
}

// Batch fetch: one API call for multiple coin IDs.
// Returns a map of coinId -> priceUsd.
export async function fetchCoinGeckoPrices(coinIds: string[]): Promise<Record<string, number>> {
  if (coinIds.length === 0) return {};
  try {
    const ids = coinIds.map(encodeURIComponent).join(",");
    const res = await fetch(
      `${BASE_URL}/simple/price?ids=${ids}&vs_currencies=usd`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const result: Record<string, number> = {};
    for (const id of coinIds) {
      if (data[id]?.usd !== undefined) result[id] = data[id].usd;
    }
    return result;
  } catch {
    return {};
  }
}
