"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadUniverseHistory } from "@/app/(app)/analytics/actions";
import { advancePlayback, dateTime, dividendBatches, snapshotIndex, snapshotModel, type DividendBatch, type UniverseHistory } from "@/lib/analytics-3d/history";
import type { UniverseModel } from "@/lib/analytics-3d/model";

export type DividendPulse = { id: number; batches: DividendBatch[] };

export function usePlayback(current: UniverseModel, portfolio?: string, initialHistory?: UniverseHistory) {
  const [history, setHistory] = useState<UniverseHistory | null>(initialHistory ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [events, setEventsEnabled] = useState(true);
  const [pulse, setPulse] = useState<DividendPulse | null>(null);
  const cursorRef = useRef<number | null>(null);
  const emittedTime = useRef<number | null>(null);
  const sequence = useRef(0);
  const request = useRef(false);
  const mounted = useRef(true);
  const start = history?.snapshots.length ? dateTime(history.snapshots[0].date) : 0;
  const end = history?.snapshots.length ? dateTime(history.snapshots.at(-1)!.date) : 0;
  const index = history && cursor !== null ? snapshotIndex(history.snapshots, cursor) : -1;
  const model = useMemo(() => history && index >= 0 ? snapshotModel(current, history, index) : current, [current, history, index]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!playing || !history) return;
    let frame = 0, previous = 0, lastPaint = 0;
    function tick(now: number) {
      if (document.hidden) { previous = 0; frame = requestAnimationFrame(tick); return; }
      const from = Math.max(start, cursorRef.current ?? start);
      const next = advancePlayback(from, previous ? now - previous : 0, start, end, speed);
      cursorRef.current = next;
      previous = now;
      // Financial UI updates at most 12.5 times/s; Three interpolates independently.
      if (now - lastPaint >= 80 || next >= end) {
        setCursor(next);
        const batches = events ? dividendBatches(history!.dividends, emittedTime.current ?? start - 1, next) : [];
        if (batches.length) setPulse({ id: ++sequence.current, batches });
        emittedTime.current = next;
        lastPaint = now;
      }
      if (next >= end) { setPlaying(false); return; }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, history, start, end, speed, events]);
  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(() => setPulse(null), 1800);
    return () => clearTimeout(timer);
  }, [pulse]);

  async function load() {
    if (request.current) return;
    request.current = true;
    setLoading(true); setError(null);
    try {
      const result = await loadUniverseHistory(portfolio, current.presentation ?? false);
      if (mounted.current) { setHistory(result.history); setError(result.error); }
    } catch {
      if (mounted.current) setError("Portfolio history could not be loaded. Try again.");
    } finally {
      request.current = false;
      if (mounted.current) setLoading(false);
    }
  }
  function seek(time: number | null) {
    const next = time === null ? null : Math.max(start, Math.min(end, time));
    setPlaying(false); setPulse(null); cursorRef.current = next; emittedTime.current = next; setCursor(next);
  }
  function toggle() {
    if (playing) { cursorRef.current = cursor; setPlaying(false); return; }
    if (cursorRef.current === null || cursorRef.current >= end) {
      cursorRef.current = start; emittedTime.current = start - 1; setCursor(start);
    }
    setPlaying(true);
  }
  function setEvents(enabled: boolean) {
    setEventsEnabled(enabled);
    setPulse(null);
    emittedTime.current = cursorRef.current;
  }
  return { history, loading, error, load, model, cursor, start, end, playing, toggle, seek, speed, setSpeed,
    events, setEvents, pulse: events ? pulse : null };
}
