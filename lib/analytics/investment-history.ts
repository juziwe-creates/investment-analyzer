import { buildInvestmentLedger, type AnalyticsPrice, type AnalyticsTransaction, type LotCalculationOptions } from "./engine";

export type InvestmentChartPoint = { date: string; price: number | null; shares: number; positionValue: number | null; deployedCapital: number; unrealizedReturnPercent: number | null; currency: string };

export function investmentHistory(transactions: AnalyticsTransaction[], prices: AnalyticsPrice[], options: LotCalculationOptions = { lotMatchingMethod: "lifo" }): InvestmentChartPoint[] {
  const ledger = buildInvestmentLedger(transactions, options);
  const quotes = [...prices].sort((a, b) => a.price_date.localeCompare(b.price_date));
  const first = ledger[0]?.transaction.trade_date;
  if (!first) return [];
  const dates = [...new Set([...ledger.map((row) => row.transaction.trade_date), ...quotes.map((row) => row.price_date)])].filter((date) => date >= first).sort();
  let li = 0, pi = 0, shares = 0, cost = 0;
  let quote: AnalyticsPrice | undefined;
  return dates.map((date) => {
    while (li < ledger.length && ledger[li].transaction.trade_date <= date) {
      const row = ledger[li++];
      if (row.transaction.type === "buy") shares += row.transaction.quantity ?? 0;
      if (row.transaction.type === "sell") shares -= row.transaction.quantity ?? 0;
      cost = row.activeCost;
    }
    while (pi < quotes.length && quotes[pi].price_date <= date) quote = quotes[pi++];
    const quantity = Math.max(0, shares);
    const value = quantity === 0 ? 0 : quote ? quantity * quote.price : null;
    return { date, price: quote?.price ?? null, shares: quantity, positionValue: value, deployedCapital: cost,
      unrealizedReturnPercent: value !== null && cost > 0 ? (value - cost) / cost * 100 : null,
      currency: quote?.currency ?? transactions[0].currency };
  });
}
