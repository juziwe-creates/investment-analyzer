export type SecuritySplit = { securityKey: string; date: string; numerator: number; denominator: number };

export function splitFactor(split: SecuritySplit) {
  const factor = split.numerator / split.denominator;
  if (!Number.isFinite(factor) || split.numerator <= 0 || split.denominator <= 0) throw new Error("Invalid stock split ratio");
  return factor;
}

export function uniqueSplits(splits: SecuritySplit[]) {
  const events = new Map<string, SecuritySplit>();
  for (const split of splits) {
    splitFactor(split);
    const key = `${split.securityKey}\u0000${split.date}`;
    const existing = events.get(key);
    if (existing && splitFactor(existing) !== splitFactor(split)) throw new Error("Conflicting stock split ratios");
    events.set(key, split);
  }
  return [...events.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Rebase a prior raw quote into the share units at the valuation date.
export function splitPrice(price: number, key: string, quoteDate: string, date: string, splits: SecuritySplit[]) {
  return splits.filter((split) => split.securityKey === key && split.date > quoteDate && split.date <= date)
    .reduce((value, split) => value / splitFactor(split), price);
}

export function parseSplitRatio(value: string) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) throw new Error("Invalid EODHD split ratio");
  const numerator = Number(match[1]), denominator = Number(match[2]);
  splitFactor({ securityKey: "", date: "", numerator, denominator });
  const factor = numerator / denominator;
  if (!Number.isInteger(factor) && !Number.isInteger(1 / factor) && factor !== 1.5) throw new Error("Corporate-action ratio requires review; it may describe a spin-off rather than a stock split");
  return { numerator, denominator };
}
