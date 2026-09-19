"use client";

import { useState } from "react";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { BenchmarkMethodology } from "@/components/benchmark-comparison";
import { formatCurrency } from "@/lib/formatters";
import type { PortfolioDevelopmentPoint } from "@/lib/analytics/portfolio";
import type { BenchmarkTimelinePoint, BenchmarkView } from "@/lib/analytics/benchmark-portfolio";

export function PortfolioDevelopmentChart({ points, emptyMessage, comparison, benchmarkTimeline = [] }: {
  points: PortfolioDevelopmentPoint[]; emptyMessage?: string;
  comparison?: BenchmarkView; benchmarkTimeline?: BenchmarkTimelinePoint[];
}) {
  const [showDividends, setShowDividends] = useState(false);
  return <div className="space-y-3">
    <div className="flex justify-end"><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDividends} onChange={(event) => setShowDividends(event.target.checked)} />Cumulative dividends</label></div>
    <TimeSeriesChart points={points} label="Portfolio performance" emptyMessage={emptyMessage} series={[
      { label: "Portfolio Value", color: "hsl(var(--chart-portfolio))", value: (point) => point.portfolioValue },
      ...(comparison ? [{ label: `${comparison.label} Benchmark Portfolio`, color: "hsl(var(--chart-benchmark))", value: () => null, stepped: true,
        observations: benchmarkTimeline.map((point) => ({ date: point.date, value: point.value,
          tooltip: [{ label: comparison.label, value: point.value === null ? "Unavailable" : formatCurrency(point.value, "EUR") },
            { label: "Benchmark observation", value: point.observationDate ?? "Unavailable" }] })) }] : []),
      { label: "Current Deployed Capital", color: "hsl(var(--chart-deployed))", value: (point) => point.investedCapital, stepped: true },
      ...(showDividends ? [{ label: "Cumulative Dividends", color: "hsl(var(--chart-dividend))", value: (point: PortfolioDevelopmentPoint) => point.dividendsReceived, stepped: true }] : [])
    ]} tooltip={(point) => [
      { label: "Portfolio value", value: formatCurrency(point.portfolioValue, point.currency) },
      { label: "Current deployed", value: formatCurrency(point.investedCapital, point.currency) },
      { label: "Unrealized", value: formatCurrency(point.investmentGain, point.currency) },
      ...(showDividends ? [{ label: "Dividends", value: formatCurrency(point.dividendsReceived, point.currency) }] : [])
    ]} />
    {benchmarkTimeline.some((point) => point.missingLots > 0) ? <p className="text-xs text-muted-foreground">Some benchmark entry history is missing. Incomplete portfolio benchmark totals are unavailable; covered purchase lots remain available in their comparison view.</p> : null}
    {points.some((point) => !point.hasCompletePricing) ? <p className="text-xs text-muted-foreground">Some market values exclude holdings without a historical price. Deployed capital includes their recorded acquisition cost, so the gap is not a complete gain/loss figure.</p> : null}
    {comparison ? <BenchmarkMethodology comparison={comparison} /> : null}
  </div>;
}
