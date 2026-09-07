"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { DecisionDrawer, type DecisionDrawerMetric } from "@/components/decision-drawer";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export type InvestmentChartPoint = { date: string; price: number; shares: number; positionValue: number; deployedCapital: number; unrealizedReturnPercent: number | null; currency: string };
export type InvestmentMarker = { id: string; date: string; type: "buy" | "sell" | "dividend"; label: string; subtitle: string; metrics: DecisionDrawerMetric[]; note?: string };

const width = 960;
const height = 360;
const pad = { top: 28, right: 28, bottom: 42, left: 76 };

function timestamp(date: string) { return new Date(`${date}T00:00:00Z`).getTime(); }

export function InvestmentDetailChart({ points, markers }: { points: InvestmentChartPoint[]; markers: InvestmentMarker[] }) {
  const [mode, setMode] = useState<"price" | "position">("price");
  const [showDividends, setShowDividends] = useState(false);
  const [hover, setHover] = useState<InvestmentChartPoint | null>(null);
  const [selected, setSelected] = useState<InvestmentMarker | null>(null);
  const visibleMarkers = useMemo(() => markers.filter((marker) => marker.type !== "dividend" || showDividends), [markers, showDividends]);

  if (points.length === 0) return <div className="alpha-surface flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">Historical prices are required for the investment timeline.</div>;
  const firstTime = timestamp(points[0].date);
  const lastTime = timestamp(points.at(-1)!.date);
  const timeRange = lastTime - firstTime || 1;
  const values = points.map((point) => mode === "price" ? point.price : point.positionValue);
  if (mode === "position") values.push(...points.map((point) => point.deployedCapital));
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (date: string) => pad.left + ((timestamp(date) - firstTime) / timeRange) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (height - pad.top - pad.bottom) - ((value - min) / range) * (height - pad.top - pad.bottom);
  const valueOf = (point: InvestmentChartPoint) => mode === "price" ? point.price : point.positionValue;
  const path = points.map((point, index) => `${index ? "L" : "M"} ${x(point.date)} ${y(valueOf(point))}`).join(" ");
  const deployedPath = points.map((point, index) => `${index ? "L" : "M"} ${x(point.date)} ${y(point.deployedCapital)}`).join(" ");
  const currency = points.at(-1)!.currency;

  function nearest(svgX: number) { return points.reduce((best, point) => Math.abs(x(point.date) - svgX) < Math.abs(x(best.date) - svgX) ? point : best, points[0]); }
  function onMove(event: MouseEvent<SVGSVGElement>) { const rect = event.currentTarget.getBoundingClientRect(); setHover(nearest(((event.clientX - rect.left) / rect.width) * width)); }
  function openWithKeyboard(event: KeyboardEvent<SVGGElement>, marker: InvestmentMarker) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(marker); } }

  return <section className="space-y-4" aria-labelledby="investment-history-heading"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="investment-history-heading" className="alpha-section-title">Investment history</h2><p className="mt-1 text-sm text-muted-foreground">Inspect price, ownership, and decisions at any historical point.</p></div><div className="flex flex-wrap gap-2"><div className="inline-flex rounded-md border border-border bg-card p-1">{(["price", "position"] as const).map((value) => <button key={value} type="button" onClick={() => setMode(value)} className={cn("alpha-focus rounded px-3 py-1.5 text-sm capitalize text-muted-foreground", mode === value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{value === "position" ? "Position Value" : "Price"}</button>)}</div><button type="button" aria-pressed={showDividends} onClick={() => setShowDividends((value) => !value)} className={cn("alpha-focus rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground", showDividends && "bg-[hsl(var(--accent-subtle))] text-foreground")}>Dividends</button></div></div>
    <div className="alpha-surface overflow-hidden p-2 sm:p-4"><svg role="img" aria-label={`${mode === "price" ? "Security price" : "Position value"} timeline with transaction markers`} viewBox={`0 0 ${width} ${height}`} className="h-auto w-full cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {[0, .5, 1].map((tick) => <g key={tick}><line x1={pad.left} y1={y(min + range * tick)} x2={width - pad.right} y2={y(min + range * tick)} stroke="hsl(var(--border-subtle))" strokeDasharray="3 6" /><text x={pad.left - 10} y={y(min + range * tick)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-xs">{formatCurrency(min + range * tick, currency)}</text></g>)}
      {mode === "position" ? <path d={deployedPath} fill="none" stroke="hsl(var(--chart-deployed))" strokeWidth="1.5" strokeDasharray="5 5" /> : null}<path d={path} fill="none" stroke="hsl(var(--chart-portfolio))" strokeWidth="2" />
      {visibleMarkers.map((marker) => { const point = nearest(x(marker.date)); const markerY = y(valueOf(point)); const color = marker.type === "buy" ? "hsl(var(--positive))" : marker.type === "sell" ? "hsl(var(--negative))" : "hsl(var(--chart-dividend))"; return <g key={marker.id} role="button" tabIndex={0} aria-label={`${marker.type} on ${formatDate(marker.date)}`} onClick={() => setSelected(marker)} onKeyDown={(event) => openWithKeyboard(event, marker)} className="cursor-pointer"><circle cx={x(marker.date)} cy={markerY} r="7" fill="hsl(var(--card))" stroke={color} strokeWidth="2" /><text x={x(marker.date)} y={markerY + 3} textAnchor="middle" className="text-[8px] font-bold" fill={color}>{marker.type === "buy" ? "▲" : marker.type === "sell" ? "▼" : "◆"}</text></g>; })}
      {hover ? <g pointerEvents="none"><line x1={x(hover.date)} y1={pad.top} x2={x(hover.date)} y2={height - pad.bottom} stroke="hsl(var(--foreground)/.3)" strokeDasharray="4 4" /><g transform={`translate(${Math.min(x(hover.date) + 10, width - 244)} ${pad.top + 8})`}><rect width="230" height="132" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border-subtle))" /><text x="12" y="22" className="fill-foreground text-xs font-semibold">{formatDate(hover.date)}</text><text x="12" y="44" className="fill-muted-foreground text-xs">Price: {formatCurrency(hover.price, hover.currency)}</text><text x="12" y="64" className="fill-muted-foreground text-xs">Your shares: {formatNumber(hover.shares)}</text><text x="12" y="84" className="fill-muted-foreground text-xs">Position value: {formatCurrency(hover.positionValue, hover.currency)}</text><text x="12" y="104" className="fill-muted-foreground text-xs">Deployed: {formatCurrency(hover.deployedCapital, hover.currency)}</text><text x="12" y="124" className="fill-muted-foreground text-xs">Unrealized: {formatPercent(hover.unrealizedReturnPercent)}</text></g></g> : null}
      <text x={pad.left} y={height - 12} className="fill-muted-foreground text-xs">{formatDate(points[0].date)}</text><text x={width - pad.right} y={height - 12} textAnchor="end" className="fill-muted-foreground text-xs">{formatDate(points.at(-1)!.date)}</text>
    </svg></div><div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span>▲ Buy</span><span>▼ Sell</span>{showDividends ? <span>◆ Dividend</span> : null}{mode === "position" ? <span>Dashed: deployed capital</span> : null}</div>
    <DecisionDrawer open={selected !== null} onClose={() => setSelected(null)} eyebrow={selected?.type.toUpperCase() ?? "Decision"} title={selected?.label ?? "Decision"} subtitle={selected?.subtitle} metrics={selected?.metrics ?? []} note={selected?.note} />
  </section>;
}
