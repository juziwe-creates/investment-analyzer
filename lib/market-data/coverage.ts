import type { DailyMarketPrice } from "./types";

export function priceHistoryCoverage(prices: DailyMarketPrice[], firstTradeDate: string) {
  if (!prices.length) throw new Error("The provider returned no prices. Existing history was retained.");
  const dates = prices.map((price) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(price.priceDate) || !Number.isFinite(price.closePrice) || price.closePrice <= 0) throw new Error("The provider returned an invalid price observation. Existing history was retained.");
    return price.priceDate;
  }).sort();
  const first = dates[0], last = dates.at(-1)!;
  return { first, last, warning: first > firstTradeDate
    ? `Incomplete price history: the provider returned prices starting ${first}, but the first recorded transaction is ${firstTradeDate}. Earlier price history is still missing.` : null };
}
