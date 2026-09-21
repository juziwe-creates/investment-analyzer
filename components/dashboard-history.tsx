import { PortfolioDevelopmentChart } from "@/components/portfolio-development-chart";
import { cache } from "react";
import { CapitalDeploymentChart } from "@/components/capital-deployment-chart";
import { TimeViewportData } from "@/components/time-viewport";
import type { loadDashboardHistory } from "@/lib/analytics/dashboard-history";
import { AlphaProgress } from "@/components/alpha-progress";
import type { readBenchmarkHistory } from "@/lib/market-data/benchmark-history";
import type { BenchmarkId } from "@/lib/analytics/benchmarks";
import { benchmarkView, buildBenchmarkComparison, calculateVirtualBenchmarkTimeline } from "@/lib/analytics/benchmark-portfolio";
import type { LotProfitability } from "@/lib/analytics/profitability";
import type { PortfolioHolding } from "@/lib/analytics/portfolio";
import type { YieldOnCost } from "@/lib/analytics/dividends";
import { PortfolioHoldingsTable } from "@/components/portfolio-holdings-table";

type Props = { history: ReturnType<typeof loadDashboardHistory> };
const loadComparison = cache(async (lots: LotProfitability[], benchmark: BenchmarkId, history: ReturnType<typeof readBenchmarkHistory>) => {
  const reference = await history;
  const comparison = buildBenchmarkComparison(lots, reference.data, benchmark, "fifo");
  if (reference.error) comparison.error = reference.error;
  return { comparison, reference };
});

export function HistoryLoading({ label }: { label: string }) {
  return <div className="flex h-[440px] items-center justify-center rounded-md bg-muted/40"><AlphaProgress size="large" status={`Loading ${label}`} /></div>;
}

export async function DashboardPerformance({ history, benchmarkHistories, lots }: Props & { benchmarkHistories: { benchmark: BenchmarkId; history: ReturnType<typeof readBenchmarkHistory> }[]; lots: LotProfitability[] }) {
  const [{ development, deployment, annual, error }, comparisons] = await Promise.all([
    history,
    Promise.all(benchmarkHistories.map(({ benchmark, history: benchmarkHistory }) => loadComparison(lots, benchmark, benchmarkHistory)))
  ]);
  const dates = [...development, ...deployment, ...annual].map((point) => point.date);
  const benchmarks = comparisons.map(({ comparison, reference }) => ({ comparison: benchmarkView(comparison), timeline: calculateVirtualBenchmarkTimeline(comparison.virtualLots, reference.data, comparison.benchmarkId, dates) }));
  return <><TimeViewportData dates={dates} />{error ? <p role="alert" className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">{error}</p> : <PortfolioDevelopmentChart points={development} benchmarks={benchmarks} />}</>;
}

export async function DashboardHoldings({ holdings, lots, yields, benchmark, benchmarkHistory }: {
  holdings: PortfolioHolding[]; lots: LotProfitability[]; yields: Record<string, YieldOnCost>;
  benchmark: BenchmarkId; benchmarkHistory: ReturnType<typeof readBenchmarkHistory>;
}) {
  const { comparison } = await loadComparison(lots, benchmark, benchmarkHistory);
  return <PortfolioHoldingsTable holdings={holdings} yields={yields} comparison={benchmarkView(comparison)} />;
}

export async function DashboardCapitalDeployment({ history }: Props) {
  const { deployment, annual, rows, error } = await history;
  return error ? <p role="alert" className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">{error}</p> : <CapitalDeploymentChart points={deployment} annual={annual} transactions={rows} />;
}
