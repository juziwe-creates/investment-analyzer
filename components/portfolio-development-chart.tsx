"use client";

import { useState, type MouseEvent } from "react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ChartInterval, PortfolioDevelopmentPoint } from "@/lib/analytics/portfolio";

const width = 960;
const height = 360;
const pad = { top: 24, right: 28, bottom: 44, left: 78 };
const time = (date: string) => new Date(`${date}T00:00:00Z`).getTime();

export function PortfolioDevelopmentChart({ points, interval, emptyMessage = "Sync historical prices to see portfolio development." }: { points: PortfolioDevelopmentPoint[]; interval: ChartInterval; emptyMessage?: string }) {
  const [hover, setHover] = useState<PortfolioDevelopmentPoint | null>(null);
  const [showDividends, setShowDividends] = useState(false);
  if (points.length === 0) return <div className="flex h-72 items-center justify-center rounded-md border border-dashed px-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
  const firstTime = time(points[0].date);
  const lastTime = time(points.at(-1)!.date);
  const timeRange = lastTime - firstTime || 1;
  const values = points.flatMap((point) => [0, point.portfolioValue, point.investedCapital, showDividends ? point.dividendsReceived : 0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (point: PortfolioDevelopmentPoint) => pad.left + ((time(point.date) - firstTime) / timeRange) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (height - pad.top - pad.bottom) - ((value - min) / range) * (height - pad.top - pad.bottom);
  const line = (value: (point: PortfolioDevelopmentPoint) => number) => points.map((point, index) => `${index ? "L" : "M"} ${x(point)} ${y(value(point))}`).join(" ");
  const currency = points.at(-1)!.currency;
  const nearest = (svgX: number) => points.reduce((best, point) => Math.abs(x(point) - svgX) < Math.abs(x(best) - svgX) ? point : best, points[0]);
  function move(event: MouseEvent<SVGSVGElement>) { const bounds = event.currentTarget.getBoundingClientRect(); setHover(nearest(((event.clientX - bounds.left) / bounds.width) * width)); }

  return <div className="space-y-4">
    <div className="flex justify-end"><button type="button" aria-pressed={showDividends} onClick={() => setShowDividends((value) => !value)} className={cn("alpha-focus rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground", showDividends && "bg-[hsl(var(--accent-subtle))] text-foreground")}>Cumulative dividends</button></div>
    <svg role="img" aria-label={`Portfolio value and deployed capital, ${interval} observations`} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full cursor-crosshair" onMouseMove={move} onMouseLeave={() => setHover(null)}>
      {[0, .5, 1].map((tick) => <g key={tick}><line x1={pad.left} y1={y(min + range * tick)} x2={width - pad.right} y2={y(min + range * tick)} stroke="hsl(var(--border-subtle))" strokeDasharray="3 6" /><text x={pad.left - 10} y={y(min + range * tick)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-xs">{formatCurrency(min + range * tick, currency)}</text></g>)}
      <path d={line((point) => point.investedCapital)} fill="none" stroke="hsl(var(--chart-deployed))" strokeWidth="1.75" />
      <path d={line((point) => point.portfolioValue)} fill="none" stroke="hsl(var(--chart-portfolio))" strokeWidth="2.25" />
      {showDividends ? <path d={line((point) => point.dividendsReceived)} fill="none" stroke="hsl(var(--chart-dividend))" strokeWidth="1.75" /> : null}
      {hover ? <g pointerEvents="none"><line x1={x(hover)} y1={pad.top} x2={x(hover)} y2={height - pad.bottom} stroke="hsl(var(--foreground)/.35)" strokeDasharray="4 4" /><g transform={`translate(${Math.min(x(hover) + 10, width - 246)} ${pad.top + 8})`}><rect width="232" height={showDividends ? 112 : 92} rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border-subtle))" /><text x="12" y="22" className="fill-foreground text-xs font-semibold">{formatDate(hover.date)}</text><text x="12" y="44" className="fill-muted-foreground text-xs">Portfolio value: {formatCurrency(hover.portfolioValue, currency)}</text><text x="12" y="64" className="fill-muted-foreground text-xs">Current deployed: {formatCurrency(hover.investedCapital, currency)}</text><text x="12" y="84" className="fill-muted-foreground text-xs">Unrealized: {formatCurrency(hover.investmentGain, currency)}</text>{showDividends ? <text x="12" y="104" className="fill-muted-foreground text-xs">Dividends: {formatCurrency(hover.dividendsReceived, currency)}</text> : null}</g></g> : null}
      <text x={pad.left} y={height - 12} className="fill-muted-foreground text-xs">{formatDate(points[0].date)}</text><text x={width - pad.right} y={height - 12} textAnchor="end" className="fill-muted-foreground text-xs">{formatDate(points.at(-1)!.date)}</text>
    </svg>
    <div className="flex flex-wrap gap-5 text-xs text-muted-foreground"><span><i className="mr-2 inline-block h-0.5 w-5 bg-[hsl(var(--chart-portfolio))] align-middle" />Portfolio Value</span><span><i className="mr-2 inline-block h-0.5 w-5 bg-[hsl(var(--chart-deployed))] align-middle" />Current Deployed Capital</span>{showDividends ? <span><i className="mr-2 inline-block h-0.5 w-5 bg-[hsl(var(--chart-dividend))] align-middle" />Cumulative Dividends</span> : null}</div>
    {points.some((point) => !point.hasCompletePricing) ? <p className="text-xs text-muted-foreground">Some dates exclude holdings without a historical price. Missing values are not treated as zero.</p> : null}
  </div>;
}
