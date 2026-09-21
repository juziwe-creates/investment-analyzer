"use client";

import { useCallback, useState } from "react";
import { BenchmarkMethodology } from "@/components/benchmark-comparison";
import { DecisionDrawer, type DecisionDrawerMetric } from "@/components/decision-drawer";
import { TimeSeriesChart, type ChartSeries } from "@/components/time-series-chart";
import { TimePresets } from "@/components/time-viewport";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { PersonalDividendEvent } from "@/lib/analytics/dividends";
import type { InvestmentChartPoint } from "@/lib/analytics/investment-history";
import type { BenchmarkTimelinePoint, BenchmarkView } from "@/lib/analytics/benchmark-portfolio";

export type InvestmentMarker = { id: string; date: string; type: "buy" | "sell" | "dividend"; label: string; subtitle: string; metrics: DecisionDrawerMetric[]; note?: string };
export type InvestmentBenchmarkSeries = { comparison: BenchmarkView; timeline: BenchmarkTimelinePoint[] };

const benchmarkColors = ["hsl(var(--chart-benchmark))", "hsl(var(--accent-brand))", "hsl(var(--chart-dividend))"];

export function InvestmentDetailChart({ points, markers, dividends = [], benchmarks = [] }: {
  points: InvestmentChartPoint[];
  markers: InvestmentMarker[];
  dividends?: PersonalDividendEvent[];
  benchmarks?: InvestmentBenchmarkSeries[];
}) {
  const [mode, setMode] = useState<"value" | "economic">("value");
  const [showDividends, setShowDividends] = useState(false);
  const [selected, setSelected] = useState<InvestmentMarker | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const dividendCurrency = dividends[0]?.currency ?? "EUR";
  const compactCash = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: dividendCurrency, notation: "compact", maximumFractionDigits: 1 }).format(value);
  const series: ChartSeries<InvestmentChartPoint>[] = [
    { label: mode === "economic" ? "Investment Economic Value" : "Position Value", color: "hsl(var(--chart-portfolio))", value: (point) => mode === "economic" ? point.economicValue : point.positionValue },
    ...benchmarks.map(({ comparison, timeline }, index) => ({
      label: mode === "economic" ? `${comparison.label} Economic Counterfactual` : `${comparison.label} Counterfactual`,
      color: benchmarkColors[index % benchmarkColors.length], value: () => null, stepped: true,
      observations: timeline.map((point) => ({ date: point.date, value: mode === "economic" ? point.economicValue : point.value, tooltip: [
        { label: mode === "economic" ? `${comparison.label} economic value` : comparison.label, value: formatCurrency(mode === "economic" ? point.economicValue : point.value, "EUR") },
        ...(mode === "economic" ? [{ label: "Benchmark exit proceeds", value: formatCurrency(point.saleProceeds, "EUR") }] : []),
        { label: "Benchmark observation", value: point.observationDate ?? "Unavailable" }
      ] }))
    })),
    { label: "Current Deployed Capital", color: "hsl(var(--chart-deployed))", value: (point) => point.deployedCapital, stepped: true },
    ...(showDividends ? [{ label: "Cumulative Dividends", color: "hsl(var(--chart-dividend))", axis: "right" as const, value: (point: InvestmentChartPoint) => point.dividendsReceived, stepped: true, maxPlotHeightRatio: 0.5, format: (value: number) => formatCurrency(value, dividendCurrency), axisFormat: compactCash }] : [])
  ];

  return <section className="space-y-4" aria-labelledby="investment-history-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="investment-history-heading" className="alpha-section-title">Investment history</h2><TimePresets /></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-md border border-border bg-card p-1">{(["value", "economic"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={cn("alpha-focus rounded px-3 py-1.5 text-sm text-muted-foreground", mode === value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{value === "economic" ? "Economic Value" : "Value"}</button>)}</div><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDividends} onChange={(event) => setShowDividends(event.target.checked)} />Cumulative dividends</label></div>
    <div className="alpha-surface p-2 sm:p-4"><TimeSeriesChart points={points} label={mode === "economic" ? "Investment economic value" : "Position value"} emptyMessage="Historical prices are required for the investment timeline." series={series}
      markers={markers.filter((marker) => marker.type !== "dividend")} onMarker={(marker) => setSelected(markers.find((item) => item.id === marker.id) ?? null)} tooltip={(point) => mode === "economic" ? [
        { label: "Economic value", value: formatCurrency(point.economicValue, point.currency) },
        { label: "Current market value", value: formatCurrency(point.positionValue, point.currency) },
        { label: "Cumulative dividends", value: formatCurrency(point.dividendsReceived, point.currency) },
        { label: "Cumulative sale proceeds", value: formatCurrency(point.saleProceedsReceived, point.currency) },
        { label: "Current deployed", value: formatCurrency(point.deployedCapital, point.currency) }
      ] : [
        { label: "Price", value: formatCurrency(point.price, point.currency) },
        { label: "Your shares", value: formatNumber(point.shares) },
        { label: "Position value", value: formatCurrency(point.positionValue, point.currency) },
        { label: "Current deployed", value: formatCurrency(point.deployedCapital, point.currency) },
        { label: "Unrealized", value: formatPercent(point.unrealizedReturnPercent) }
      ]} /></div>
    {mode === "value" && benchmarks.some(({ comparison }) => comparison.dividendTreatment === "embedded") ? <p className="text-xs text-muted-foreground">Position Value excludes dividends. Selected total-return benchmark series include reinvested benchmark dividends. Use Economic Value for the fair total-return comparison.</p> : null}
    {mode === "economic" ? <p className="text-xs text-muted-foreground">Economic Value combines current market value, cumulative attributed sale proceeds, and cumulative recorded dividends. It is an analytical performance measure, not Position Value.</p> : null}
    {benchmarks.map(({ comparison }) => <BenchmarkMethodology key={comparison.benchmarkId} comparison={comparison} />)}
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span>▲ Buy</span><span>▼ Sell</span></div>
    <DecisionDrawer modal={false} open={selected !== null} onClose={close} eyebrow={selected?.type.toUpperCase() ?? "Decision"} title={selected?.label ?? "Decision"} subtitle={selected?.subtitle} metrics={selected?.metrics ?? []} note={selected?.note} />
  </section>;
}
