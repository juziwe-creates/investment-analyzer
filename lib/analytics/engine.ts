export type AnalyticsTransactionType = "buy" | "sell" | "dividend" | "fee" | "tax";

export type AnalyticsTransactionComponent = {
  component_type: "fee" | "tax" | "withholding_tax" | "exchange_fee" | "broker_fee" | "other";
  amount: number;
  currency: string;
};

export type AnalyticsTransaction = {
  id: string;
  type: AnalyticsTransactionType;
  trade_date: string;
  security_name: string;
  isin: string | null;
  wkn?: string | null;
  ticker: string | null;
  quantity: number | null;
  unit_price: number | null;
  gross_amount: number | null;
  net_amount: number | null;
  currency: string;
  created_at: string;
  components?: AnalyticsTransactionComponent[];
};

export type AnalyticsPrice = {
  security_key: string;
  price: number;
  price_date: string;
  currency: string;
  source?: string;
  id?: string;
};

export type LotStatus = "open" | "partial" | "closed";
export type LotMatchingMethod = "fifo" | "lifo";

export type LotCalculationOptions = {
  lotMatchingMethod?: LotMatchingMethod;
};

export type XirrStatus =
  | "valid"
  | "insufficient_cashflows"
  | "no_solution"
  | "calculation_error";

export type LotCashFlow = {
  date: string;
  amount: number;
  kind: "buy" | "sell" | "dividend" | "terminal_value";
  transactionId?: string;
};

export type PurchaseLotAnalytics = {
  buyTransactionId: string;
  securityKey: string;
  securityName: string;
  isin: string | null;
  ticker: string | null;
  buyDate: string;
  originalQuantity: number;
  remainingQuantity: number;
  acquisitionCostPerShare: number;
  originalAcquisitionCost: number;
  remainingAcquisitionCost: number;
  currentMarketPrice: number | null;
  currentPriceDate: string | null;
  currentRemainingValue: number | null;
  attributedSaleProceeds: number;
  attributedDividends: number;
  unrealizedGain: number | null;
  realizedGain: number;
  totalEconomicValue: number | null;
  totalGain: number | null;
  totalReturnPercent: number | null;
  annualizedReturnPercent: number | null;
  annualizedReturnStatus: XirrStatus;
  currentDividendProfitabilityPercent: number | null;
  averageDividendProfitabilityPercent: number | null;
  latestDividendPerShare: number | null;
  latestDividendDate: string | null;
  status: LotStatus;
  currency: string;
  cashFlows: LotCashFlow[];
  trace: {
    buyTransactionId: string;
    sellTransactionIds: string[];
    dividendTransactionIds: string[];
    valuationPriceId?: string;
  };
};

export type PortfolioTimelinePoint = {
  date: string;
  portfolioMarketValue: number;
  currentDeployedCapital: number;
  pricedCurrentDeployedCapital: number;
  unpricedCurrentDeployedCapital: number;
  unrealizedGain: number;
  unrealizedGainPercent: number | null;
  lifetimeDeployedCapital: number;
  dividendsCollected: number;
  missingPriceSecurityKeys: string[];
  hasCompletePricing: boolean;
  currency: string;
};

type WorkingLot = {
  buyTransactionId: string;
  securityKey: string;
  securityName: string;
  isin: string | null;
  ticker: string | null;
  buyDate: string;
  originalQuantity: number;
  remainingQuantity: number;
  acquisitionCostPerShare: number;
  originalAcquisitionCost: number;
  remainingAcquisitionCost: number;
  attributedSaleProceeds: number;
  attributedSaleCostBasis: number;
  attributedDividends: number;
  dividendAllocations: {
    date: string;
    amount: number;
    quantity: number;
    transactionId: string;
  }[];
  saleTransactionIds: string[];
  dividendTransactionIds: string[];
  currency: string;
  cashFlows: LotCashFlow[];
};

export function securityKey(
  transaction: Pick<AnalyticsTransaction, "isin" | "ticker" | "security_name">
) {
  return transaction.isin ?? transaction.ticker ?? transaction.security_name;
}

