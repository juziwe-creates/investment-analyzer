// Purchase costs are cumulative, not the remaining cost basis of open shares.
export function profitGenerated(value: number | null, proceeds: number | null, dividends: number, purchaseCosts: number): number | null {
  if (value === null || proceeds === null || ![value, proceeds, dividends, purchaseCosts].every(Number.isFinite)) return null;
  return value + proceeds + dividends - purchaseCosts;
}
