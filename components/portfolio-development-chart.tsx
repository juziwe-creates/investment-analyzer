"use client";

import { useState } from "react";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { formatCurrency } from "@/lib/formatters";
import type { PortfolioDevelopmentPoint } from "@/lib/analytics/portfolio";

export function PortfolioDevelopmentChart({ points, emptyMessage }: { points: PortfolioDevelopmentPoint[]; emptyMessage?: string }) {
  const [showDividends, setShowDividends] = useState(false);
  return <div className="space-y-3">
    <div className="flex justify-end"><label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDividends} onChange={(event) => setShowDividends(event.target.checked)} />Cumulative dividends</label></div>
    <TimeSeriesChart points={points} label="Portfolio performance" emptyMessage={emptyMessage} series={[
      { label: "Portfolio Value", color: "hsl(var(--chart-portfolio))", value: (point) => point.portfolioValue },
      { label: "Current Deployed Capital", color: "hsl(var(--chart-deployed))", value: (point) => point.investedCapital },
      ...(showDividends ? [{ label: "Cumulative Dividends", color: "hsl(var(--chart-dividend))", value: (point: PortfolioDevelopmentPoint) => point.dividendsReceived }] : [])
    ]} tooltip={(point) => [
      { label: "Portfolio value", value: formatCurrency(point.portfolioValue, point.currency) },
      { label: "Current deployed", value: formatCurrency(point.investedCapital, point.currency) },
      { label: "Unrealized", value: formatCurrency(point.investmentGain, point.currency) },
      ...(showDividends ? [{ label: "Dividends", value: formatCurrency(point.dividendsReceived, point.currency) }] : [])
    ]} />
    {points.some((point) => !point.hasCompletePricing) ? <p className="text-xs text-muted-foreground">Some dates exclude holdings without a historical price. Missing values are not treated as zero.</p> : null}
  </div>;
}
