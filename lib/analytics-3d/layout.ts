import { sectors, type Sector } from "./model";

export type Position = [number, number, number];

export function stableHash(key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export function sphereRadius(value: number | null, maximum: number) {
  if (value === null || !Number.isFinite(value) || value < 0) return 0.65;
  if (!(maximum > 0) || !Number.isFinite(maximum)) return 0.45;
  return Math.max(0.45, Math.min(1.65, 1.65 * Math.cbrt(value / maximum)));
}

export function sectorAnchor(sector: Sector): Position {
  if (sector === "Other") return [0, 0, 0];
  const angle = sectors.indexOf(sector) / (sectors.length - 1) * Math.PI * 2;
  return [Math.cos(angle) * 90, Math.sin(angle) * 90, -8];
}

// Fixed sector anchors and hashed slots keep placement independent of input order and value.
// Deterministic probing separates collisions; extra layers support more than 64 holdings/sector.
export function layoutHoldings(holdings: readonly { key: string; sector: Sector }[]) {
  const occupied = new Map<Sector, Set<number>>();
  const result = new Map<string, Position>();
  for (const holding of [...holdings].sort((a, b) => a.key.localeCompare(b.key, "en"))) {
    const slots = occupied.get(holding.sector) ?? new Set<number>();
    const hash = stableHash(holding.key);
    let slot = hash % 64;
    while (slots.has(slot)) slot++;
    slots.add(slot);
    occupied.set(holding.sector, slots);
    const anchor = sectorAnchor(holding.sector);
    result.set(holding.key, [anchor[0] + ((slot % 8) - 3.5) * 4.2,
      anchor[1] + ((Math.floor(slot / 8) % 8) - 3.5) * 4.2,
      anchor[2] - Math.floor(slot / 64) * 6 - 1 + (hash % 5) * 0.5]);
  }
  return result;
}

export function sceneBounds(positions: Iterable<Position>) {
  const points = [[0, 0, 0] as Position, ...positions];
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis])) - 2);
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])) + 2);
  const center = min.map((value, axis) => (value + max[axis]) / 2) as Position;
  return { center, radius: Math.max(7, Math.hypot(...max.map((value, axis) => (value - min[axis]) / 2))) };
}
