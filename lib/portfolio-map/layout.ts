export type MapPosition = { key: string; x: number; y: number; radius: number };
export type LayoutInput = { key: string; weight: number | null; sector: string; relativeReturn: number | null };

export const MAP_WIDTH = 1400;
export const MAP_HEIGHT = 700;

function radius(weight: number | null) {
  return weight === null ? 24 : Math.max(18, Math.min(72, 18 + 54 * Math.sqrt(Math.max(0, weight) / 100)));
}

function placeNear(key: string, preferredX: number, preferredY: number, r: number, placed: MapPosition[], bounds: { left: number; right: number; top: number; bottom: number }) {
  for (let attempt = 0; attempt < 2400; attempt++) {
    const distance = attempt === 0 ? 0 : 9 * Math.sqrt(attempt);
    const angle = attempt * 2.399963229728653;
    const x = Math.max(bounds.left + r, Math.min(bounds.right - r, preferredX + Math.cos(angle) * distance));
    const y = Math.max(bounds.top + r, Math.min(bounds.bottom - r, preferredY + Math.sin(angle) * distance));
    if (placed.every((node) => Math.hypot(node.x - x, node.y - y) >= node.radius + r + 9)) {
      return { key, x, y, radius: r };
    }
  }
  const step = Math.max(2 * r + 9, 42);
  const candidates: { x: number; y: number; distance: number }[] = [];
  for (let y = bounds.top + r; y <= bounds.bottom - r; y += step) {
    for (let x = bounds.left + r; x <= bounds.right - r; x += step) {
      candidates.push({ x, y, distance: Math.hypot(x - preferredX, y - preferredY) });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  for (const candidate of candidates) {
    if (placed.every((node) => Math.hypot(node.x - candidate.x, node.y - candidate.y) >= node.radius + r + 9)) {
      return { key, x: candidate.x, y: candidate.y, radius: r };
    }
  }
  return null;
}

function layoutGroup(input: LayoutInput[], bounds: { left: number; right: number; top: number; bottom: number }) {
  const placed: MapPosition[] = [];
  const ordered = [...input].sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1) || a.key.localeCompare(b.key));
  for (const [index, item] of ordered.entries()) {
    const r = radius(item.weight);
    const angle = index * 2.399963229728653;
    const spread = index === 0 ? 0 : Math.min(1, .3 + .2 * Math.sqrt(index));
    const preferredX = (bounds.left + bounds.right) / 2 + Math.cos(angle) * (bounds.right - bounds.left) * .38 * spread;
    const preferredY = (bounds.top + bounds.bottom) / 2 + Math.sin(angle) * (bounds.bottom - bounds.top) * .37 * spread;
    const node = placeNear(item.key, preferredX, preferredY, r, placed, bounds);
    if (node) placed.push(node);
  }
  return placed;
}

export function portfolioLayout(input: LayoutInput[]): MapPosition[] {
  return layoutGroup(input, { left: 40, right: MAP_WIDTH - 40, top: 48, bottom: MAP_HEIGHT - 48 });
}

export function sectorLayout(input: LayoutInput[]) {
  const groups = [...new Set(input.map((item) => item.sector))].sort();
  const columns = Math.ceil(Math.sqrt(groups.length));
  const rows = Math.ceil(groups.length / columns);
  const cellWidth = MAP_WIDTH / columns, cellHeight = MAP_HEIGHT / rows;
  const positions = groups.flatMap((sector, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    return layoutGroup(input.filter((item) => item.sector === sector), {
      left: column * cellWidth + 24, right: (column + 1) * cellWidth - 24,
      top: row * cellHeight + 40, bottom: (row + 1) * cellHeight - 24
    });
  });
  const labels = groups.map((sector, index) => ({ sector, x: (index % columns + .5) * cellWidth, y: (Math.floor(index / columns) + .5) * cellHeight }));
  return { positions, labels };
}

export function performanceLayout(input: LayoutInput[]) {
  const scored = input.map((item) => item.relativeReturn).filter((value): value is number => value !== null && Number.isFinite(value));
  const limit = Math.max(10, ...scored.map((value) => Math.abs(value)));
  const maximum = Math.max(1, ...input.map((item) => item.weight ?? 0));
  const bounds = { left: 120, right: MAP_WIDTH - 70, top: 65, bottom: MAP_HEIGHT - 85 };
  const placed: MapPosition[] = [];
  for (const item of [...input].sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1) || a.key.localeCompare(b.key))) {
    const r = radius(item.weight);
    const x = bounds.left + 70 + Math.sqrt(Math.max(0, item.weight ?? 0) / maximum) * (bounds.right - bounds.left - 140);
    const y = item.relativeReturn === null ? bounds.bottom - 18 : (bounds.top + bounds.bottom) / 2 - item.relativeReturn / limit * (bounds.bottom - bounds.top) * .38;
    const node = placeNear(item.key, x, y, r, placed, bounds);
    if (node) placed.push(node);
  }
  return { positions: placed, limit, hasScores: scored.length > 0 };
}
