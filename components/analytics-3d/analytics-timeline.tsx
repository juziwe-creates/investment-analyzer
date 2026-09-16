"use client";

import { Pause, Play } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { usePlayback } from "./use-playback";
import styles from "./analytics.module.css";

export function AnalyticsTimeline({ playback }: { playback: ReturnType<typeof usePlayback> }) {
  const p = playback;
  if (!p.history) return <div className={styles.timeline}>
    <button onClick={p.load} disabled={p.loading}>{p.loading ? "Loading history..." : "Load history"}</button>
    {p.error ? <p role="alert">{p.error}</p> : null}
  </div>;
  if (!p.history.snapshots.length) return <div className={styles.timeline}><p>No recorded history in this account.</p></div>;
  const batches = p.pulse?.batches ?? [];
  const amount = batches.some((batch) => batch.amount === null) ? null : batches.reduce((sum, batch) => sum + (batch.amount ?? 0), 0);
  return <div className={styles.timeline} aria-label="Portfolio history controls">
    <div className={styles.timelineControls}>
      <button title={p.playing ? "Pause history" : "Play history"} aria-label={p.playing ? "Pause history" : "Play history"} onClick={p.toggle} disabled={p.start === p.end}>{p.playing ? <Pause size={18} /> : <Play size={18} />}</button>
      <output className={styles.timelineDate}>{p.cursor === null ? "Today" : formatDate(p.model.asOfDate)}</output>
      <input aria-label="Portfolio history date" aria-valuetext={p.cursor === null ? "Today" : formatDate(p.model.asOfDate)} type="range" min={p.start} max={p.end} step={86400000} value={p.cursor ?? p.end} onChange={(event) => p.seek(Number(event.target.value))} />
      <label className={styles.speed}>Speed<select aria-label="Playback speed" value={p.speed} onChange={(event) => p.setSpeed(Number(event.target.value))}><option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option></select></label>
      <button onClick={() => p.seek(null)} aria-pressed={p.cursor === null}>Today</button>
      <label className={styles.events}><input type="checkbox" checked={p.events} onChange={(event) => p.setEvents(event.target.checked)} />Dividends</label>
    </div>
    <div className={styles.timelineCaption}><span>{formatDate(p.history.snapshots[0].date)} to {formatDate(p.history.snapshots.at(-1)!.date)}</span><span>Monthly price snapshots + exact transaction dates</span></div>
    <p className={styles.dividendNotice} aria-live={p.playing ? "off" : "polite"}>{batches.length ? `${formatCurrency(amount)} recorded dividends · ${batches.reduce((sum, batch) => sum + batch.count, 0)} payments` : "\u00a0"}</p>
  </div>;
}
