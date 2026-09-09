"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { constrainRange, dateString, fullRange, presets, presetRange, rangeFromSearch, timestamp, zoomRange, type TimeRange } from "@/lib/charts/time-viewport";
import { cn } from "@/lib/utils";

type Viewport = { range: TimeRange; times: number[]; full: TimeRange; setRange: (range: TimeRange) => void; zoomAt: (factor: number, anchor?: number) => void; fitAll: () => void };
const Context = createContext<Viewport | null>(null);

export function TimeViewportProvider({ dates, children }: { dates: string[]; children: ReactNode }) {
  const search = useSearchParams();
  const pathname = usePathname();
  const times = useMemo(() => [...new Set(dates.map(timestamp).filter(Number.isFinite))].sort((a, b) => a - b), [dates]);
  const from = search.get("from"), to = search.get("to");
  const key = `${pathname}:${times[0]}:${times.at(-1)}:${times.length}:${from}:${to}`;
  const initial = rangeFromSearch(new URLSearchParams({ from: from ?? "", to: to ?? "" }), times);
  const [state, setState] = useState({ key, range: initial, dirty: false });
  const range = state.key === key ? state.range : initial;
  const setRange = (next: TimeRange) => setState({ key, range: constrainRange(next, times), dirty: true });

  useEffect(() => {
    if (!state.dirty || state.key !== key || !times.length) return;
    const timer = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("from", dateString(state.range.start));
      url.searchParams.set("to", dateString(state.range.end));
      url.searchParams.delete("interval");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }, 250);
    return () => clearTimeout(timer);
  }, [state, key, times.length]);

  return <Context.Provider value={{ range, times, full: fullRange(times), setRange, zoomAt: (factor, anchor = .5) => setRange(zoomRange(range, factor, anchor, times)), fitAll: () => setRange(fullRange(times)) }}>{children}</Context.Provider>;
}

export function useTimeViewport() {
  const value = useContext(Context);
  if (!value) throw new Error("Chart requires TimeViewportProvider");
  return value;
}

export function TimePresets() {
  const { range, times, setRange, full } = useTimeViewport();
  const isFull = range.start === full.start && range.end === full.end;
  const active = isFull ? "MAX" : presets.find((preset) => { const candidate = presetRange(preset, times); return candidate.start === range.start && candidate.end === range.end; });
  return <nav className="flex flex-wrap gap-1" aria-label="Chart time period">{presets.map((preset) => <button type="button" key={preset} disabled={times.length <= 5} aria-pressed={active === preset} onClick={() => setRange(presetRange(preset, times))} className={cn("alpha-focus rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-card disabled:opacity-50", active === preset && "bg-card text-foreground ring-1 ring-border")}>{preset}</button>)}</nav>;
}

export function ViewportFields() {
  const { range, times } = useTimeViewport();
  return times.length ? <><input type="hidden" name="from" value={dateString(range.start)} /><input type="hidden" name="to" value={dateString(range.end)} /></> : null;
}
