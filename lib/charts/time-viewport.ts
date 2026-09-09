export const DAY = 86_400_000;
export type TimeRange = { start: number; end: number };
export const presets = ["1M", "3M", "YTD", "1Y", "3Y", "5Y", "10Y", "MAX"] as const;
export type Preset = typeof presets[number];
export const timestamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
export const dateString = (time: number) => new Date(time).toISOString().slice(0, 10);

export function parseDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = timestamp(value);
  return Number.isFinite(time) && dateString(time) === value ? time : null;
}

export function lowerBound(times: number[], value: number) {
  let low = 0, high = times.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (times[mid] < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function fullRange(times: number[]): TimeRange {
  return { start: times[0] ?? 0, end: times.at(-1) ?? 0 };
}

// Enforce a minimum of five actual observations, including irregular weekly history.
export function constrainRange(range: TimeRange, times: number[]): TimeRange {
  const full = fullRange(times);
  if (times.length <= 5 || !Number.isFinite(range.start + range.end) || range.end <= range.start) return full;
  const duration = Math.min(full.end - full.start, Math.max(DAY, range.end - range.start));
  let start = Math.max(full.start, Math.min(full.end - duration, Math.round(range.start / DAY) * DAY));
  let end = Math.min(full.end, Math.round((start + duration) / DAY) * DAY);
  const first = lowerBound(times, start);
  const after = lowerBound(times, end + 1);
  if (after - first < 5) {
    const center = lowerBound(times, (start + end) / 2);
    const index = Math.max(0, Math.min(times.length - 5, center - 2));
    start = Math.min(start, times[index]);
    end = Math.max(end, times[index + 4]);
  }
  return { start, end };
}

export function zoomRange(range: TimeRange, factor: number, anchor: number, times: number[]) {
  const fraction = Math.max(0, Math.min(1, anchor));
  const duration = (range.end - range.start) * factor;
  const start = range.start + (range.end - range.start) * fraction - duration * fraction;
  return constrainRange({ start, end: start + duration }, times);
}

export function presetRange(preset: Preset, times: number[]): TimeRange {
  const full = fullRange(times);
  if (preset === "MAX" || !times.length) return full;
  const date = new Date(full.end);
  if (preset === "YTD") return constrainRange({ start: Date.UTC(date.getUTCFullYear(), 0, 1), end: full.end }, times);
  const months = { "1M": 1, "3M": 3, "1Y": 12, "3Y": 36, "5Y": 60, "10Y": 120 }[preset];
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return constrainRange({ start: date.getTime(), end: full.end }, times);
}

export function rangeFromSearch(search: URLSearchParams, times: number[]) {
  const start = parseDate(search.get("from"));
  const end = parseDate(search.get("to"));
  return start !== null && end !== null && start < end ? constrainRange({ start, end }, times) : fullRange(times);
}

export function nearestIndex(times: number[], value: number) {
  const index = Math.min(times.length - 1, lowerBound(times, value));
  return index > 0 && value - times[index - 1] < times[index] - value ? index - 1 : index;
}

// Retain endpoints and each series' extrema in every pixel bucket.
export function decimate<T>(points: T[], values: (point: T) => number[], budget = 1200): T[] {
  if (points.length <= budget) return points;
  const series = values(points[0]).length;
  const size = Math.ceil(points.length / Math.max(1, Math.floor(budget / (2 * series + 2))));
  const keep = new Set([0, points.length - 1]);
  for (let start = 0; start < points.length; start += size) {
    const end = Math.min(points.length, start + size);
    keep.add(start); keep.add(end - 1);
    for (let column = 0; column < series; column++) {
      let min = start, max = start;
      for (let index = start + 1; index < end; index++) {
        if (values(points[index])[column] < values(points[min])[column]) min = index;
        if (values(points[index])[column] > values(points[max])[column]) max = index;
      }
      keep.add(min); keep.add(max);
    }
  }
  return [...keep].sort((a, b) => a - b).map((index) => points[index]);
}
