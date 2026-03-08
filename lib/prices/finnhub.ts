const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? "";
const BASE_URL = "https://finnhub.io/api/v1";

export async function fetchFinnhubPrice(symbol: string): Promise<number | null> {
  if (!FINNHUB_API_KEY) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // data.c is the current price; 0 means no data
    if (!data.c || data.c === 0) return null;
    return data.c as number;
  } catch {
    return null;
  }
}
