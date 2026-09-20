import type { MarketHistoryPrice } from "@/types/market-history";

function isNewer(candidate: MarketHistoryPrice, current: MarketHistoryPrice) {
  const updatedComparison = candidate.updated_at.localeCompare(current.updated_at);
  return updatedComparison > 0 || (updatedComparison === 0 && candidate.id.localeCompare(current.id) > 0);
}

export function deduplicateMarketHistory(rows: MarketHistoryPrice[]) {
  const latestBySecurityAndDate = new Map<string, MarketHistoryPrice>();

  for (const row of rows) {
    const key = `${row.security_key}\u0000${row.price_date}`;
    const current = latestBySecurityAndDate.get(key);
    if (!current || isNewer(row, current)) latestBySecurityAndDate.set(key, row);
  }

  return [...latestBySecurityAndDate.values()].sort((a, b) =>
    a.price_date.localeCompare(b.price_date) || a.security_key.localeCompare(b.security_key)
  );
}
