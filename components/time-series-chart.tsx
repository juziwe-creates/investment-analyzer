"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTimeViewport } from "@/components/time-viewport";
import { dateString, DAY, decimate, lowerBound, nearestIndex, timestamp, zoomRange, type TimeRange } from "@/lib/charts/time-viewport";
import { formatDate } from "@/lib/formatters";

export type ChartSeries<T> = { label: string; color: string; value: (point: T) => number; stepped?: boolean };
export type ChartMarker = { id: string; date: string; type: "buy" | "sell" | "dividend" };
type Point = { date: string; currency: string };
type Drag = { x: number; y: number; range: TimeRange; direction?: "horizontal" | "vertical"; mode: "pan" | "start" | "end"; navigator: boolean };
const colors = { buy: "hsl(var(--positive))", sell: "hsl(var(--negative))", dividend: "hsl(var(--chart-dividend))" };

export function TimeSeriesChart<T extends Point>({ points, series, label, tooltip, markers = [], onMarker, emptyMessage = "Historical data is unavailable." }: {
  points: T[]; series: ChartSeries<T>[]; label: string; tooltip: (point: T) => { label: string; value: string }[];
  markers?: ChartMarker[]; onMarker?: (marker: ChartMarker) => void; emptyMessage?: string;
}) {
  const viewport = useTimeViewport();
  const { range, full, times, setRange, zoomAt, fitAll } = viewport;
  const root = useRef<HTMLDivElement>(null);
  const plot = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(960);
  const [hover, setHover] = useState<{ index: number; start: number; end: number } | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<Drag | null>(null);
  const pinch = useRef<{ distance: number; middle: number; range: TimeRange } | null>(null);
  const suppressClick = useRef(false);
  const gestureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(viewport);
  const clipId = useId().replaceAll(":", "");
  const left = width < 500 ? 66 : 88, right = 18, top = 20, bottom = 42, height = 320;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const duration = range.end - range.start || DAY;
  const fullDuration = full.end - full.start || DAY;
  const enabled = times.length > 5 && points.length > 0;
  const zoomedIn = zoomRange(range, .7, .5, times);
  const atMinimum = zoomedIn.end - zoomedIn.start >= range.end - range.start;
  const atMaximum = range.start === full.start && range.end === full.end;
  const pointTimes = useMemo(() => points.map((point) => timestamp(point.date)), [points]);
  const x = (time: number) => left + (time - range.start) / duration * plotWidth;
  const navX = (time: number) => left + (time - full.start) / fullDuration * plotWidth;
  const currency = points.at(-1)?.currency ?? "EUR";

  useEffect(() => { latest.current = viewport; });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, entry.contentRect.width)));
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = plot.current;
    if (!svg || !enabled) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const anchor = ((event.clientX - rect.left) * width / rect.width - left) / plotWidth;
      setHover(null); setGesturing(true);
      latest.current.zoomAt(Math.exp(Math.max(-.5, Math.min(.5, event.deltaY * (event.deltaMode === 1 ? 16 : 1) * .003))), anchor);
      if (gestureTimer.current) clearTimeout(gestureTimer.current);
      gestureTimer.current = setTimeout(() => setGesturing(false), 180);
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => { svg.removeEventListener("wheel", wheel); if (gestureTimer.current) clearTimeout(gestureTimer.current); };
  }, [enabled, width, left, plotWidth]);

  // Boundary intersections affect drawing/axes only. Tooltips always use source observations.
  const visible = useMemo(() => {
    if (!points.length) return [];
    const first = lowerBound(pointTimes, range.start), after = lowerBound(pointTimes, range.end + 1);
    const rows: { time: number; values: number[] }[] = [];
    const boundary = (time: number, index: number) => {
      const before = points[index - 1], next = points[index];
      if (!before) return;
      if (!next && !series.every((item) => item.stepped)) return;
      rows.push({ time, values: series.map((item) => {
        const value = item.value(before);
        return item.stepped || !next ? value : value + (item.value(next) - value) * (time - pointTimes[index - 1]) / (pointTimes[index] - pointTimes[index - 1] || 1);
      }) });
    };
    if (pointTimes[first] !== range.start) boundary(range.start, first);
    for (let index = first; index < after; index++) rows.push({ time: pointTimes[index], values: series.map((item) => item.value(points[index])) });
    if (pointTimes[after - 1] !== range.end) boundary(range.end, after);
    return rows;
  }, [points, pointTimes, range.start, range.end, series]);
  const yValues = visible.flatMap((row) => row.values).filter(Number.isFinite);
  const rawMin = yValues.reduce((min, value) => Math.min(min, value), Infinity);
  const rawMax = yValues.reduce((max, value) => Math.max(max, value), -Infinity);
  const padding = yValues.length ? (rawMax - rawMin || Math.abs(rawMax) || 1) * .05 : 1;
  const min = yValues.length ? rawMin - padding : 0, max = yValues.length ? rawMax + padding : 1;
  const y = (value: number) => top + plotHeight - (value - min) / (max - min) * plotHeight;
  const narrowAxis = max - min < Math.max(Math.abs(max), 1) * .08;
  const axisLabel = (value: number) => {
    const divisor = narrowAxis ? 1 : Math.abs(value) >= 1_000_000 ? 1_000_000 : Math.abs(value) >= 1000 ? 1000 : 1;
    const digits = narrowAxis ? max - min < 10 ? 2 : max - min < 100 ? 1 : 0 : 1;
    // Explicit decimals avoid server/browser ICU differences in compact currency notation.
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value / divisor) + (divisor === 1_000_000 ? "M" : divisor === 1000 ? "K" : "");
  };
  const renderRows = decimate(visible, (row) => row.values, Math.max(400, width * 2));
  const overview = useMemo(() => decimate(points.map((point, index) => ({ time: pointTimes[index], value: series[0]?.value(point) ?? 0 })), (row) => [row.value], 500), [points, pointTimes, series]);
  const navMin = overview.reduce((value, row) => Math.min(value, row.value), Infinity);
  const navMax = overview.reduce((value, row) => Math.max(value, row.value), -Infinity);
  const navPath = overview.map((row, index) => `${index ? "L" : "M"} ${navX(row.time)} ${39 - (row.value - navMin) / (navMax - navMin || 1) * 30}`).join(" ");
  const hoverPoint = hover && hover.start === range.start && hover.end === range.end && !gesturing ? points[hover.index] : null;
  const ticks = Math.max(3, Math.min(8, Math.floor(plotWidth / 110) + 1));
  const tickFormat = new Intl.DateTimeFormat("en", { timeZone: "UTC", ...(duration < 120 * DAY ? { month: "short", day: "numeric" } as const : duration < 4 * 365 * DAY ? { month: "short", year: "numeric" } as const : { year: "numeric" } as const) });
  const tickTimes = range.start === range.end ? [range.start] : [...new Set(Array.from({ length: ticks }, (_, index) => Math.round((range.start + duration * index / (ticks - 1)) / DAY) * DAY))];
  const tickLabels = tickTimes.map((time) => tickFormat.format(time));
  const duplicateLabels = new Set(tickLabels).size !== tickLabels.length;

  function plotFraction(clientX: number, element: SVGSVGElement) {
    const rect = element.getBoundingClientRect();
    return ((clientX - rect.left) * width / rect.width - left) / plotWidth;
  }
  function begin(event: ReactPointerEvent<SVGSVGElement>, navigator = false) {
    if (!enabled || event.button !== 0) return;
    const target = event.target as Element;
    const mode = (target.getAttribute("data-handle") ?? "pan") as Drag["mode"];
    const fraction = plotFraction(event.clientX, event.currentTarget);
    if (mode === "pan" && (fraction < 0 || fraction > 1)) return;
    if (pointers.current.size === 0) suppressClick.current = false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && !navigator) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), middle: plotFraction((a.x + b.x) / 2, event.currentTarget), range };
      suppressClick.current = true; setGesturing(true); setHover(null);
    } else if (pointers.current.size === 1) {
      drag.current = { x: event.clientX, y: event.clientY, range, mode, navigator };
      if (navigator && mode === "pan") {
        const time = full.start + fraction * fullDuration;
        if (time < range.start || time > range.end) {
          const next = { start: time - duration / 2, end: time + duration / 2 };
          setRange(next); drag.current = null;
        }
      }
    }
    // Capture the initiating marker itself so a stationary click still opens its drawer.
    (event.target as Element).setPointerCapture(event.pointerId);
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) {
      if (event.pointerType !== "mouse" || !pointTimes.length) return;
      const fraction = plotFraction(event.clientX, event.currentTarget);
      const index = nearestIndex(pointTimes, range.start + fraction * duration);
      setHover(fraction >= 0 && fraction <= 1 && pointTimes[index] >= range.start && pointTimes[index] <= range.end ? { index, start: range.start, end: range.end } : null);
      return;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const [a, b] = [...pointers.current.values()];
      const initial = pinch.current;
      const span = (initial.range.end - initial.range.start) * initial.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const anchorTime = initial.range.start + initial.middle * (initial.range.end - initial.range.start);
      const start = anchorTime - plotFraction((a.x + b.x) / 2, event.currentTarget) * span;
      setRange({ start, end: start + span });
      return;
    }
    const initial = drag.current;
    if (!initial) return;
    const dx = event.clientX - initial.x, dy = event.clientY - initial.y;
    if (!initial.direction && Math.max(Math.abs(dx), Math.abs(dy)) >= 5) initial.direction = event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx) ? "vertical" : "horizontal";
    if (initial.direction !== "horizontal") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClick.current = true; setGesturing(true); setHover(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const delta = dx / (rect.width * plotWidth / width) * (initial.navigator ? fullDuration : initial.range.end - initial.range.start);
    if (initial.mode === "start") setRange({ start: Math.min(initial.range.end - DAY, initial.range.start + delta), end: initial.range.end });
    else if (initial.mode === "end") setRange({ start: initial.range.start, end: Math.max(initial.range.start + DAY, initial.range.end + delta) });
    else { const shift = initial.navigator ? delta : -delta; setRange({ start: initial.range.start + shift, end: initial.range.end + shift }); }
  }
  function end(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    const remaining = [...pointers.current.values()][0];
    if (remaining && drag.current) drag.current = { ...drag.current, x: remaining.x, y: remaining.y, range };
    else { drag.current = null; setGesturing(false); }
  }

  return <div ref={root} className="min-w-0 space-y-3" data-time-chart={label}>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs tabular-nums text-muted-foreground" aria-live="off">{times.length ? `${formatDate(dateString(range.start))} – ${formatDate(dateString(range.end))}` : "No history"}</p><div className="flex gap-1">{[
      { label: "Zoom out", icon: Minus, action: () => zoomAt(1 / .7), disabled: atMaximum },
      { label: "Zoom in", icon: Plus, action: () => zoomAt(.7), disabled: atMinimum },
      { label: "Reset to full history", icon: RotateCcw, action: fitAll, disabled: atMaximum }
    ].map(({ label: controlLabel, icon: Icon, action, disabled }) => <button type="button" key={controlLabel} aria-label={controlLabel} title={controlLabel} disabled={!enabled || disabled} onClick={() => { setHover(null); action(); }} className="alpha-focus flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"><Icon size={16} /></button>)}</div></div>
    {!points.length ? <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">{emptyMessage}</div> : <>
      <div className="relative">
        <svg ref={plot} role="group" aria-label={`${label}. Use plus, minus, arrow keys, or Home to navigate time.`} tabIndex={0} viewBox={`0 0 ${width} ${height}`} className="alpha-focus block w-full rounded-sm" style={{ touchAction: "pan-y", cursor: gesturing ? "grabbing" : enabled ? "grab" : "crosshair" }}
          onPointerDown={(event) => begin(event)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={() => setHover(null)}
          onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || !enabled) return;
            if (["+", "=", "-", "ArrowLeft", "ArrowRight", "Home"].includes(event.key)) { event.preventDefault(); setHover(null); }
            if (event.key === "+" || event.key === "=") zoomAt(.7);
            if (event.key === "-") zoomAt(1 / .7);
            if (event.key === "Home") fitAll();
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") { const shift = duration * (event.key === "ArrowLeft" ? -.1 : .1); setRange({ start: range.start + shift, end: range.end + shift }); }
          }}>
          <defs><clipPath id={clipId}><rect x={left} y={top} width={plotWidth} height={plotHeight} /></clipPath></defs>
          {[0, .25, .5, .75, 1].map((fraction) => { const value = min + (max - min) * fraction; return <g key={fraction}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="hsl(var(--border-subtle))" strokeDasharray="3 6" /><text x={left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">{axisLabel(value)}</text></g>; })}
          <g clipPath={`url(#${clipId})`}>
            {series.map((item, column) => <path key={item.label} d={renderRows.map((row, index) => `${index ? item.stepped ? `H ${x(row.time)} V` : "L" : "M"} ${index && item.stepped ? "" : x(row.time)} ${y(row.values[column])}`).join(" ")} fill="none" stroke={item.color} strokeWidth={column === 0 ? 2.25 : 1.75} />)}
            {visible.length === 1 ? series.map((item, column) => <circle key={item.label} cx={x(visible[0].time)} cy={y(visible[0].values[column])} r={3} fill={item.color} />) : null}
            {markers.filter((marker) => timestamp(marker.date) >= range.start && timestamp(marker.date) <= range.end).map((marker) => {
              const index = nearestIndex(pointTimes, timestamp(marker.date));
              if (index < 0) return null;
              const mx = x(timestamp(marker.date)), my = Math.max(top + 7, Math.min(height - bottom - 7, y(series[0].value(points[index]))));
              return <g key={marker.id} role="button" tabIndex={0} aria-label={`${marker.type} on ${formatDate(marker.date)}`} className="alpha-focus cursor-pointer" onClick={() => onMarker?.(marker)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onMarker?.(marker); } }}><circle cx={mx} cy={my} r={8} fill="hsl(var(--card))" stroke={colors[marker.type]} strokeWidth={2} /><text x={mx} y={my + 3} textAnchor="middle" fontSize={8} fill={colors[marker.type]}>{marker.type === "buy" ? "▲" : marker.type === "sell" ? "▼" : "◆"}</text></g>;
            })}
            {hoverPoint ? <line x1={x(timestamp(hoverPoint.date))} x2={x(timestamp(hoverPoint.date))} y1={top} y2={height - bottom} stroke="hsl(var(--foreground)/.35)" strokeDasharray="4 4" pointerEvents="none" /> : null}
          </g>
          {!visible.length ? <text x={left + plotWidth / 2} y={height / 2} textAnchor="middle" className="fill-muted-foreground text-xs">No observations in this period</text> : null}
          {tickTimes.map((time, index) => <text key={time} x={x(time)} y={height - 12} textAnchor={index === 0 ? "start" : index === tickTimes.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">{duplicateLabels ? new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "short", year: "2-digit" }).format(time) : tickLabels[index]}</text>)}
        </svg>
        {hoverPoint ? <div role="status" className="pointer-events-none absolute top-3 z-10 max-w-[calc(100%-16px)] rounded-md border border-border bg-card p-3 text-xs shadow-sm" style={{ left: Math.max(8, Math.min(width - Math.min(260, width - 16) - 8, x(timestamp(hoverPoint.date)) + 12)), width: Math.min(260, width - 16) }}><p className="mb-2 font-semibold">{formatDate(hoverPoint.date)}</p><dl className="space-y-1">{tooltip(hoverPoint).map((row) => <div key={row.label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{row.label}</dt><dd className="text-right tabular-nums">{row.value}</dd></div>)}</dl></div> : null}
      </div>
      {enabled ? <svg role="group" aria-label={`${label} overview navigator`} viewBox={`0 0 ${width} 48`} className="hidden h-12 w-full sm:block" style={{ touchAction: "none" }} onPointerDown={(event) => begin(event, true)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        <rect x={left} width={plotWidth} height={48} fill="hsl(var(--muted)/.5)" rx={4} /><path d={navPath} fill="none" stroke="hsl(var(--chart-portfolio)/.6)" strokeWidth={1} />
        <rect x={navX(range.start)} width={Math.max(1, navX(range.end) - navX(range.start))} y={1} height={46} fill="hsl(var(--chart-portfolio)/.08)" stroke="hsl(var(--chart-portfolio)/.65)" rx={3} className="cursor-grab" />
        {(["start", "end"] as const).map((edge) => <g key={edge} role="slider" tabIndex={0} aria-label={`${label} overview ${edge} date`} aria-valuemin={full.start / DAY} aria-valuemax={full.end / DAY} aria-valuenow={range[edge] / DAY} aria-valuetext={dateString(range[edge])} onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            const next = range[edge] + (event.key === "ArrowLeft" ? -1 : 1) * Math.max(DAY, duration * .1);
            setRange({ ...range, [edge]: edge === "start" ? Math.min(range.end - DAY, next) : Math.max(range.start + DAY, next) });
          }
        }}><rect data-handle={edge} x={navX(range[edge]) - (edge === "start" ? 14 : 0)} width={14} height={48} fill="transparent" className="cursor-ew-resize" /><rect pointerEvents="none" x={navX(range[edge]) - 2} y={10} width={4} height={28} rx={2} fill="hsl(var(--chart-portfolio))" /></g>)}
      </svg> : null}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">{series.map((item) => <span key={item.label}><i className="mr-2 inline-block h-0.5 w-5 align-middle" style={{ background: item.color }} />{item.label}</span>)}</div>
    </>}
  </div>;
}
