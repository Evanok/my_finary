const BASE_URL = "https://api.coingecko.com/api/v3";

// CoinGecko uses its own IDs (e.g. "bitcoin", "ethereum"), not ticker symbols.
// Returns price in USD.
export async function fetchCoinGeckoPrice(coinId: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data[coinId]?.usd;
    if (price === undefined) return null;
    return price as number;
  } catch {
    return null;
  }
}
