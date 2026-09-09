"use client";

import { useCallback, useState } from "react";
import { DecisionDrawer, type DecisionDrawerMetric } from "@/components/decision-drawer";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { TimePresets, TimeViewportProvider } from "@/components/time-viewport";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export type InvestmentChartPoint = { date: string; price: number; shares: number; positionValue: number; deployedCapital: number; unrealizedReturnPercent: number | null; currency: string };
export type InvestmentMarker = { id: string; date: string; type: "buy" | "sell" | "dividend"; label: string; subtitle: string; metrics: DecisionDrawerMetric[]; note?: string };

export function InvestmentDetailChart({ points, markers }: { points: InvestmentChartPoint[]; markers: InvestmentMarker[] }) {
  const [mode, setMode] = useState<"price" | "position">("price");
  const [showDividends, setShowDividends] = useState(false);
  const [selected, setSelected] = useState<InvestmentMarker | null>(null);
  const close = useCallback(() => setSelected(null), []);
  return <TimeViewportProvider dates={points.map((point) => point.date)}><section className="space-y-4" aria-labelledby="investment-history-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="investment-history-heading" className="alpha-section-title">Investment history</h2><TimePresets /></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-md border border-border bg-card p-1">{(["price", "position"] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={cn("alpha-focus rounded px-3 py-1.5 text-sm text-muted-foreground", mode === value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{value === "position" ? "Position Value" : "Price"}</button>)}</div><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDividends} onChange={(event) => setShowDividends(event.target.checked)} />Dividends</label></div>
    <div className="alpha-surface p-2 sm:p-4"><TimeSeriesChart points={points} label={mode === "price" ? "Security price" : "Position value"} emptyMessage="Historical prices are required for the investment timeline." series={[
      { label: mode === "price" ? "Price" : "Position value", color: "hsl(var(--chart-portfolio))", value: (point) => mode === "price" ? point.price : point.positionValue },
      ...(mode === "position" ? [{ label: "Current deployed capital", color: "hsl(var(--chart-deployed))", value: (point: InvestmentChartPoint) => point.deployedCapital }] : [])
    ]} markers={markers.filter((marker) => marker.type !== "dividend" || showDividends)} onMarker={(marker) => setSelected(markers.find((item) => item.id === marker.id) ?? null)} tooltip={(point) => [
      { label: "Price", value: formatCurrency(point.price, point.currency) },
      { label: "Your shares", value: formatNumber(point.shares) },
      { label: "Position value", value: formatCurrency(point.positionValue, point.currency) },
      { label: "Deployed", value: formatCurrency(point.deployedCapital, point.currency) },
      { label: "Unrealized", value: formatPercent(point.unrealizedReturnPercent) }
    ]} /></div>
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span>▲ Buy</span><span>▼ Sell</span>{showDividends ? <span>◆ Dividend</span> : null}</div>
    <DecisionDrawer modal={false} open={selected !== null} onClose={close} eyebrow={selected?.type.toUpperCase() ?? "Decision"} title={selected?.label ?? "Decision"} subtitle={selected?.subtitle} metrics={selected?.metrics ?? []} note={selected?.note} />
  </section></TimeViewportProvider>;
}
