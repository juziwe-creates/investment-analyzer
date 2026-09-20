export const benchmarkOptions = [
  { id: "msci-world", label: "MSCI World" },
  { id: "sp-500", label: "S&P 500" },
  { id: "dax", label: "DAX" }
] as const;

export type BenchmarkId = (typeof benchmarkOptions)[number]["id"];

export function parseBenchmark(value: string | undefined): BenchmarkId {
  return benchmarkOptions.some((option) => option.id === value)
    ? (value as BenchmarkId)
    : "msci-world";
}

// Columns verified against the existing benchmark history upload DDL; no migration.
export type BenchmarkObservation = {
  benchmark_id: string;
  price_date: string;
  observation_date: string;
  close_price: number;
  currency: string;
  frequency?: string;
  series_type: string;
  is_derived: boolean;
  is_partial_period: boolean;
};

type PortfolioObservation = { date: string; portfolioValue: number | null; hasCompletePricing: boolean };
export type BenchmarkComparisonPoint = { date: string; portfolio: number | null; benchmark: number };
export type AnnualReturn = { year: string; returnPercent: number | null };

export function normalizeBenchmarkComparison(
  portfolio: PortfolioObservation[],
  benchmark: BenchmarkObservation[],
  range: { start: number; end: number }
): BenchmarkComparisonPoint[] {
  const holdings = [...portfolio].sort((a, b) => a.date.localeCompare(b.date));
  const levels = benchmark.filter((row) => row.currency === "EUR" && Number.isFinite(Number(row.close_price)) && Number(row.close_price) > 0)
    .sort((a, b) => a.price_date.localeCompare(b.price_date));
  const firstHolding = holdings.find((row) => row.hasCompletePricing && row.portfolioValue !== null && row.portfolioValue > 0);
  if (!firstHolding || !levels.length) return [];
  const time = (date: string) => Date.parse(date + "T00:00:00Z");
  const start = Math.max(range.start, time(firstHolding.date));
  const end = Math.min(range.end, time(holdings.at(-1)!.date), time(levels.at(-1)!.price_date));
  const base = levels.find((row) => time(row.price_date) >= start && time(row.price_date) <= end);
  if (!base) return [];
  let holdingIndex = 0;
  while (holdingIndex + 1 < holdings.length && holdings[holdingIndex + 1].date <= base.price_date) holdingIndex++;
  const opening = holdings[holdingIndex];
  if (!opening.hasCompletePricing || opening.portfolioValue === null || !Number.isFinite(opening.portfolioValue) || opening.portfolioValue <= 0) return [];
  const openingValue = opening.portfolioValue;
  let levelIndex = levels.indexOf(base);
  const dates = [...new Set([
    ...holdings.map((row) => row.date), ...levels.map((row) => row.price_date)
  ])].filter((date) => date >= base.price_date && time(date) <= end).sort();
  return dates.map((date) => {
    // Carry observations forward only; never use a future price at an earlier date.
    while (holdingIndex + 1 < holdings.length && holdings[holdingIndex + 1].date <= date) holdingIndex++;
    while (levelIndex + 1 < levels.length && levels[levelIndex + 1].price_date <= date) levelIndex++;
    const holding = holdings[holdingIndex];
    return {
      date,
      portfolio: holding.hasCompletePricing && holding.portfolioValue !== null && Number.isFinite(holding.portfolioValue) ? 100 * holding.portfolioValue / openingValue : null,
      benchmark: 100 * Number(levels[levelIndex].close_price) / Number(base.close_price)
    };
  });
}

// The last stored observation in each calendar year, matching the security grid.
export function annualPriceReturns(
  prices: { date: string; value: number }[],
  currentYear = new Date().getUTCFullYear()
): AnnualReturn[] {
  const latest = new Map<number, number>();
  for (const price of [...prices].sort((a, b) => a.date.localeCompare(b.date))) {
    latest.set(Number(price.date.slice(0, 4)), Number(price.value));
  }
  return [...latest.keys()].sort((a, b) => a - b).slice(1).map((year) => {
    const previous = latest.get(year - 1), current = latest.get(year)!;
    return {
      year: year === currentYear ? `${year} YTD` : String(year),
      returnPercent: previous !== undefined && previous > 0 && Number.isFinite(previous) && current > 0 && Number.isFinite(current)
        ? (current / previous - 1) * 100 : null
    };
  });
}

export function annualBenchmarkComparison(investment: AnnualReturn[], benchmark: AnnualReturn[]) {
  const returns = new Map(benchmark.map((point) => [point.year, point.returnPercent]));
  return investment.map((point) => {
    const benchmarkReturn = returns.get(point.year) ?? null;
    return { ...point, benchmarkReturn, difference: point.returnPercent === null || benchmarkReturn === null ? null : point.returnPercent - benchmarkReturn };
  });
}