function dateTimestamp(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function yearsBetween(startDate: string, endDate: string) {
  return (dateTimestamp(endDate) - dateTimestamp(startDate)) / (1000 * 60 * 60 * 24 * 365.25);
}

function numeric(value: number | null | undefined) {
  return value ?? 0;
}

function componentAmount(
  transaction: AnalyticsTransaction,
  componentTypes: AnalyticsTransactionComponent["component_type"][]
) {
  return (
    transaction.components
      ?.filter((component) => componentTypes.includes(component.component_type))
      .reduce((sum, component) => sum + Math.abs(component.amount), 0) ?? 0
  );
}

export function acquisitionCost(transaction: AnalyticsTransaction) {
  if (transaction.type !== "buy") {
    return 0;
  }

  const gross = transaction.gross_amount ?? numeric(transaction.quantity) * numeric(transaction.unit_price);
  const fees = componentAmount(transaction, ["fee", "broker_fee", "exchange_fee"]);

  if (fees > 0 || transaction.gross_amount !== null) {
    return Math.abs(gross) + fees;
  }

  if (transaction.net_amount !== null) {
    return Math.abs(transaction.net_amount);
  }

  return Math.abs(gross);
}

export function saleProceeds(transaction: AnalyticsTransaction) {
  if (transaction.type !== "sell") {
    return 0;
  }

  const fees = componentAmount(transaction, ["fee", "broker_fee", "exchange_fee"]);

  if (transaction.gross_amount !== null) {
    return Math.max(Math.abs(transaction.gross_amount) - fees, 0);
  }

  if (transaction.net_amount !== null) {
    return Math.abs(transaction.net_amount);
  }

  return Math.max(numeric(transaction.quantity) * numeric(transaction.unit_price) - fees, 0);
}

export function dividendAmount(transaction: AnalyticsTransaction) {
  if (transaction.type !== "dividend") {
    return 0;
  }

  if (transaction.gross_amount !== null) {
    return Math.abs(transaction.gross_amount);
  }

  if (transaction.net_amount !== null) {
    return Math.abs(transaction.net_amount);
  }

  return Math.abs(numeric(transaction.quantity) * numeric(transaction.unit_price));
}

function statusForLot(lot: WorkingLot): LotStatus {
  if (lot.remainingQuantity <= 0) {
    return "closed";
  }

  if (lot.remainingQuantity < lot.originalQuantity) {
    return "partial";
  }

  return "open";
}

function dividendYieldPercent(dividendPerShare: number, acquisitionCostPerShare: number) {
  if (acquisitionCostPerShare <= 0) {
    return null;
  }

  return (dividendPerShare / acquisitionCostPerShare) * 100;
}

function sortTransactionsChronologically(transactions: AnalyticsTransaction[]) {
  return [...transactions].sort((a, b) => {
    const dateComparison = dateTimestamp(a.trade_date) - dateTimestamp(b.trade_date);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return a.created_at.localeCompare(b.created_at);
  });
}

function xnpv(rate: number, cashFlows: LotCashFlow[]) {
  const firstDate = cashFlows[0]?.date;

  if (!firstDate || rate <= -1) {
    return Number.NaN;
  }

  return cashFlows.reduce((sum, cashFlow) => {
    const years = yearsBetween(firstDate, cashFlow.date);
    return sum + cashFlow.amount / (1 + rate) ** years;
  }, 0);
}

export function calculateXirr(cashFlows: LotCashFlow[]) {
  const chronologicalCashFlows = [...cashFlows].sort(
    (a, b) => dateTimestamp(a.date) - dateTimestamp(b.date)
  );
  const hasPositive = chronologicalCashFlows.some((cashFlow) => cashFlow.amount > 0);
  const hasNegative = chronologicalCashFlows.some((cashFlow) => cashFlow.amount < 0);

  if (chronologicalCashFlows.length < 2 || !hasPositive || !hasNegative) {
    return { value: null, status: "insufficient_cashflows" as XirrStatus };
  }

  try {
    const candidates = [
      -0.9999,
      -0.99,
      -0.9,
      -0.75,
      -0.5,
      -0.25,
      -0.1,
      0,
      0.05,
      0.1,
      0.25,
      0.5,
      1,
      2,
      5,
      10
    ];
    let low: number | null = null;
    let high: number | null = null;
    let previousRate = candidates[0];
    let previousValue = xnpv(previousRate, chronologicalCashFlows);

    for (const rate of candidates.slice(1)) {
      const value = xnpv(rate, chronologicalCashFlows);

      if (!Number.isFinite(previousValue) || !Number.isFinite(value)) {
        previousRate = rate;
        previousValue = value;
        continue;
      }

      if (previousValue === 0) {
        return { value: previousRate * 100, status: "valid" as XirrStatus };
      }

      if (previousValue * value <= 0) {
        low = previousRate;
        high = rate;
        break;
      }

      previousRate = rate;
      previousValue = value;
    }

    if (low === null || high === null) {
      return { value: null, status: "no_solution" as XirrStatus };
    }

    let bracketLow = low;
    let bracketHigh = high;

    for (let index = 0; index < 100; index += 1) {
      const middle = (bracketLow + bracketHigh) / 2;
      const lowValue = xnpv(bracketLow, chronologicalCashFlows);
      const middleValue = xnpv(middle, chronologicalCashFlows);

      if (!Number.isFinite(lowValue) || !Number.isFinite(middleValue)) {
        return { value: null, status: "calculation_error" as XirrStatus };
      }

      if (Math.abs(middleValue) < 0.000001) {
        return { value: middle * 100, status: "valid" as XirrStatus };
      }

      if (lowValue * middleValue <= 0) {
        bracketHigh = middle;
      } else {
        bracketLow = middle;
      }
    }

    return {
      value: ((bracketLow + bracketHigh) / 2) * 100,
      status: "valid" as XirrStatus
    };
  } catch {
    return { value: null, status: "calculation_error" as XirrStatus };
  }
}

export function latestPricesAtDate(prices: AnalyticsPrice[], date: string) {
  const pricesBySecurity = new Map<string, AnalyticsPrice>();
  const targetTime = dateTimestamp(date);

  for (const price of prices) {
    if (dateTimestamp(price.price_date) > targetTime) {
      continue;
    }

    const existing = pricesBySecurity.get(price.security_key);

    if (!existing || dateTimestamp(price.price_date) > dateTimestamp(existing.price_date)) {
      pricesBySecurity.set(price.security_key, price);
    }
  }

  return pricesBySecurity;
}

function priceMapForValuation(prices: AnalyticsPrice[], valuationDate?: string) {
  return valuationDate
    ? latestPricesAtDate(prices, valuationDate)
    : new Map(prices.map((price) => [price.security_key, price]));
}

function applyTransactionToLots(
  transaction: AnalyticsTransaction,
  lots: WorkingLot[],
  options: LotCalculationOptions = {}
) {
  const key = securityKey(transaction);
  const lotMatchingMethod = options.lotMatchingMethod ?? "fifo";

  if (transaction.type === "buy") {
    const originalQuantity = numeric(transaction.quantity);
    const originalAcquisitionCost = acquisitionCost(transaction);
    const acquisitionCostPerShare =
      originalQuantity > 0 ? originalAcquisitionCost / originalQuantity : 0;

    lots.push({
      buyTransactionId: transaction.id,
      securityKey: key,
      securityName: transaction.security_name,
      isin: transaction.isin,
      ticker: transaction.ticker,
      buyDate: transaction.trade_date,
      originalQuantity,
      remainingQuantity: originalQuantity,
      acquisitionCostPerShare,
      originalAcquisitionCost,
      remainingAcquisitionCost: originalAcquisitionCost,
      attributedSaleProceeds: 0,
      attributedSaleCostBasis: 0,
      attributedDividends: 0,
      dividendAllocations: [],
      saleTransactionIds: [],
      dividendTransactionIds: [],
      currency: transaction.currency,
      cashFlows: [
        {
          date: transaction.trade_date,
          amount: -originalAcquisitionCost,
          kind: "buy",
          transactionId: transaction.id
        }
      ]
    });
    return;
  }

  if (transaction.type === "sell") {
    let quantityToSell = numeric(transaction.quantity);
    const totalSellQuantity = quantityToSell;
    const totalSaleProceeds = saleProceeds(transaction);
    const matchingLots = (
      lotMatchingMethod === "lifo" ? [...lots].reverse() : lots
    ).filter((lot) => lot.securityKey === key && lot.remainingQuantity > 0);

    for (const lot of matchingLots) {
      if (quantityToSell <= 0) {
        break;
      }

      const consumedQuantity = Math.min(lot.remainingQuantity, quantityToSell);
      const consumedCostBasis = consumedQuantity * lot.acquisitionCostPerShare;
      const allocatedSaleProceeds =
        totalSellQuantity > 0 ? totalSaleProceeds * (consumedQuantity / totalSellQuantity) : 0;

      lot.remainingQuantity -= consumedQuantity;
      lot.remainingAcquisitionCost -= consumedCostBasis;
      lot.attributedSaleProceeds += allocatedSaleProceeds;
      lot.attributedSaleCostBasis += consumedCostBasis;
      lot.saleTransactionIds.push(transaction.id);
      lot.cashFlows.push({
        date: transaction.trade_date,
        amount: allocatedSaleProceeds,
        kind: "sell",
        transactionId: transaction.id
      });
      quantityToSell -= consumedQuantity;
    }
    return;
  }

  if (transaction.type === "dividend") {
    const totalDividendAmount = dividendAmount(transaction);
    const eligibleLots = lots.filter(
      (lot) =>
        lot.securityKey === key &&
        dateTimestamp(lot.buyDate) <= dateTimestamp(transaction.trade_date) &&
        lot.remainingQuantity > 0
    );
    const eligibleQuantity = eligibleLots.reduce(
      (sum, lot) => sum + lot.remainingQuantity,
      0
    );

    if (eligibleQuantity <= 0) {
      return;
    }

    for (const lot of eligibleLots) {
      const allocationQuantity = lot.remainingQuantity;
      const allocatedDividend =
        totalDividendAmount * (allocationQuantity / eligibleQuantity);
      lot.attributedDividends += allocatedDividend;
      lot.dividendAllocations.push({
        date: transaction.trade_date,
        amount: allocatedDividend,
        quantity: allocationQuantity,
        transactionId: transaction.id
      });
      lot.dividendTransactionIds.push(transaction.id);
      lot.cashFlows.push({
        date: transaction.trade_date,
        amount: allocatedDividend,
        kind: "dividend",
        transactionId: transaction.id
      });
    }
  }
}

function buildPurchaseLotAnalytics(
  lots: WorkingLot[],
  priceMap: Map<string, AnalyticsPrice>,
  valuationDate?: string
) {
  return lots.map((lot) => {
    const price = priceMap.get(lot.securityKey);
    const currentRemainingValue =
      lot.remainingQuantity <= 0 ? 0 : price ? lot.remainingQuantity * price.price : null;
    const unrealizedGain =
      currentRemainingValue === null ? null : currentRemainingValue - lot.remainingAcquisitionCost;
    const realizedGain = lot.attributedSaleProceeds - lot.attributedSaleCostBasis;
    const totalEconomicValue =
      currentRemainingValue === null
        ? null
        : currentRemainingValue + lot.attributedSaleProceeds + lot.attributedDividends;
    const totalGain =
      totalEconomicValue === null ? null : totalEconomicValue - lot.originalAcquisitionCost;
    const totalReturnPercent =
      totalGain === null || lot.originalAcquisitionCost <= 0
        ? null
        : (totalGain / lot.originalAcquisitionCost) * 100;
    const terminalDate = price?.price_date ?? valuationDate;
    const terminalCashFlow =
      currentRemainingValue !== null && terminalDate && lot.remainingQuantity > 0
        ? {
            date: terminalDate,
            amount: currentRemainingValue,
            kind: "terminal_value" as const
          }
        : null;
    const cashFlows = terminalCashFlow
      ? [...lot.cashFlows, terminalCashFlow]
      : [...lot.cashFlows];
    const xirr = calculateXirr(cashFlows);
    const trailingDividendStartDate =
      terminalDate && price
        ? new Date(dateTimestamp(terminalDate) - 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
        : null;
    const trailingDividendAmount = trailingDividendStartDate
      ? lot.dividendAllocations
          .filter(
            (allocation) =>
              allocation.date > trailingDividendStartDate && allocation.date <= terminalDate!
          )
          .reduce((sum, allocation) => sum + allocation.amount, 0)
      : 0;
    const currentDividendPerShare =
      lot.remainingQuantity > 0 ? trailingDividendAmount / lot.remainingQuantity : null;
    const yearsHeld = terminalDate ? yearsBetween(lot.buyDate, terminalDate) : 0;
    const averageDividendPerShare =
      yearsHeld > 0 && lot.originalQuantity > 0
        ? lot.attributedDividends / yearsHeld / lot.originalQuantity
        : null;
    const latestDividendAllocation = lot.dividendAllocations.at(-1) ?? null;
    const latestDividendPerShare =
      latestDividendAllocation && latestDividendAllocation.quantity > 0
        ? latestDividendAllocation.amount / latestDividendAllocation.quantity
        : null;

    return {
      buyTransactionId: lot.buyTransactionId,
      securityKey: lot.securityKey,
      securityName: lot.securityName,
      isin: lot.isin,
      ticker: lot.ticker,
      buyDate: lot.buyDate,
      originalQuantity: lot.originalQuantity,
      remainingQuantity: lot.remainingQuantity,
      acquisitionCostPerShare: lot.acquisitionCostPerShare,
      originalAcquisitionCost: lot.originalAcquisitionCost,
      remainingAcquisitionCost: Math.max(lot.remainingAcquisitionCost, 0),
      currentMarketPrice: price?.price ?? null,
      currentPriceDate: price?.price_date ?? null,
      currentRemainingValue,
      attributedSaleProceeds: lot.attributedSaleProceeds,
      attributedDividends: lot.attributedDividends,
      unrealizedGain,
      realizedGain,
      totalEconomicValue,
      totalGain,
      totalReturnPercent,
      annualizedReturnPercent: xirr.value,
      annualizedReturnStatus: xirr.status,
      currentDividendProfitabilityPercent:
        currentDividendPerShare === null
          ? null
          : dividendYieldPercent(currentDividendPerShare, lot.acquisitionCostPerShare),
      averageDividendProfitabilityPercent:
        averageDividendPerShare === null
          ? null
          : dividendYieldPercent(averageDividendPerShare, lot.acquisitionCostPerShare),
      latestDividendPerShare,
      latestDividendDate: latestDividendAllocation?.date ?? null,
      status: statusForLot(lot),
      currency: price?.currency ?? lot.currency,
      cashFlows,
      trace: {
        buyTransactionId: lot.buyTransactionId,
        sellTransactionIds: [...new Set(lot.saleTransactionIds)],
        dividendTransactionIds: [...new Set(lot.dividendTransactionIds)],
        valuationPriceId: price?.id
      }
    };
  });
}

export function calculatePurchaseLots(
  transactions: AnalyticsTransaction[],
  prices: AnalyticsPrice[] = [],
  valuationDate?: string,
  options: LotCalculationOptions = {}
): PurchaseLotAnalytics[] {
  const lots: WorkingLot[] = [];

  for (const transaction of sortTransactionsChronologically(transactions)) {
    applyTransactionToLots(transaction, lots, options);
  }

  return buildPurchaseLotAnalytics(lots, priceMapForValuation(prices, valuationDate), valuationDate);
}

export function calculateLifetimeDeployedCapital(transactions: AnalyticsTransaction[]) {
  return transactions
    .filter((transaction) => transaction.type === "buy")
    .reduce((sum, transaction) => sum + acquisitionCost(transaction), 0);
}

export function buildPortfolioTimeline(
  transactions: AnalyticsTransaction[],
  prices: AnalyticsPrice[],
  options: LotCalculationOptions = {}
): PortfolioTimelinePoint[] {
  const chronologicalTransactions = sortTransactionsChronologically(transactions);
  const chronologicalPrices = [...prices].sort(
    (a, b) => dateTimestamp(a.price_date) - dateTimestamp(b.price_date)
  );
  const dates = [
    ...new Set([
      ...chronologicalTransactions.map((transaction) => transaction.trade_date),
      ...chronologicalPrices.map((price) => price.price_date)
    ])
  ].sort((a, b) => dateTimestamp(a) - dateTimestamp(b));
  const points: PortfolioTimelinePoint[] = [];
  const baseCurrency = transactions[0]?.currency ?? prices[0]?.currency ?? "EUR";
  const lots: WorkingLot[] = [];
  const latestPriceMap = new Map<string, AnalyticsPrice>();
  let transactionIndex = 0;
  let priceIndex = 0;
  let dividendsCollected = 0;
  let lifetimeDeployedCapital = 0;

  for (const date of dates) {
    const targetTime = dateTimestamp(date);

    while (
      chronologicalTransactions[transactionIndex] &&
      dateTimestamp(chronologicalTransactions[transactionIndex].trade_date) <= targetTime
    ) {
      const transaction = chronologicalTransactions[transactionIndex];

      if (transaction.type === "buy") {
        lifetimeDeployedCapital += acquisitionCost(transaction);
      }

      if (transaction.type === "dividend") {
        dividendsCollected += dividendAmount(transaction);
      }

      applyTransactionToLots(transaction, lots, options);
      transactionIndex += 1;
    }

    while (
      chronologicalPrices[priceIndex] &&
      dateTimestamp(chronologicalPrices[priceIndex].price_date) <= targetTime
    ) {
      const price = chronologicalPrices[priceIndex];

      latestPriceMap.set(price.security_key, price);
      priceIndex += 1;
    }

    const lotAnalytics = buildPurchaseLotAnalytics(lots, latestPriceMap, date);
    const openLots = lotAnalytics.filter((lot) => lot.remainingQuantity > 0);
    const pricedOpenLots = openLots.filter((lot) => lot.currentRemainingValue !== null);
    const currentDeployedCapital = openLots.reduce(
      (sum, lot) => sum + lot.remainingAcquisitionCost,
      0
    );
    const pricedCurrentDeployedCapital = pricedOpenLots.reduce(
      (sum, lot) => sum + lot.remainingAcquisitionCost,
      0
    );
    const unpricedCurrentDeployedCapital =
      currentDeployedCapital - pricedCurrentDeployedCapital;
    const portfolioMarketValue = pricedOpenLots.reduce(
      (sum, lot) => sum + (lot.currentRemainingValue ?? 0),
      0
    );
    const missingPriceSecurityKeys = [
      ...new Set(
        openLots
          .filter((lot) => !latestPriceMap.has(lot.securityKey))
          .map((lot) => lot.securityKey)
      )
    ];
    const hasCompletePricing = missingPriceSecurityKeys.length === 0;
    const unrealizedGain = portfolioMarketValue - pricedCurrentDeployedCapital;

    if (openLots.length === 0 && dividendsCollected === 0) {
      continue;
    }

    points.push({
      date,
      portfolioMarketValue,
      currentDeployedCapital,
      pricedCurrentDeployedCapital,
      unpricedCurrentDeployedCapital,
      unrealizedGain,
      unrealizedGainPercent:
        pricedCurrentDeployedCapital > 0
          ? (unrealizedGain / pricedCurrentDeployedCapital) * 100
          : null,
      lifetimeDeployedCapital,
      dividendsCollected,
      missingPriceSecurityKeys,
      hasCompletePricing,
      currency: pricedOpenLots[0]?.currency ?? baseCurrency
    });
  }

  return points;
}
