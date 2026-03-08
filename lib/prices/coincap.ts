const BASE_URL = "https://rest.coincap.io/v3";
const COINCAP_API_KEY = process.env.COINCAP_API_KEY ?? "";

// CoinCap uses its own asset IDs (e.g. "bitcoin", "ethereum").
// Returns price in USD (CoinCap natively returns USD).
export async function fetchCoinCapPrice(assetId: string): Promise<number | null> {
  if (!COINCAP_API_KEY) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/assets/${encodeURIComponent(assetId)}?apiKey=${COINCAP_API_KEY}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const priceUsd = data.data?.priceUsd;
    if (!priceUsd) return null;
    return parseFloat(priceUsd);
  } catch {
    return null;
  }
}
