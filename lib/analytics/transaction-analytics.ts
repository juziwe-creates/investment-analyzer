import { calculateXirr, type LotCashFlow, type XirrStatus } from "./engine";
import type { LotProfitability } from "./profitability";

export const DIVIDEND_AFTER_TAX_FACTOR = 0.71575;

export type TransactionAnalyticsRow = {
  id: string;
  securityKey: string;
  securityName: string;
  purchaseDate: string;
  quantityBought: number;
  openQuantity: number;
  costBasis: number;
  costBasisPerShare: number | null;
  latestPrice: number | null;
  priceDate: string | null;
  currentValue: number | null;
  currentDividendYieldPercent: number | null;
  latestDividendDate: string | null;
  accumulatedDividendsTaxFree: number;
  accumulatedDividendsAfterTax: number;
  saleProceeds: number;
  totalRawProfitability: number | null;
  totalRawProfitabilityPercent: number | null;
  totalRawProfitabilityAnnualizedPercent: number | null;
  annualizedReturnStatus: XirrStatus;
  currency: string;
};

export type StockAnalyticsRow = {
  securityKey: string;
  securityName: string;
  firstPurchaseDate: string;
  lastPurchaseDate: string;
  transactionCount: number;
  quantityBought: number;
  openQuantity: number;
  costBasis: number;
  costBasisPerShare: number | null;
  latestPrice: number | null;
  priceDate: string | null;
  currentValue: number | null;
  currentDividendYieldPercent: number | null;
  latestDividendDate: string | null;
  accumulatedDividendsTaxFree: number;
  accumulatedDividendsAfterTax: number;
  saleProceeds: number;
  totalRawProfitability: number | null;
  totalRawProfitabilityPercent: number | null;
  totalRawProfitabilityAnnualizedPercent: number | null;
  annualizedReturnStatus: XirrStatus;
  currency: string;
};

type WorkingStockAnalyticsRow = StockAnalyticsRow & {
  cashFlows: LotCashFlow[];
  hasUnpricedOpenLot: boolean;
  latestDividendPerShare: number | null;
};

function afterTaxCashFlows(cashFlows: LotCashFlow[]) {
  return cashFlows.map((cashFlow) =>
    cashFlow.kind === "dividend"
      ? { ...cashFlow, amount: cashFlow.amount * DIVIDEND_AFTER_TAX_FACTOR }
      : cashFlow
  );
}

function currentDividendYieldPercent(
  latestDividendPerShare: number | null,
  costBasisPerShare: number | null
) {
  if (latestDividendPerShare === null || costBasisPerShare === null || costBasisPerShare <= 0) {
    return null;
  }

  return (latestDividendPerShare / costBasisPerShare) * 100;
}

function annualizedAfterTaxReturn(lot: LotProfitability) {
  if (lot.currentValue === null && lot.remainingQuantity > 0) {
    return { value: null, status: "insufficient_cashflows" as XirrStatus };
  }

  return calculateXirr(afterTaxCashFlows(lot.cashFlows));
}

export function calculateTransactionAnalytics(
  lots: LotProfitability[]
): TransactionAnalyticsRow[] {
  return lots.map((lot) => {
    const accumulatedDividendsAfterTax =
      lot.accumulatedDividends * DIVIDEND_AFTER_TAX_FACTOR;
    const totalEconomicValue =
      lot.currentValue === null
        ? null
        : lot.currentValue + lot.attributedSaleProceeds + accumulatedDividendsAfterTax;
    const totalRawProfitability =
      totalEconomicValue === null ? null : totalEconomicValue - lot.costBasis;
    const annualized = annualizedAfterTaxReturn(lot);

    return {
      id: lot.id,
      securityKey: lot.securityKey,
      securityName: lot.securityName,
      purchaseDate: lot.tradeDate,
      quantityBought: lot.quantity,
      openQuantity: lot.remainingQuantity,
      costBasis: lot.costBasis,
      costBasisPerShare: lot.buyPrice,
      latestPrice: lot.latestPrice,
      priceDate: lot.priceDate,
      currentValue: lot.currentValue,
      currentDividendYieldPercent: currentDividendYieldPercent(
        lot.latestDividendPerShare,
        lot.buyPrice
      ),
      latestDividendDate: lot.latestDividendDate,
      accumulatedDividendsTaxFree: lot.accumulatedDividends,
      accumulatedDividendsAfterTax,
      saleProceeds: lot.attributedSaleProceeds,
      totalRawProfitability,
      totalRawProfitabilityPercent:
        totalRawProfitability === null || lot.costBasis <= 0
          ? null
          : (totalRawProfitability / lot.costBasis) * 100,
      totalRawProfitabilityAnnualizedPercent: annualized.value,
      annualizedReturnStatus: annualized.status,
      currency: lot.currency
    };
  });
}

