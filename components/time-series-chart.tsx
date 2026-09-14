"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTimeViewport } from "@/components/time-viewport";
import { dateString, DAY, decimate, lowerBound, nearestIndex, timestamp, zoomRange, type TimeRange } from "@/lib/charts/time-viewport";
import { formatDate } from "@/lib/formatters";
import { selectionRange, seriesExtent, visibleSamples } from "@/lib/charts/series";
import { AlphaProgress } from "@/components/alpha-progress";

export type ChartObservation = { date: string; value: number | null; tooltip?: { label: string; value: string }[] };
export type ChartSeries<T> = { label: string; color: string; value: (point: T) => number | null; stepped?: boolean; axis?: "left" | "right"; format?: (value: number) => string; render?: "line" | "bar" | "lollipop"; observations?: ChartObservation[] };
export type ChartMarker = { id: string; date: string; type: "buy" | "sell" | "dividend" };
type Point = { date: string; currency: string };
type Drag = { x: number; y: number; range: TimeRange; direction?: "horizontal" | "vertical"; mode: "pan" | "start" | "end"; navigator: boolean };
const colors = { buy: "hsl(var(--positive))", sell: "hsl(var(--negative))", dividend: "hsl(var(--chart-dividend))" };

export function TimeSeriesChart<T extends Point>({ points, series, label, tooltip, markers = [], onMarker, selection, emptyMessage = "Historical data is unavailable." }: {
  points: T[]; series: ChartSeries<T>[]; label: string; tooltip: (point: T) => { label: string; value: string }[];
  markers?: ChartMarker[]; onMarker?: (marker: ChartMarker) => void; emptyMessage?: string;
  selection?: { active: boolean; range: TimeRange | null; onChange: (range: TimeRange | null) => void };
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
  const selecting = useRef<{ anchor: number; previous: TimeRange | null; edge?: "start" | "end"; x: number; y: number; vertical: boolean } | null>(null);
  const pinch = useRef<{ distance: number; middle: number; range: TimeRange } | null>(null);
  const suppressClick = useRef(false);
  const gestureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(viewport);
  const clipId = useId().replaceAll(":", "");
  const hasRight = series.some((item) => item.axis === "right");
  const left = width < 500 ? 66 : 88, right = hasRight ? (width < 500 ? 70 : 88) : 18, top = 20, bottom = 42, height = 320;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const duration = range.end - range.start || DAY;
  const fullDuration = full.end - full.start || DAY;
  const enabled = times.length > 5 && points.length > 0;
  const zoomedIn = zoomRange(range, .7, .5, times);
  const atMinimum = zoomedIn.end - zoomedIn.start >= range.end - range.start;
  const atMaximum = range.start === full.start && range.end === full.end;
  const pointTimes = useMemo(() => points.map((point) => timestamp(point.date)), [points]);
  const hoverTimes = useMemo(() => [...new Set([...pointTimes, ...series.flatMap((item) => item.observations?.map((row) => timestamp(row.date)) ?? [])])].sort((a, b) => a - b), [pointTimes, series]);
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

  // Each axis uses only its visible samples. Event series never interpolate.
  const visible = useMemo(() => series.map((item) => visibleSamples(
    item.observations ? item.observations.map((row) => ({ time: timestamp(row.date), value: row.value })) : points.map((point, index) => ({ time: pointTimes[index], value: item.value(point) })),
    range, item.stepped, item.render === "bar" || item.render === "lollipop"
  )), [series, points, pointTimes, range]);
  const { min, max } = seriesExtent(visible.filter((_, index) => series[index].axis !== "right"));
  const rightExtent = seriesExtent(visible.filter((_, index) => series[index].axis === "right"), series.some((item) => item.axis === "right" && (item.render === "bar" || item.render === "lollipop")));
  const y = (value: number) => top + plotHeight - (value - min) / (max - min) * plotHeight;
  const rightY = (value: number) => top + plotHeight - (value - rightExtent.min) / (rightExtent.max - rightExtent.min) * plotHeight;
  const narrowAxis = max - min < Math.max(Math.abs(max), 1) * .08;
  const axisLabel = (value: number) => {
    const divisor = narrowAxis ? 1 : Math.abs(value) >= 1_000_000 ? 1_000_000 : Math.abs(value) >= 1000 ? 1000 : 1;
    const digits = narrowAxis ? max - min < 10 ? 2 : max - min < 100 ? 1 : 0 : 1;
    // Explicit decimals avoid server/browser ICU differences in compact currency notation.
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: digits }).format(value / divisor) + (divisor === 1_000_000 ? "M" : divisor === 1000 ? "K" : "");
  };
  const overview = useMemo(() => decimate(points.map((point, index) => ({ time: pointTimes[index], value: series[0]?.value(point) ?? 0 })), (row) => [row.value], 500), [points, pointTimes, series]);
  const navMin = overview.reduce((value, row) => Math.min(value, row.value), Infinity);
  const navMax = overview.reduce((value, row) => Math.max(value, row.value), -Infinity);
  const navPath = overview.map((row, index) => `${index ? "L" : "M"} ${navX(row.time)} ${39 - (row.value - navMin) / (navMax - navMin || 1) * 30}`).join(" ");
  const hoverTime = hover && hover.start === range.start && hover.end === range.end && !gesturing ? hoverTimes[hover.index] : undefined;
  const hoverPoint = hoverTime === undefined ? null : points[lowerBound(pointTimes, hoverTime)];
  const hoverRows = hoverTime === undefined ? [] : [
    ...(hoverPoint && timestamp(hoverPoint.date) === hoverTime ? tooltip(hoverPoint) : []),
    ...series.flatMap((item) => {
      const exact = item.observations?.filter((row) => timestamp(row.date) === hoverTime) ?? [];
      if (exact.length) return exact.flatMap((row) => row.tooltip ?? [{ label: item.label, value: row.value === null ? "Unavailable" : (item.format ?? axisLabel)(row.value) }]);
      if (!item.stepped || !item.observations) return [];
      const index = lowerBound(item.observations.map((row) => timestamp(row.date)), hoverTime + 1) - 1;
      const value = item.observations[index]?.value;
      return value === undefined ? [] : [{ label: item.label, value: value === null ? "Unavailable" : (item.format ?? axisLabel)(value) }];
    })
  ];
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
    if (!navigator && selection?.active && event.button === 0 && points.length) {
      const fraction = plotFraction(event.clientX, event.currentTarget);
      if (fraction < 0 || fraction > 1) return;
      const edge = (event.target as Element).getAttribute("data-selection-edge") as "start" | "end" | null;
      selecting.current = { anchor: range.start + fraction * duration, previous: selection.range, edge: edge ?? undefined, x: event.clientX, y: event.clientY, vertical: false };
      suppressClick.current = true;
      (event.target as Element).setPointerCapture(event.pointerId);
      return;
    }
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
    const activeSelection = selecting.current;
    if (activeSelection && selection) {
      const dx = event.clientX - activeSelection.x, dy = event.clientY - activeSelection.y;
      if (event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) >= 5) activeSelection.vertical = true;
      if (activeSelection.vertical || Math.max(Math.abs(dx), Math.abs(dy)) < 5) return;
      setGesturing(true); setHover(null);
      const time = range.start + plotFraction(event.clientX, event.currentTarget) * duration;
      const anchor = activeSelection.edge && activeSelection.previous ? activeSelection.previous[activeSelection.edge === "start" ? "end" : "start"] : activeSelection.anchor;
      selection.onChange(selectionRange(anchor, time, full));
      return;
    }
    if (!pointers.current.has(event.pointerId)) {
      if (event.pointerType !== "mouse" || !pointTimes.length) return;
      const fraction = plotFraction(event.clientX, event.currentTarget);
      const index = nearestIndex(hoverTimes, range.start + fraction * duration);
      setHover(fraction >= 0 && fraction <= 1 && hoverTimes[index] >= range.start && hoverTimes[index] <= range.end ? { index, start: range.start, end: range.end } : null);
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
    if (selecting.current) {
      if (event.type === "pointercancel") selection?.onChange(selecting.current.previous);
      selecting.current = null; setGesturing(false);
      return;
    }
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    const remaining = [...pointers.current.values()][0];
    if (remaining && drag.current) drag.current = { ...drag.current, x: remaining.x, y: remaining.y, range };
    else { drag.current = null; setGesturing(false); }
  }

  if (points.length && !times.length) return <div ref={root} className="flex h-[440px] items-center justify-center rounded-md bg-muted/40"><AlphaProgress status="Preparing chart" /></div>;

  return <div ref={root} className="min-w-0 space-y-3" data-time-chart={label}>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs tabular-nums text-muted-foreground" aria-live="off">{times.length ? `${formatDate(dateString(range.start))} – ${formatDate(dateString(range.end))}` : "No history"}</p><div className="flex gap-1">{[
      { label: "Zoom out", icon: Minus, action: () => zoomAt(1 / .7), disabled: atMaximum },
      { label: "Zoom in", icon: Plus, action: () => zoomAt(.7), disabled: atMinimum },
      { label: "Reset to full history", icon: RotateCcw, action: fitAll, disabled: atMaximum }
    ].map(({ label: controlLabel, icon: Icon, action, disabled }) => <button type="button" key={controlLabel} aria-label={controlLabel} title={controlLabel} disabled={!enabled || disabled} onClick={() => { setHover(null); action(); }} className="alpha-focus flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"><Icon size={16} /></button>)}</div></div>
    {!points.length ? <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-muted-foreground">{emptyMessage}</div> : <>
      <div className="relative">
        <svg ref={plot} role="group" aria-label={`${label}. Use plus, minus, arrow keys, or Home to navigate time.`} tabIndex={0} viewBox={`0 0 ${width} ${height}`} className="alpha-focus block w-full rounded-sm" style={{ touchAction: "pan-y", cursor: selection?.active ? "crosshair" : gesturing ? "grabbing" : enabled ? "grab" : "crosshair" }}
          onPointerDown={(event) => begin(event)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={() => setHover(null)}
          onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && selecting.current) { selection?.onChange(selecting.current.previous); selecting.current = null; setGesturing(false); return; }
            if (event.target !== event.currentTarget || !enabled) return;
            if (["+", "=", "-", "ArrowLeft", "ArrowRight", "Home"].includes(event.key)) { event.preventDefault(); setHover(null); }
            if (event.key === "+" || event.key === "=") zoomAt(.7);
            if (event.key === "-") zoomAt(1 / .7);
            if (event.key === "Home") fitAll();
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") { const shift = duration * (event.key === "ArrowLeft" ? -.1 : .1); setRange({ start: range.start + shift, end: range.end + shift }); }
          }}>
          <defs><clipPath id={clipId}><rect x={left} y={top} width={plotWidth} height={plotHeight} /></clipPath></defs>
          {[0, .25, .5, .75, 1].map((fraction) => { const value = min + (max - min) * fraction; return <g key={fraction}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="hsl(var(--border-subtle))" strokeDasharray="3 6" /><text x={left - 8} y={y(value)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">{axisLabel(value)}</text></g>; })}
          {hasRight ? [0, .25, .5, .75, 1].map((fraction) => { const value = rightExtent.min + (rightExtent.max - rightExtent.min) * fraction; return <text key={fraction} x={width - right + 8} y={rightY(value)} dominantBaseline="middle" className="fill-muted-foreground text-[11px]">{(series.find((item) => item.axis === "right")?.format ?? axisLabel)(value)}</text>; }) : null}
          <g clipPath={`url(#${clipId})`}>
            {series.map((item, column) => {
              const scale = item.axis === "right" ? rightY : y;
              const rows = visible[column];
              if (item.render === "bar" || item.render === "lollipop") return <g key={item.label} data-series={item.label}>{rows.map((row, index) => row.value === null ? null : <g key={`${row.time}-${index}`} onPointerMove={(event) => {
                if (selecting.current || pointers.current.size || gesturing) return;
                event.stopPropagation();
                setHover({ index: lowerBound(hoverTimes, row.time), start: range.start, end: range.end });
              }}><line x1={x(row.time)} x2={x(row.time)} y1={scale(0)} y2={scale(row.value)} stroke={item.color} strokeWidth={item.render === "bar" ? 6 : 1.5} /><circle cx={x(row.time)} cy={scale(row.value)} r={10} fill="transparent" />{item.render === "lollipop" ? <circle cx={x(row.time)} cy={scale(row.value)} r={3.5} fill={item.color} /> : null}</g>)}</g>;
              let connected = false;
              const sampled = rows.some((row) => row.value === null) ? rows : decimate(rows, (row) => [row.value!], Math.max(400, width * 2));
              const path = sampled.map((row) => {
                if (row.value === null) { connected = false; return ""; }
                const command = connected ? item.stepped ? `H ${x(row.time)} V ${scale(row.value)}` : `L ${x(row.time)} ${scale(row.value)}` : `M ${x(row.time)} ${scale(row.value)}`;
                connected = true; return command;
              }).join(" ");
              return <g key={item.label} data-series={item.label}><path d={path} fill="none" stroke={item.color} strokeWidth={column === 0 ? 2.25 : 1.75} />{rows.length === 1 && rows[0].value !== null ? <circle cx={x(rows[0].time)} cy={scale(rows[0].value)} r={3} fill={item.color} /> : null}</g>;
            })}
            {selection?.range && selection.range.end >= range.start && selection.range.start <= range.end ? <g data-selection-overlay="true"><rect x={x(Math.max(range.start, selection.range.start))} y={top} width={Math.max(1, x(Math.min(range.end, selection.range.end)) - x(Math.max(range.start, selection.range.start)))} height={plotHeight} fill="hsl(var(--accent-brand)/.10)" pointerEvents="none" />{(["start", "end"] as const).map((edge) => selection.range![edge] >= range.start && selection.range![edge] <= range.end ? <g key={edge}><line x1={x(selection.range![edge])} x2={x(selection.range![edge])} y1={top} y2={height - bottom} stroke="hsl(var(--accent-brand))" strokeDasharray="4 3" />{selection.active ? <rect data-selection-edge={edge} x={x(selection.range![edge]) - 18} y={top} width={36} height={plotHeight} fill="transparent" className="cursor-ew-resize" /> : null}</g> : null)}</g> : null}
            {markers.filter((marker) => timestamp(marker.date) >= range.start && timestamp(marker.date) <= range.end).map((marker) => {
              const index = nearestIndex(pointTimes, timestamp(marker.date));
              if (index < 0) return null;
              const mx = x(timestamp(marker.date)), my = Math.max(top + 7, Math.min(height - bottom - 7, y(series[0].value(points[index]) ?? min)));
              return <g key={marker.id} role="button" tabIndex={0} aria-label={`${marker.type} on ${formatDate(marker.date)}`} className="alpha-focus cursor-pointer" onClick={() => onMarker?.(marker)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onMarker?.(marker); } }}><circle cx={mx} cy={my} r={8} fill="hsl(var(--card))" stroke={colors[marker.type]} strokeWidth={2} /><text x={mx} y={my + 3} textAnchor="middle" fontSize={8} fill={colors[marker.type]}>{marker.type === "buy" ? "▲" : marker.type === "sell" ? "▼" : "◆"}</text></g>;
            })}
            {hoverTime !== undefined ? <line x1={x(hoverTime)} x2={x(hoverTime)} y1={top} y2={height - bottom} stroke="hsl(var(--foreground)/.35)" strokeDasharray="4 4" pointerEvents="none" /> : null}
          </g>
          {!visible.some((rows) => rows.length) ? <text x={left + plotWidth / 2} y={height / 2} textAnchor="middle" className="fill-muted-foreground text-xs">No observations in this period</text> : null}
          {tickTimes.map((time, index) => <text key={time} x={x(time)} y={height - 12} textAnchor={index === 0 ? "start" : index === tickTimes.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">{duplicateLabels ? new Intl.DateTimeFormat("en", { timeZone: "UTC", month: "short", year: "2-digit" }).format(time) : tickLabels[index]}</text>)}
        </svg>
        {hoverTime !== undefined && hoverRows.length ? <div role="status" className="pointer-events-none absolute top-3 z-10 max-w-[calc(100%-16px)] rounded-md border border-border bg-card p-3 text-xs shadow-sm" style={{ left: Math.max(8, Math.min(width - Math.min(260, width - 16) - 8, x(hoverTime) + 12)), width: Math.min(260, width - 16) }}><p className="mb-2 font-semibold">{formatDate(dateString(hoverTime))}</p><dl className="space-y-1">{hoverRows.map((row, index) => <div key={`${row.label}-${index}`} className="flex justify-between gap-3"><dt className="text-muted-foreground">{row.label}</dt><dd className="text-right tabular-nums">{row.value}</dd></div>)}</dl></div> : null}
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
