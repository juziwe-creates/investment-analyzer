"use client";

import { useState } from "react";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { BenchmarkMethodology } from "@/components/benchmark-comparison";
import { formatCurrency } from "@/lib/formatters";
import type { PortfolioDevelopmentPoint } from "@/lib/analytics/portfolio";
import { benchmarkCounterfactualLabel, type BenchmarkTimelinePoint, type BenchmarkView } from "@/lib/analytics/benchmark-portfolio";

export function PortfolioDevelopmentChart({ points, emptyMessage, comparison, benchmarkTimeline = [] }: {
  points: PortfolioDevelopmentPoint[]; emptyMessage?: string;
  comparison?: BenchmarkView; benchmarkTimeline?: BenchmarkTimelinePoint[];
}) {
  const [showDividends, setShowDividends] = useState(false);
  const hasIncompletePricing = points.some((point) => !point.hasCompletePricing);
  return <div className="space-y-3">
    <div className="flex justify-end"><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDividends} onChange={(event) => setShowDividends(event.target.checked)} />Cumulative dividends</label></div>
    <TimeSeriesChart points={points} label="Portfolio performance" emptyMessage={emptyMessage} series={[
      { label: "Portfolio Value", color: "hsl(var(--chart-portfolio))", value: (point) => point.portfolioValue },
      ...(hasIncompletePricing ? [{ label: "Priced Holdings Value (partial)", color: "hsl(var(--chart-portfolio) / .55)", value: (point: PortfolioDevelopmentPoint) => point.pricedPortfolioValue }] : []),
      ...(comparison ? [{ label: benchmarkCounterfactualLabel(comparison.label, comparison.dividendTreatment), color: "hsl(var(--chart-benchmark))", value: () => null, stepped: true,
        observations: benchmarkTimeline.map((point) => ({ date: point.date, value: point.value,
          tooltip: [{ label: comparison.label, value: point.value === null ? "Unavailable" : formatCurrency(point.value, "EUR") },
            { label: "Benchmark observation", value: point.observationDate ?? "Unavailable" }] })) }] : []),
      { label: "Current Deployed Capital", color: "hsl(var(--chart-deployed))", value: (point) => point.investedCapital, stepped: true },
      ...(showDividends ? [{ label: "Cumulative Dividends", color: "hsl(var(--chart-dividend))", value: (point: PortfolioDevelopmentPoint) => point.dividendsReceived, stepped: true }] : [])
    ]} tooltip={(point) => [
      { label: "Portfolio value", value: formatCurrency(point.portfolioValue, point.currency) },
      ...(!point.hasCompletePricing ? [{ label: "Priced holdings value (partial)", value: formatCurrency(point.pricedPortfolioValue, point.currency) }] : []),
      { label: "Current deployed", value: formatCurrency(point.investedCapital, point.currency) },
      { label: "Unrealized", value: formatCurrency(point.investmentGain, point.currency) },
      ...(showDividends ? [{ label: "Dividends", value: formatCurrency(point.dividendsReceived, point.currency) }] : [])
    ]} />
    {benchmarkTimeline.some((point) => point.missingLots > 0) ? <p className="text-xs text-muted-foreground">Some benchmark entry history is missing. Incomplete portfolio benchmark totals are unavailable; covered purchase lots remain available in their comparison view.</p> : null}
    {hasIncompletePricing ? <p className="text-xs text-muted-foreground">Portfolio Value is hidden for periods where one or more open holdings have no historical price. The lighter partial line shows only priced holdings; Current Deployed Capital remains complete.</p> : null}
    {comparison?.dividendTreatment === "embedded" ? <p className="text-xs text-muted-foreground">Portfolio Value excludes dividends. The benchmark total-return series includes reinvested benchmark dividends. Use Total Return / XIRR for the fair performance comparison.</p> : comparison?.dividendTreatment === "excluded" ? <p className="text-xs text-muted-foreground">Portfolio Value excludes dividends. This benchmark price series also excludes dividends; actual Total Return / XIRR includes recorded dividend cash flows.</p> : null}
    {comparison ? <BenchmarkMethodology comparison={comparison} /> : null}
  </div>;
}
