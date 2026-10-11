"use client";

import { useState } from "react";
import { BenchmarkMethodology } from "@/components/benchmark-comparison";
import { TimeSeriesChart, type ChartSeries } from "@/components/time-series-chart";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { PortfolioDevelopmentPoint } from "@/lib/analytics/portfolio";
import type { BenchmarkTimelinePoint, BenchmarkView } from "@/lib/analytics/benchmark-portfolio";

export type PortfolioBenchmarkSeries = { comparison: BenchmarkView; timeline: BenchmarkTimelinePoint[] };
const benchmarkColors = ["hsl(var(--chart-benchmark))", "hsl(var(--accent-brand))", "hsl(var(--chart-dividend))"];

export function PortfolioDevelopmentChart({ points, emptyMessage, benchmarks = [] }: {
  points: PortfolioDevelopmentPoint[];
  emptyMessage?: string;
  benchmarks?: PortfolioBenchmarkSeries[];
}) {
  const [mode, setMode] = useState<"value" | "economic" | "profit">("value");
  const [showDividends, setShowDividends] = useState(false);
  const hasIncompletePricing = points.some((point) => !point.hasCompletePricing);
  const economicValueReason = points.find((point) => point.economicValueReason)?.economicValueReason ?? null;
  const series: ChartSeries<PortfolioDevelopmentPoint>[] = [
    { label: mode === "profit" ? "Portfolio Profit Generated" : mode === "economic" ? "Portfolio Economic Value" : "Portfolio Value", color: "hsl(var(--chart-portfolio))", value: (point) => mode === "profit" ? point.profitGenerated : mode === "economic" ? point.economicValue : point.portfolioValue },
    ...(mode === "value" && hasIncompletePricing ? [{ label: "Priced Holdings Value (partial)", color: "hsl(var(--chart-portfolio) / .55)", value: (point: PortfolioDevelopmentPoint) => point.pricedPortfolioValue }] : []),
    ...benchmarks.map(({ comparison, timeline }, index) => ({
      label: mode === "profit" ? `${comparison.label} Profit Generated` : mode === "economic" ? `${comparison.label} Economic Counterfactual` : `${comparison.label} Counterfactual`,
      color: benchmarkColors[index % benchmarkColors.length], value: () => null, stepped: true,
      observations: timeline.map((point) => ({ date: point.date, value: mode === "profit" ? point.profitGenerated : mode === "economic" ? point.economicValue : point.value,
        tooltip: [{ label: mode === "profit" ? `${comparison.label} profit generated` : mode === "economic" ? `${comparison.label} economic value` : comparison.label, value: formatCurrency(mode === "profit" ? point.profitGenerated : mode === "economic" ? point.economicValue : point.value, "EUR") },
          ...(mode === "profit" ? [{ label: "Cumulative purchase costs", value: formatCurrency(point.cumulativePurchaseCosts, "EUR") }, { label: "Benchmark exit proceeds", value: formatCurrency(point.saleProceeds, "EUR") }] : []),
          ...(mode === "economic" ? [{ label: "Benchmark exit proceeds", value: formatCurrency(point.saleProceeds, "EUR") }] : []),
          { label: "Benchmark observation", value: point.observationDate ?? "Unavailable" }] }))
    })),
    ...(mode !== "profit" ? [{ label: "Current Deployed Capital", color: "hsl(var(--chart-deployed))", value: (point: PortfolioDevelopmentPoint) => point.investedCapital, stepped: true }] : []),
    ...(showDividends ? [{ label: "Cumulative Dividends", color: "hsl(var(--chart-dividend))", value: (point: PortfolioDevelopmentPoint) => point.dividendsReceived, stepped: true }] : [])
  ];

  return <div className="min-w-0 max-w-full space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex flex-wrap rounded-md border border-border bg-card p-1">{(["value", "economic", "profit"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={cn("alpha-focus rounded px-3 py-1.5 text-sm text-muted-foreground", mode === value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{value === "profit" ? "Profit generated" : value === "economic" ? "Economic Value" : "Value"}</button>)}</div><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDividends} onChange={(event) => setShowDividends(event.target.checked)} />Cumulative dividends</label></div>
    <TimeSeriesChart points={points} label={mode === "profit" ? "Portfolio profit generated" : mode === "economic" ? "Portfolio economic value" : "Portfolio performance"} emptyMessage={mode === "economic" && economicValueReason ? economicValueReason : emptyMessage} series={series} tooltip={(point) => mode === "profit" ? [
      { label: "Profit generated", value: formatCurrency(point.profitGenerated, point.currency) },
      { label: "Current holdings value", value: formatCurrency(point.portfolioValue, point.currency) },
      { label: "Cumulative purchase costs", value: formatCurrency(point.cumulativePurchaseCosts, point.currency) },
      { label: "Cumulative dividends", value: formatCurrency(point.dividendsReceived, point.currency) },
      { label: "Cumulative sale proceeds", value: formatCurrency(point.saleProceedsReceived, point.currency) }
    ] : mode === "economic" ? [
      { label: "Economic value", value: formatCurrency(point.economicValue, point.currency) },
      { label: "Current market value", value: formatCurrency(point.portfolioValue, point.currency) },
      { label: "Cumulative dividends", value: formatCurrency(point.dividendsReceived, point.currency) },
      { label: "Cumulative sale proceeds", value: formatCurrency(point.saleProceedsReceived, point.currency) },
      { label: "Current deployed", value: formatCurrency(point.investedCapital, point.currency) }
    ] : [
      { label: "Portfolio value", value: formatCurrency(point.portfolioValue, point.currency) },
      ...(!point.hasCompletePricing ? [{ label: "Priced holdings value (partial)", value: formatCurrency(point.pricedPortfolioValue, point.currency) }] : []),
      { label: "Current deployed", value: formatCurrency(point.investedCapital, point.currency) },
      { label: "Unrealized", value: formatCurrency(point.investmentGain, point.currency) },
      ...(showDividends ? [{ label: "Dividends", value: formatCurrency(point.dividendsReceived, point.currency) }] : [])
    ]} />
    {mode === "economic" && economicValueReason ? <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">{economicValueReason}</p> : null}
    {mode === "profit" ? <p className="text-xs text-muted-foreground">Profit generated = current holdings value + cumulative sale proceeds + recorded dividends - cumulative purchase costs. Benchmarks match your purchases and proportional exits; this is not a passive buy-and-hold comparison. Total-return index dividends are embedded, not added again.</p> : null}
    {mode === "profit" && hasIncompletePricing ? <p role="status" className="text-xs text-muted-foreground">Profit generated is unavailable where an open holding has no historical price. Missing values are not treated as zero.</p> : null}
    {mode === "profit" && benchmarks.some(({ timeline }) => timeline.some((point) => point.profitGenerated === null)) ? <p role="status" className="text-xs text-muted-foreground">Benchmark profit is unavailable where purchase, exit, or valuation history is incomplete, including missing entries for already sold lots.</p> : null}
    {benchmarks.some(({ timeline }) => timeline.some((point) => point.missingLots > 0)) ? <p className="text-xs text-muted-foreground">Some benchmark entry or exit history is missing. Incomplete portfolio benchmark totals are unavailable; covered purchase lots remain available in their comparison view.</p> : null}
    {mode === "value" && hasIncompletePricing ? <p className="text-xs text-muted-foreground">Portfolio Value is hidden for periods where one or more open holdings have no historical price. The lighter partial line shows only priced holdings; Current Deployed Capital remains complete.</p> : null}
    {mode === "value" && benchmarks.some(({ comparison }) => comparison.dividendTreatment === "embedded") ? <p className="text-xs text-muted-foreground">Portfolio Value excludes dividends. Selected total-return benchmark series include reinvested benchmark dividends. Use Economic Value for the fair total-return comparison.</p> : null}
    {mode === "economic" && !economicValueReason ? <p className="text-xs text-muted-foreground">Portfolio Economic Value combines current market value, cumulative sale proceeds, and cumulative recorded dividends only where the ledger shows no later purchase that could redeploy those proceeds.</p> : null}
    {benchmarks.map(({ comparison }) => <BenchmarkMethodology key={comparison.benchmarkId} comparison={comparison} />)}
  </div>;
}
