import {
  calculatePurchaseLots,
  type AnalyticsPrice,
  type AnalyticsTransaction,
  type LotCalculationOptions,
  type LotCashFlow,
  type XirrStatus
} from "@/lib/analytics/engine";
import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type ManualSecurityPrice = Database["public"]["Tables"]["manual_security_prices"]["Row"];
type LatestMarketPrice = Database["public"]["Views"]["latest_market_prices"]["Row"];

export type ValuationPrice = AnalyticsPrice & {
  source: "market" | "manual";
};

export type LotProfitability = {
  id: string;
  tradeDate: string;
  securityKey: string;
  securityName: string;
  type: "buy";
  quantity: number;
  remainingQuantity: number;
  buyPrice: number | null;
  costBasis: number;
  remainingCostBasis: number;
  latestPrice: number | null;
  priceSource: "market" | "manual" | null;
  priceDate: string | null;
  currentValue: number | null;
  unrealizedGainLoss: number | null;
  accumulatedDividends: number;
  currentDividendProfitabilityPercent: number | null;
  averageDividendProfitabilityPercent: number | null;
  latestDividendPerShare: number | null;
  latestDividendDate: string | null;
  attributedSaleProceeds: number;
  totalEconomicValue: number | null;
  totalProfitability: number | null;
  totalReturnPercent: number | null;
  annualizedReturnPercent: number | null;
  annualizedReturnStatus: XirrStatus;
  currency: string;
  cashFlows: LotCashFlow[];
};

function toAnalyticsTransaction(transaction: Transaction): AnalyticsTransaction {
  return {
    id: transaction.id,
    type: transaction.type,
    trade_date: transaction.trade_date,
    security_name: transaction.security_name,
    isin: transaction.isin,
    wkn: transaction.wkn,
    ticker: transaction.ticker,
    quantity: transaction.quantity,
    unit_price: transaction.unit_price,
    gross_amount: transaction.gross_amount,
    net_amount: transaction.net_amount,
    currency: transaction.currency,
    created_at: transaction.created_at
  };
}

function priceSource(source: string | undefined): "market" | "manual" | null {
  if (source === "market" || source === "manual") {
    return source;
  }

  return null;
}

export function calculateLotProfitability(
  transactions: Transaction[],
  prices: ValuationPrice[],
  options: LotCalculationOptions = {}
) {
  return calculatePurchaseLots(transactions.map(toAnalyticsTransaction), prices, undefined, options)
    .map((lot): LotProfitability => ({
      id: lot.buyTransactionId,
      tradeDate: lot.buyDate,
      securityKey: lot.securityKey,
      securityName: lot.securityName,
      type: "buy",
      quantity: lot.originalQuantity,
      remainingQuantity: lot.remainingQuantity,
      buyPrice: lot.acquisitionCostPerShare || null,
      costBasis: lot.originalAcquisitionCost,
      remainingCostBasis: lot.remainingAcquisitionCost,
      latestPrice: lot.currentMarketPrice,
      priceSource: priceSource(prices.find((price) => price.security_key === lot.securityKey)?.source),
      priceDate: lot.currentPriceDate,
      currentValue: lot.currentRemainingValue,
      unrealizedGainLoss: lot.unrealizedGain,
      accumulatedDividends: lot.attributedDividends,
      currentDividendProfitabilityPercent: lot.currentDividendProfitabilityPercent,
      averageDividendProfitabilityPercent: lot.averageDividendProfitabilityPercent,
      latestDividendPerShare: lot.latestDividendPerShare,
      latestDividendDate: lot.latestDividendDate,
      attributedSaleProceeds: lot.attributedSaleProceeds,
      totalEconomicValue: lot.totalEconomicValue,
      totalProfitability: lot.totalGain,
      totalReturnPercent: lot.totalReturnPercent,
      annualizedReturnPercent: lot.annualizedReturnPercent,
      annualizedReturnStatus: lot.annualizedReturnStatus,
      currency: lot.currency,
      cashFlows: lot.cashFlows
    }))
    .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
}

export function buildValuationPrices(
  marketPrices: LatestMarketPrice[],
  manualPrices: ManualSecurityPrice[]
): ValuationPrice[] {
  const pricesBySecurity = new Map<string, ValuationPrice>();

  for (const manualPrice of manualPrices) {
    pricesBySecurity.set(manualPrice.security_key, {
      security_key: manualPrice.security_key,
      price: manualPrice.price,
      price_date: manualPrice.price_date,
      currency: manualPrice.currency,
      source: "manual",
      id: manualPrice.id
    });
  }

  for (const marketPrice of marketPrices) {
    pricesBySecurity.set(marketPrice.security_key, {
      security_key: marketPrice.security_key,
      price: marketPrice.adjusted_close_price ?? marketPrice.close_price,
      price_date: marketPrice.price_date,
      currency: marketPrice.currency,
      source: "market",
      id: marketPrice.id
    });
  }

  return [...pricesBySecurity.values()];
}
