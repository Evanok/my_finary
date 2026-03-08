const BASE_URL = "https://rest.coincap.io/v3";
const COINCAP_API_KEY = process.env.COINCAP_API_KEY ?? "";

// CoinCap uses its own asset IDs (e.g. "bitcoin", "ethereum").
// Pass the CoinCap asset ID as the symbol for crypto assets.
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
    // CoinCap returns USD — convert to CAD
    const cadRate = await fetchUsdToCad();
    if (!cadRate) return null;
    return parseFloat(priceUsd) * cadRate;
  } catch {
    return null;
  }
}

async function fetchUsdToCad(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=CAD",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates?.CAD ?? null;
  } catch {
    return null;
  }
}
