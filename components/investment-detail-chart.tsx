"use client";

import { useCallback, useState } from "react";
import { DecisionDrawer, type DecisionDrawerMetric } from "@/components/decision-drawer";
import { TimeSeriesChart, type ChartObservation, type ChartSeries } from "@/components/time-series-chart";
import { TimePresets } from "@/components/time-viewport";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { cumulativeDividendHistory, type PersonalDividendEvent } from "@/lib/analytics/dividends";
import type { InvestmentChartPoint } from "@/lib/analytics/investment-history";
import type { BenchmarkView, BenchmarkTimelinePoint } from "@/lib/analytics/benchmark-portfolio";
import { BenchmarkMethodology } from "@/components/benchmark-comparison";

export type InvestmentMarker = { id: string; date: string; type: "buy" | "sell" | "dividend"; label: string; subtitle: string; metrics: DecisionDrawerMetric[]; note?: string };

export function InvestmentDetailChart({ points, markers, dividends = [], comparison, benchmarkTimeline = [] }: { points: InvestmentChartPoint[]; markers: InvestmentMarker[]; dividends?: PersonalDividendEvent[]; comparison?: BenchmarkView; benchmarkTimeline?: BenchmarkTimelinePoint[] }) {
  const [mode, setMode] = useState<"price" | "position">("price");
  const [showDividends, setShowDividends] = useState(false);
  const [selected, setSelected] = useState<InvestmentMarker | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const openDividend = (observation: ChartObservation) => setSelected(markers.find((item) => item.id === observation.id) ?? null);
  const dividendCurrency = dividends[0]?.currency ?? "EUR";
  const compactCash = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: dividendCurrency, notation: "compact", maximumFractionDigits: 1 }).format(value);
  const eventTooltip = (event: PersonalDividendEvent) => [
    { label: "Dividend / share", value: formatCurrency(event.perShare, event.currency) },
    { label: "Shares held", value: formatNumber(event.eligibleShares) },
    { label: "Dividend cash (gross if known)", value: formatCurrency(event.cash, event.currency) },
    { label: `${event.date.slice(0, 4)} dividends YTD`, value: formatCurrency(event.yearToDateCash, event.currency) },
    { label: "Active acquisition cost", value: formatCurrency(event.activeCost, event.currency) },
    { label: "Personal dividend yield", value: formatPercent(event.yieldPercent) },
    ...(event.gross !== null ? [{ label: "Gross dividend", value: formatCurrency(event.gross, event.currency) }] : []),
    ...(event.net !== null ? [{ label: "Net received", value: formatCurrency(event.net, event.currency) }] : [])
  ];
  const series: ChartSeries<InvestmentChartPoint>[] = [
    { label: mode === "price" ? "Price" : "Position value", color: "hsl(var(--chart-portfolio))", value: (point) => mode === "price" ? point.price : point.positionValue },
    ...(mode === "position" && comparison ? [{ label: `${comparison.label} Counterfactual Position`, color: "hsl(var(--chart-benchmark))", value: () => null, stepped: true,
      observations: benchmarkTimeline.map((point) => ({ date: point.date, value: point.value, tooltip: [
        { label: comparison.label, value: point.value === null ? "Unavailable" : formatCurrency(point.value, "EUR") },
        { label: "Benchmark observation", value: point.observationDate ?? "Unavailable" }
      ] })) }] : []),
    ...(mode === "position" ? [{ label: "Current deployed capital", color: "hsl(var(--chart-deployed))", value: (point: InvestmentChartPoint) => point.deployedCapital, stepped: true }] : [])
  ];
  if (showDividends) {
    if (mode === "price") series.push(
      { label: "Dividend / share (right 1)", color: "hsl(var(--chart-dividend))", axis: "right", render: "bar", value: () => null,
        maxPlotHeightRatio: 0.5, format: (value) => formatCurrency(value, dividendCurrency), axisFormat: compactCash, onObservationClick: openDividend,
        observations: dividends.map((event) => ({ id: event.id, date: event.date, value: event.perShare, tooltip: eventTooltip(event) })) },
      { label: "Personal dividend yield (right 2)", color: "hsl(var(--accent-brand))", axis: "right2", render: "bar", value: () => null,
        maxPlotHeightRatio: 0.95, format: formatPercent, onObservationClick: openDividend,
        observations: dividends.map((event) => ({ id: event.id, date: event.date, value: event.yieldPercent, tooltip: [] })) }
    );
    else series.push({ label: "Cumulative dividends (right axis)", color: "hsl(var(--chart-dividend))", axis: "right", value: () => null, stepped: true,
      maxPlotHeightRatio: 0.5, format: (value) => formatCurrency(value, dividendCurrency), axisFormat: compactCash, observations: cumulativeDividendHistory(dividends, points[0]?.date) });
  }

  return <section className="space-y-4" aria-labelledby="investment-history-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="investment-history-heading" className="alpha-section-title">Investment history</h2><TimePresets /></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-md border border-border bg-card p-1">{(["price", "position"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={cn("alpha-focus rounded px-3 py-1.5 text-sm text-muted-foreground", mode === value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{value === "position" ? "Position Value" : "Price"}</button>)}</div><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDividends} onChange={(event) => setShowDividends(event.target.checked)} />Dividends</label></div>
    <div className="alpha-surface p-2 sm:p-4"><TimeSeriesChart points={points} label={mode === "price" ? "Security price" : "Position value"} emptyMessage="Historical prices are required for the investment timeline." series={series}
      markers={markers.filter((marker) => marker.type !== "dividend")} onMarker={(marker) => setSelected(markers.find((item) => item.id === marker.id) ?? null)} tooltip={(point) => [
        { label: "Price", value: formatCurrency(point.price, point.currency) },
        { label: "Your shares", value: formatNumber(point.shares) },
        { label: "Position value", value: formatCurrency(point.positionValue, point.currency) },
        { label: "Deployed", value: formatCurrency(point.deployedCapital, point.currency) },
        { label: "Unrealized", value: formatPercent(point.unrealizedReturnPercent) }
      ]} /></div>
    {showDividends && dividends.some((event) => mode === "price" ? event.perShare === null || event.yieldPercent === null : event.cumulative === null) ? <p className="text-xs text-muted-foreground">Some dividend values are unavailable: cash or eligible-share history is missing, or currencies differ.</p> : null}
    {mode === "position" && comparison ? <BenchmarkMethodology comparison={comparison} /> : null}
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span>▲ Buy</span><span>▼ Sell</span></div>
    <DecisionDrawer modal={false} open={selected !== null} onClose={close} eyebrow={selected?.type.toUpperCase() ?? "Decision"} title={selected?.label ?? "Decision"} subtitle={selected?.subtitle} metrics={selected?.metrics ?? []} note={selected?.note} />
  </section>;
}
