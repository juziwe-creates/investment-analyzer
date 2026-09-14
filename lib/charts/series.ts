import { DAY, lowerBound, type TimeRange } from "./time-viewport";

export type SeriesSample = { time: number; value: number | null };
export function visibleSamples(samples: SeriesSample[], range: TimeRange, stepped = false, discrete = false): SeriesSample[] {
  const times = samples.map((row) => row.time);
  const first = lowerBound(times, range.start), after = lowerBound(times, range.end + 1);
  const result = samples.slice(first, after);
  if (discrete) return result;
  function boundary(time: number, index: number) {
    const before = samples[index - 1], next = samples[index];
    if (!before || before.value === null) return null;
    if (stepped) return { time, value: before.value };
    if (!next || next.value === null) return null;
    return { time, value: before.value + (next.value - before.value) * (time - before.time) / (next.time - before.time || 1) };
  }
  if (times[first] !== range.start) { const row = boundary(range.start, first); if (row) result.unshift(row); }
  if (times[after - 1] !== range.end) { const row = boundary(range.end, after); if (row) result.push(row); }
  return result;
}

export function seriesExtent(rows: SeriesSample[][], includeZero = false) {
  let min = Infinity, max = -Infinity;
  for (const samples of rows) for (const row of samples) if (row.value !== null && Number.isFinite(row.value)) { min = Math.min(min, row.value); max = Math.max(max, row.value); }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
  const padding = (max - min || Math.abs(max) || 1) * .05;
  return { min: min - padding, max: max + padding };
}

export function selectionRange(start: number, end: number, full: TimeRange): TimeRange {
  const clamp = (time: number) => Math.max(full.start, Math.min(full.end, Math.round(time / DAY) * DAY));
  return { start: clamp(Math.min(start, end)), end: clamp(Math.max(start, end)) };
}
