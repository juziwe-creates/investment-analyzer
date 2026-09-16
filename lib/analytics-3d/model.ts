export const sectors = ["Technology", "Financials", "Consumer Discretionary", "Consumer Staples", "Industrials", "Healthcare", "Real Estate", "Communication Services", "Energy", "Utilities", "Materials", "Other"] as const;
export type Sector = typeof sectors[number];

export type UniverseHolding = {
  key: string;
  name: string;
  monogram: string;
  sector: Sector;
  quantity: number;
  value: number | null;
  weight: number | null;
  costBasis: number | null;
  unrealizedGain: number | null;
  priceDate: string | null;
  href: string;
};

export type UniverseModel = {
  presentation?: boolean;
  asOfDate: string;
  account: string;
  portfolioHref: string;
  holdings: UniverseHolding[];
  value: number | null;
  complete: boolean;
  warnings: string[];
};

export function resolveSector(value?: string | null): Sector {
  return sectors.find((sector) => sector.toLowerCase() === value?.trim().toLowerCase()) ?? "Other";
}

export function contextHref(path: string, portfolio?: string) {
  return portfolio ? `${path}?${new URLSearchParams({ portfolio })}` : path;
}

type HoldingInput = {
  securityKey: string; securityName: string; quantity: number;
  marketValue: number | null; investedCapital: number;
  investmentGain: number | null; priceDate: string | null;
};

// Projection only: all inventory, cost and gain calculations belong to Alpha's engine.
export function universeModel(input: {
  holdings: HoldingInput[]; asOfDate: string; account: string; portfolio?: string;
  currencyReady: boolean; inventoryComplete: boolean;
  metadata?: ReadonlyMap<string, { ticker?: string | null; sector?: string | null }>;
}): UniverseModel {
  const finite = (value: number | null) => value !== null && Number.isFinite(value) ? value : null;
  const holdings = input.holdings.filter((holding) => holding.quantity > 0).map((holding): UniverseHolding => ({
    key: holding.securityKey, name: holding.securityName,
    monogram: (input.metadata?.get(holding.securityKey)?.ticker || holding.securityName).slice(0, 3).toUpperCase(),
    sector: resolveSector(input.metadata?.get(holding.securityKey)?.sector),
    quantity: holding.quantity,
    value: input.currencyReady ? finite(holding.marketValue) : null,
    weight: null,
    costBasis: input.currencyReady && input.inventoryComplete ? finite(holding.investedCapital) : null,
    unrealizedGain: input.currencyReady && input.inventoryComplete ? finite(holding.investmentGain) : null,
    priceDate: holding.priceDate,
    href: contextHref(`/portfolio/${encodeURIComponent(holding.securityKey)}`, input.portfolio)
  }));
  const complete = input.currencyReady && input.inventoryComplete && holdings.every((holding) => holding.value !== null);
  const value = input.currencyReady && input.inventoryComplete && (holdings.length === 0 || holdings.some((holding) => holding.value !== null))
    ? holdings.reduce((sum, holding) => sum + (holding.value ?? 0), 0) : null;
  if (complete && value !== null && value > 0) {
    holdings.forEach((holding) => { holding.weight = holding.value === null ? null : holding.value / value * 100; });
  }
  return {
    asOfDate: input.asOfDate, account: input.account, portfolioHref: contextHref("/dashboard", input.portfolio), holdings, value, complete,
    warnings: [
      ...(!input.currencyReady ? ["EUR conversion is unavailable. Monetary values are withheld."] : []),
      ...(!input.inventoryComplete ? ["Buy history is incomplete. Inventory may be incomplete; aggregate value and cost-based metrics are withheld."] : []),
      ...(input.currencyReady && holdings.some((holding) => holding.value === null) ? ["Some holdings lack a current price. Value shows only priced holdings; portfolio weights are withheld."] : [])
    ]
  };
}
