"use client";

import { useMemo, useState } from "react";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { useTimeViewport } from "@/components/time-viewport";
import { benchmarkOptions, normalizeBenchmarkComparison, type BenchmarkId, type BenchmarkObservation } from "@/lib/analytics/benchmarks";
import { formatCurrency } from "@/lib/formatters";
import type { PortfolioDevelopmentPoint } from "@/lib/analytics/portfolio";

export function PortfolioDevelopmentChart({ points, emptyMessage, benchmark = "msci-world", benchmarkHistory = [], benchmarkError = null }: {
  points: PortfolioDevelopmentPoint[]; emptyMessage?: string; benchmark?: BenchmarkId;
  benchmarkHistory?: BenchmarkObservation[]; benchmarkError?: string | null;
}) {
  const [showDividends, setShowDividends] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(true);
  const { range } = useTimeViewport();
  const comparison = useMemo(() => normalizeBenchmarkComparison(points, benchmarkHistory, range), [points, benchmarkHistory, range]);
  const benchmarkLabel = benchmarkOptions.find((option) => option.id === benchmark)!.label;
  const indexFormat = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return <div className="space-y-3">
    <div className="flex flex-wrap justify-end gap-4">
      <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={comparisonMode} onChange={(event) => setComparisonMode(event.target.checked)} />Compare benchmark (base 100)</label>
      {!comparisonMode ? <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDividends} onChange={(event) => setShowDividends(event.target.checked)} />Cumulative dividends</label> : null}
    </div>
    {comparisonMode ? <>
      <TimeSeriesChart points={points} label="Portfolio performance" emptyMessage={emptyMessage} series={[
        { label: "Portfolio value (normalized)", color: "hsl(var(--chart-portfolio))", value: (point) => point.portfolioValue, axisFormat: indexFormat, format: indexFormat,
          observations: comparison.map((point) => ({ date: point.date, value: point.portfolio })) },
        { label: benchmarkLabel, color: "hsl(var(--chart-benchmark))", value: () => null, axisFormat: indexFormat, format: indexFormat, stepped: true, extendLast: false,
          observations: comparison.map((point) => ({ date: point.date, value: point.benchmark })) }
      ]} tooltip={() => []} />
      {benchmarkError ? <p role="alert" className="text-sm text-muted-foreground">{benchmarkError}</p>
        : !benchmarkHistory.length ? <p role="status" className="text-sm text-muted-foreground">{benchmarkLabel} history is unavailable.</p>
        : !comparison.length ? <p role="status" className="text-sm text-muted-foreground">No comparable observations in this period. A positive, fully priced opening portfolio value and overlapping EUR benchmark history are required.</p>
        : <p className="text-xs text-muted-foreground">Base 100 on {comparison[0].date}. Both series use the first benchmark observation on or after the visible start with overlapping portfolio history. Weekly levels are carried forward only within the overlap; no history is extrapolated beyond the final observation.</p>}
      <p className="text-xs text-muted-foreground">Normalized value, not cash-flow-adjusted return: purchases and sales change portfolio value. Portfolio value excludes paid dividends; the stored benchmarks include reinvested dividends. MSCI World is a derived EUR net-total-return series; DAX is a EUR performance index. This comparison is not an alpha metric.</p>
    </> : <TimeSeriesChart points={points} label="Portfolio performance" emptyMessage={emptyMessage} series={[
      { label: "Portfolio Value", color: "hsl(var(--chart-portfolio))", value: (point) => point.portfolioValue },
      { label: "Current Deployed Capital", color: "hsl(var(--chart-deployed))", value: (point) => point.investedCapital, stepped: true },
      ...(showDividends ? [{ label: "Cumulative Dividends", color: "hsl(var(--chart-dividend))", value: (point: PortfolioDevelopmentPoint) => point.dividendsReceived, stepped: true }] : [])
    ]} tooltip={(point) => [
      { label: "Portfolio value", value: formatCurrency(point.portfolioValue, point.currency) },
      { label: "Current deployed", value: formatCurrency(point.investedCapital, point.currency) },
      { label: "Unrealized", value: formatCurrency(point.investmentGain, point.currency) },
      ...(showDividends ? [{ label: "Dividends", value: formatCurrency(point.dividendsReceived, point.currency) }] : [])
    ]} />}
    {points.some((point) => !point.hasCompletePricing) ? <p className="text-xs text-muted-foreground">Some market values exclude holdings without a historical price. Deployed capital includes their recorded acquisition cost, so the gap is not a complete gain/loss figure.</p> : null}
  </div>;
}
