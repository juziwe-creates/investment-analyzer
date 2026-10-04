import type { BenchmarkView } from "../analytics/benchmark-portfolio";
import type { BenchmarkId } from "../analytics/benchmarks";
import type { PortfolioHolding } from "../analytics/portfolio";
import type { LotProfitability } from "../analytics/profitability";

export type MapLot = {
  id: string;
  date: string;
  currency: string;
  cost: number;
  quantity: number;
  remainingQuantity: number;
  currentValue: number | null;
  actualEconomicValue: number | null;
  actualReturn: number | null;
  benchmarkValue: number | null;
  benchmarkReturn: number | null;
  returnDifference: number | null;
  reason: string | null;
};

export type MapHolding = {
  key: string;
  name: string;
  monogram: string;
  sector: string;
  quantity: number;
  value: number | null;
  weight: number | null;
  deployed: number;
  totalReturn: number | null;
  annualizedReturn: number | null;
  relativeReturn: number | null;
  comparisonReason: string | null;
  currency: string;
  href: string;
  lots: MapLot[];
};

export type PortfolioMapModel = {
  holdings: MapHolding[];
  benchmarkId: BenchmarkId;
  benchmarkLabel: string;
  benchmarkError: string | null;
  totalValue: number | null;
  weightsAvailable: boolean;
};

export function buildPortfolioMapModel(input: {
  holdings: PortfolioHolding[];
  lots: LotProfitability[];
  comparison: BenchmarkView;
  portfolioId?: string;
  benchmarkId: BenchmarkId;
  tickerByKey?: ReadonlyMap<string, string>;
  sectorByKey?: ReadonlyMap<string, string>;
}): PortfolioMapModel {
  const current = input.holdings.filter((holding) => holding.quantity > 0);
  const weightsAvailable = current.every((holding) => holding.currency === "EUR" && holding.marketValue !== null && Number.isFinite(holding.marketValue));
  const totalValue = weightsAvailable ? current.reduce((sum, holding) => sum + holding.marketValue!, 0) : null;
  const comparisonByLot = new Map(input.comparison.lots.map((row) => [row.id, row]));
  const lotsByKey = new Map<string, MapLot[]>();
  for (const lot of input.lots) {
    const reference = comparisonByLot.get(lot.id);
    const rows = lotsByKey.get(lot.securityKey) ?? [];
    rows.push({
      id: lot.id,
      date: lot.tradeDate,
      currency: lot.currency,
      cost: lot.costBasis,
      quantity: lot.quantity,
      remainingQuantity: lot.remainingQuantity,
      currentValue: lot.currentValue,
      actualEconomicValue: reference?.actual.economicReferenceValue ?? lot.totalEconomicValue,
      actualReturn: lot.totalReturnPercent,
      benchmarkValue: reference?.benchmark.economicReferenceValue ?? null,
      benchmarkReturn: reference?.benchmark.returnPercent ?? null,
      returnDifference: reference?.difference.returnPercent ?? null,
      reason: reference?.reason ?? input.comparison.error
    });
    lotsByKey.set(lot.securityKey, rows);
  }
  const holdings = current.map((holding): MapHolding => {
    const params = new URLSearchParams({ benchmark: input.benchmarkId });
    if (input.portfolioId) params.set("portfolio", input.portfolioId);
    const ticker = input.tickerByKey?.get(holding.securityKey)?.split(".")[0];
    const reference = input.comparison.holdings[holding.securityKey];
    return {
      key: holding.securityKey,
      name: holding.securityName,
      monogram: (ticker || holding.securityName).trim().slice(0, 3).toUpperCase(),
      sector: input.sectorByKey?.get(holding.securityKey)?.trim() || "Unclassified",
      quantity: holding.quantity,
      value: holding.marketValue,
      weight: totalValue && holding.marketValue !== null ? holding.marketValue / totalValue * 100 : null,
      deployed: holding.investedCapital,
      totalReturn: holding.totalReturnPercent,
      annualizedReturn: holding.annualizedReturnPercent,
      relativeReturn: reference?.difference.returnPercent ?? null,
      comparisonReason: reference?.reason ?? input.comparison.error,
      currency: holding.currency,
      href: `/portfolio/${encodeURIComponent(holding.securityKey)}?${params}`,
      lots: (lotsByKey.get(holding.securityKey) ?? []).sort((a, b) => a.date.localeCompare(b.date))
    };
  }).sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1) || a.name.localeCompare(b.name));
  return {
    holdings,
    benchmarkId: input.benchmarkId,
    benchmarkLabel: input.comparison.label,
    benchmarkError: input.comparison.error,
    totalValue,
    weightsAvailable
  };
}