export function calculateStockAnalytics(lots: LotProfitability[]): StockAnalyticsRow[] {
  const stocksBySecurity = new Map<string, WorkingStockAnalyticsRow>();

  for (const lot of lots) {
    const row = calculateTransactionAnalytics([lot])[0];
    const existing = stocksBySecurity.get(row.securityKey);

    if (!existing) {
      stocksBySecurity.set(row.securityKey, {
        ...row,
        firstPurchaseDate: row.purchaseDate,
        lastPurchaseDate: row.purchaseDate,
        transactionCount: 1,
        cashFlows: afterTaxCashFlows(lot.cashFlows),
        hasUnpricedOpenLot: lot.currentValue === null && lot.remainingQuantity > 0,
        latestDividendPerShare: lot.latestDividendPerShare
      });
      continue;
    }

    existing.transactionCount += 1;
    existing.quantityBought += row.quantityBought;
    existing.openQuantity += row.openQuantity;
    existing.costBasis += row.costBasis;
    existing.accumulatedDividendsTaxFree += row.accumulatedDividendsTaxFree;
    existing.accumulatedDividendsAfterTax += row.accumulatedDividendsAfterTax;
    existing.saleProceeds += row.saleProceeds;
    existing.cashFlows.push(...afterTaxCashFlows(lot.cashFlows));
    existing.hasUnpricedOpenLot =
      existing.hasUnpricedOpenLot || (lot.currentValue === null && lot.remainingQuantity > 0);
    existing.currentValue =
      existing.currentValue === null || row.currentValue === null
        ? null
        : existing.currentValue + row.currentValue;

    if (row.purchaseDate < existing.firstPurchaseDate) {
      existing.firstPurchaseDate = row.purchaseDate;
    }

    if (row.purchaseDate > existing.lastPurchaseDate) {
      existing.lastPurchaseDate = row.purchaseDate;
    }

    if (row.priceDate && (!existing.priceDate || row.priceDate > existing.priceDate)) {
      existing.latestPrice = row.latestPrice;
      existing.priceDate = row.priceDate;
    }

    if (
      row.latestDividendDate &&
      (!existing.latestDividendDate || row.latestDividendDate > existing.latestDividendDate)
    ) {
      existing.latestDividendDate = row.latestDividendDate;
      existing.latestDividendPerShare = lot.latestDividendPerShare;
    }
  }

  return [...stocksBySecurity.values()]
    .map((stock) => {
      const totalEconomicValue =
        stock.currentValue === null
          ? null
          : stock.currentValue + stock.saleProceeds + stock.accumulatedDividendsAfterTax;
      const totalRawProfitability =
        totalEconomicValue === null ? null : totalEconomicValue - stock.costBasis;
      const annualized = stock.hasUnpricedOpenLot
        ? { value: null, status: "insufficient_cashflows" as XirrStatus }
        : calculateXirr(stock.cashFlows);
      const costBasisPerShare =
        stock.quantityBought > 0 ? stock.costBasis / stock.quantityBought : null;

      return {
        securityKey: stock.securityKey,
        securityName: stock.securityName,
        firstPurchaseDate: stock.firstPurchaseDate,
        lastPurchaseDate: stock.lastPurchaseDate,
        transactionCount: stock.transactionCount,
        quantityBought: stock.quantityBought,
        openQuantity: stock.openQuantity,
        costBasis: stock.costBasis,
        costBasisPerShare,
        latestPrice: stock.latestPrice,
        priceDate: stock.priceDate,
        currentValue: stock.currentValue,
        currentDividendYieldPercent: currentDividendYieldPercent(
          stock.latestDividendPerShare,
          costBasisPerShare
        ),
        latestDividendDate: stock.latestDividendDate,
        accumulatedDividendsTaxFree: stock.accumulatedDividendsTaxFree,
        accumulatedDividendsAfterTax: stock.accumulatedDividendsAfterTax,
        saleProceeds: stock.saleProceeds,
        totalRawProfitability,
        totalRawProfitabilityPercent:
          totalRawProfitability === null || stock.costBasis <= 0
            ? null
            : (totalRawProfitability / stock.costBasis) * 100,
        totalRawProfitabilityAnnualizedPercent: annualized.value,
        annualizedReturnStatus: annualized.status,
        currency: stock.currency
      };
    })
    .sort((a, b) => a.securityName.localeCompare(b.securityName));
}
