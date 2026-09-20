import { calculatePurchaseLots, type AnalyticsTransaction, type LotMatchingMethod } from "./engine";
import type { BenchmarkId, BenchmarkObservation } from "./benchmarks";
import type { LotProfitability } from "./profitability";

export const quote = (date: string, value: number, id: BenchmarkId = "msci-world"): BenchmarkObservation => ({
  benchmark_id: id, price_date: date, observation_date: date, close_price: value,
  currency: "EUR", frequency: "weekly", series_type: "net_total_return", is_derived: true, is_partial_period: false
});
export const history = [quote("2019-12-27", 100), quote("2020-12-25", 120), quote("2021-12-31", 150), quote("2022-12-30", 180)];
export const transaction = (id: string, date: string, type: AnalyticsTransaction["type"], quantity: number, amount: number, key = "A"): AnalyticsTransaction => ({
  id, trade_date: date, created_at: date, type, quantity, gross_amount: amount, net_amount: null,
  unit_price: null, security_name: key, isin: key, ticker: null, currency: "EUR"
});
export function sourceLots(transactions: AnalyticsTransaction[], matching: LotMatchingMethod = "fifo", end = "2022-01-03", price = 200): LotProfitability[] {
  return calculatePurchaseLots(transactions, ["A", "B"].map((key) => ({ security_key: key, price_date: end, price, currency: "EUR" })), end, { lotMatchingMethod: matching }).map((lot) => ({
    id: lot.buyTransactionId, tradeDate: lot.buyDate, securityKey: lot.securityKey, securityName: lot.securityName, type: "buy",
    quantity: lot.originalQuantity, remainingQuantity: lot.remainingQuantity, actualPurchasePrice: lot.actualPurchasePrice, buyPrice: lot.acquisitionCostPerShare,
    costBasis: lot.originalAcquisitionCost, remainingCostBasis: lot.remainingAcquisitionCost,
    latestPrice: lot.currentMarketPrice, priceSource: "market", priceDate: lot.currentPriceDate,
    currentValue: lot.currentRemainingValue, closingSalePricePerShare: lot.closingSalePricePerShare, closingSaleDate: lot.closingSaleDate,
    unrealizedGainLoss: lot.unrealizedGain, accumulatedDividends: lot.attributedDividends,
    currentDividendProfitabilityPercent: lot.currentDividendProfitabilityPercent,
    averageDividendProfitabilityPercent: lot.averageDividendProfitabilityPercent,
    latestDividendPerShare: lot.latestDividendPerShare, latestDividendDate: lot.latestDividendDate,
    attributedSaleProceeds: lot.attributedSaleProceeds, totalEconomicValue: lot.totalEconomicValue,
    totalProfitability: lot.totalGain, totalReturnPercent: lot.totalReturnPercent,
    annualizedReturnPercent: lot.annualizedReturnPercent, annualizedReturnStatus: lot.annualizedReturnStatus,
    currency: lot.currency, cashFlows: lot.cashFlows, saleAllocations: lot.saleAllocations
  }));
}
