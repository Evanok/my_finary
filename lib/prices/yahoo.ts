import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function fetchYahooPrice(symbol: string): Promise<number | null> {
  try {
    const quote = await yf.quote(symbol);
    const price = quote.regularMarketPrice;
    if (price === undefined || price === null) return null;
    return price;
  } catch {
    return null;
  }
}
