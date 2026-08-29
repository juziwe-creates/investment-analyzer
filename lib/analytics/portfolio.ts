import {
  buildValuationPrices,
  calculateLotProfitability,
  type LotProfitability
} from "@/lib/analytics/profitability";
import {
  acquisitionCost,
  buildPortfolioTimeline,
  calculateXirr,
  dividendAmount,
  saleProceeds,
  type AnalyticsPrice,
  type AnalyticsTransaction,
  type LotCalculationOptions,
  type LotCashFlow
} from "@/lib/analytics/engine";
import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type ManualSecurityPrice = Database["public"]["Tables"]["manual_security_prices"]["Row"];
type LatestMarketPrice = Database["public"]["Views"]["latest_market_prices"]["Row"];
type MarketPrice = Database["public"]["Tables"]["market_prices"]["Row"];

export type ChartInterval = "daily" | "weekly" | "monthly";

export type PortfolioSummary = {
  portfolioValue: number | null;
  investedCapital: number;
  investmentGain: number | null;
  pricedPortfolioValue: number;
  pricedInvestedCapital: number;
  pricedInvestmentGain: number;
  unpricedInvestedCapital: number;
  openLots: number;
  unpricedOpenLots: number;
  hasCompletePricing: boolean;
  dividendsReceived: number;
  totalProfitability: number | null;
  currency: string;
};

export type PortfolioHolding = {
  securityKey: string;
  securityName: string;
  quantity: number;
  investedCapital: number;
  latestPrice: number | null;
  priceDate: string | null;
  marketValue: number | null;
  investmentGain: number | null;
  dividendsReceived: number;
  totalProfitability: number | null;
  totalReturnPercent: number | null;
  annualizedReturnPercent: number | null;
  currency: string;
};

export type SecurityInventoryItem = {
  user_id: string;
  portfolio_id: string;
  security_key: string;
  security_name: string;
  isin: string | null;
  wkn: string | null;
  ticker: string | null;
  exchange: string | null;
  security_currency: string | null;
  asset_type: string | null;
  transaction_count: number;
  first_trade_date: string;
  last_trade_date: string;
  ownedQuantity: number;
};

export type PortfolioDevelopmentPoint = {
  date: string;
  investedCapital: number;
  investmentGain: number;
  portfolioValue: number;
  unpricedInvestedCapital: number;
  unpricedOpenLots: number;
  hasCompletePricing: boolean;
  dividendsReceived: number;
  currency: string;
};

export type CapitalDeploymentPoint = {
  date: string;
  capitalDeployed: number;
  dividendsCollected: number;
  currency: string;
};

export type SecurityActivityWithoutBuyHistory = {
  securityKey: string;
  securityName: string;
  isin: string | null;
  ticker: string | null;
  dividendCount: number;
  sellCount: number;
  totalDividends: number;
  latestTransactionDate: string;
  currency: string;
};

type WorkingPortfolioHolding = PortfolioHolding & {
  totalAcquisitionCost: number;
  saleProceeds: number;
  cashFlows: LotCashFlow[];
  hasUnpricedOpenLot: boolean;
};

function cashAmount(transaction: Transaction) {
  if (transaction.net_amount !== null) {
    return Math.abs(transaction.net_amount);
  }

  if (transaction.gross_amount !== null) {
    return Math.abs(transaction.gross_amount);
  }

  return 0;
}

function toAnalyticsTransaction(transaction: Transaction): AnalyticsTransaction {
  return {
    id: transaction.id,
    type: transaction.type,
    trade_date: transaction.trade_date,
    security_name: transaction.security_name,
    isin: transaction.isin,
    wkn: transaction.wkn,
    ticker: transaction.ticker,
    quantity: transaction.quantity,
    unit_price: transaction.unit_price,
    gross_amount: transaction.gross_amount,
    net_amount: transaction.net_amount,
    currency: transaction.currency,
    created_at: transaction.created_at
  };
}

function toAnalyticsPrices(marketPrices: MarketPrice[]): AnalyticsPrice[] {
  return marketPrices.map((price) => ({
    security_key: price.security_key,
    price: price.adjusted_close_price ?? price.close_price,
    price_date: price.price_date,
    currency: price.currency,
    source: "market",
    id: price.id
  }));
}

function intervalKey(date: string, interval: ChartInterval) {
  const parsedDate = parseDate(date);
  const year = parsedDate.getUTCFullYear();

  if (interval === "monthly") {
    return `${year}-${String(parsedDate.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  if (interval === "weekly") {
    const firstDayOfYear = Date.UTC(year, 0, 1);
    const dayOfYear = Math.floor((parsedDate.getTime() - firstDayOfYear) / 86400000) + 1;
    const week = Math.ceil((dayOfYear + new Date(firstDayOfYear).getUTCDay()) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  return date;
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function dateTimestamp(date: string) {
  return parseDate(date).getTime();
}

export function transactionSecurityKey(
  transaction: Pick<Transaction, "isin" | "ticker" | "security_name">
) {
  return transaction.isin ?? transaction.ticker ?? transaction.security_name;
}

export function parseChartInterval(value: string | undefined): ChartInterval {
  return value === "weekly" || value === "monthly" ? value : "daily";
}

export function calculatePortfolioSummary(
  lots: LotProfitability[],
  transactions: Transaction[]
): PortfolioSummary {
  const openLots = lots.filter((lot) => lot.remainingQuantity > 0);
  const pricedOpenLots = openLots.filter((lot) => lot.currentValue !== null);
  const investedCapital = openLots.reduce((sum, lot) => sum + lot.remainingCostBasis, 0);
  const pricedInvestedCapital = pricedOpenLots.reduce(
    (sum, lot) => sum + lot.remainingCostBasis,
    0
  );
  const pricedPortfolioValue = pricedOpenLots.reduce(
    (sum, lot) => sum + (lot.currentValue ?? 0),
    0
  );
  const unpricedInvestedCapital = investedCapital - pricedInvestedCapital;
  const unpricedOpenLots = openLots.length - pricedOpenLots.length;
  const hasCompletePricing = unpricedOpenLots === 0;
  const dividendsReceived = transactions
    .filter((transaction) => transaction.type === "dividend")
    .reduce((sum, transaction) => sum + cashAmount(transaction), 0);
  const portfolioValue = hasCompletePricing ? pricedPortfolioValue : null;
  const investmentGain = hasCompletePricing ? pricedPortfolioValue - investedCapital : null;
  const pricedInvestmentGain = pricedPortfolioValue - pricedInvestedCapital;

  return {
    portfolioValue,
    investedCapital,
    investmentGain,
    pricedPortfolioValue,
    pricedInvestedCapital,
    pricedInvestmentGain,
    unpricedInvestedCapital,
    openLots: openLots.length,
    unpricedOpenLots,
    hasCompletePricing,
    dividendsReceived,
    totalProfitability: investmentGain === null ? null : investmentGain + dividendsReceived,
    currency: lots[0]?.currency ?? transactions[0]?.currency ?? "EUR"
  };
}

export function calculatePortfolioHoldings(lots: LotProfitability[]): PortfolioHolding[] {
  const holdingsBySecurity = new Map<string, WorkingPortfolioHolding>();

  for (const lot of lots) {
    const existing = holdingsBySecurity.get(lot.securityKey);
    const hasUnpricedOpenLot = lot.remainingQuantity > 0 && lot.currentValue === null;
    const currentValue = hasUnpricedOpenLot ? null : lot.currentValue ?? 0;
    const unrealizedGainLoss = hasUnpricedOpenLot ? null : lot.unrealizedGainLoss ?? 0;

    if (!existing) {
      holdingsBySecurity.set(lot.securityKey, {
        securityKey: lot.securityKey,
        securityName: lot.securityName,
        quantity: lot.remainingQuantity,
        investedCapital: lot.remainingCostBasis,
        latestPrice: lot.latestPrice,
        priceDate: lot.priceDate,
        marketValue: currentValue,
        investmentGain: unrealizedGainLoss,
        dividendsReceived: lot.accumulatedDividends,
        totalProfitability: null,
        totalReturnPercent: null,
        annualizedReturnPercent: null,
        currency: lot.currency,
        totalAcquisitionCost: lot.costBasis,
        saleProceeds: lot.attributedSaleProceeds,
        cashFlows: [...lot.cashFlows],
        hasUnpricedOpenLot
      });
      continue;
    }

    existing.quantity += lot.remainingQuantity;
    existing.investedCapital += lot.remainingCostBasis;
    existing.totalAcquisitionCost += lot.costBasis;
    existing.saleProceeds += lot.attributedSaleProceeds;
    existing.dividendsReceived += lot.accumulatedDividends;
    existing.cashFlows.push(...lot.cashFlows);
    existing.hasUnpricedOpenLot = existing.hasUnpricedOpenLot || hasUnpricedOpenLot;
    existing.marketValue =
      existing.marketValue === null || currentValue === null
        ? null
        : existing.marketValue + currentValue;
    existing.investmentGain =
      existing.investmentGain === null || unrealizedGainLoss === null
        ? null
        : existing.investmentGain + unrealizedGainLoss;

    if (lot.priceDate && (!existing.priceDate || lot.priceDate > existing.priceDate)) {
      existing.latestPrice = lot.latestPrice;
      existing.priceDate = lot.priceDate;
    }
  }

  return [...holdingsBySecurity.values()]
    .filter((holding) => holding.quantity > 0)
    .map((holding): PortfolioHolding => {
      const totalProfitability =
        holding.marketValue === null
          ? null
          : holding.marketValue +
            holding.saleProceeds +
            holding.dividendsReceived -
            holding.totalAcquisitionCost;
      const xirr = holding.hasUnpricedOpenLot
        ? { value: null }
        : calculateXirr(holding.cashFlows);

      return {
        securityKey: holding.securityKey,
        securityName: holding.securityName,
        quantity: holding.quantity,
        investedCapital: holding.investedCapital,
        latestPrice: holding.latestPrice,
        priceDate: holding.priceDate,
        marketValue: holding.marketValue,
        investmentGain: holding.investmentGain,
        dividendsReceived: holding.dividendsReceived,
        totalProfitability,
        totalReturnPercent:
          totalProfitability === null || holding.totalAcquisitionCost <= 0
            ? null
            : (totalProfitability / holding.totalAcquisitionCost) * 100,
        annualizedReturnPercent: xirr.value,
        currency: holding.currency
      };
    })
    .sort((a, b) => a.securityName.localeCompare(b.securityName));
}

export function calculateSecurityInventory(
  transactions: Transaction[],
  holdings: PortfolioHolding[]
): SecurityInventoryItem[] {
  const holdingsBySecurity = new Map(
    holdings.map((holding) => [holding.securityKey, holding])
  );
  const inventoryBySecurity = new Map<string, SecurityInventoryItem>();

  for (const transaction of transactions) {
    const key = transactionSecurityKey(transaction);
    const existing = inventoryBySecurity.get(key);

    if (!existing) {
      inventoryBySecurity.set(key, {
        user_id: transaction.user_id,
        portfolio_id: transaction.portfolio_id,
        security_key: key,
        security_name: transaction.security_name,
        isin: transaction.isin,
        wkn: transaction.wkn,
        ticker: transaction.ticker,
        exchange: transaction.exchange,
        security_currency: transaction.security_currency,
        asset_type: transaction.asset_type,
        transaction_count: 1,
        first_trade_date: transaction.trade_date,
        last_trade_date: transaction.trade_date,
        ownedQuantity: holdingsBySecurity.get(key)?.quantity ?? 0
      });
      continue;
    }

    existing.transaction_count += 1;

    if (dateTimestamp(transaction.trade_date) < dateTimestamp(existing.first_trade_date)) {
      existing.first_trade_date = transaction.trade_date;
    }

    if (dateTimestamp(transaction.trade_date) >= dateTimestamp(existing.last_trade_date)) {
      existing.security_name = transaction.security_name;
      existing.isin = transaction.isin ?? existing.isin;
      existing.wkn = transaction.wkn ?? existing.wkn;
      existing.ticker = transaction.ticker ?? existing.ticker;
      existing.exchange = transaction.exchange ?? existing.exchange;
      existing.security_currency =
        transaction.security_currency ?? existing.security_currency;
      existing.asset_type = transaction.asset_type ?? existing.asset_type;
      existing.last_trade_date = transaction.trade_date;
    }
  }

  return [...inventoryBySecurity.values()].sort((a, b) =>
    a.security_name.localeCompare(b.security_name)
  );
}

export function buildCurrentAnalytics(
  transactions: Transaction[],
  latestMarketPrices: LatestMarketPrice[],
  manualPrices: ManualSecurityPrice[],
  options: LotCalculationOptions = {}
) {
  const valuationPrices = buildValuationPrices(latestMarketPrices, manualPrices);
  const lots = calculateLotProfitability(transactions, valuationPrices, options);

  return {
    lots,
    holdings: calculatePortfolioHoldings(lots),
    summary: calculatePortfolioSummary(lots, transactions)
  };
}

export function calculatePortfolioDevelopment(
  transactions: Transaction[],
  marketPrices: MarketPrice[],
  interval: ChartInterval,
  options: LotCalculationOptions = {}
): PortfolioDevelopmentPoint[] {
  const dailyPoints = buildPortfolioTimeline(
    transactions.map(toAnalyticsTransaction),
    toAnalyticsPrices(marketPrices),
    options
  )
    .map((point): PortfolioDevelopmentPoint => ({
      date: point.date,
      investedCapital: point.hasCompletePricing
        ? point.currentDeployedCapital
        : point.pricedCurrentDeployedCapital,
      investmentGain: point.unrealizedGain,
      portfolioValue: point.portfolioMarketValue,
      unpricedInvestedCapital: point.unpricedCurrentDeployedCapital,
      unpricedOpenLots: point.missingPriceSecurityKeys.length,
      hasCompletePricing: point.hasCompletePricing,
      dividendsReceived: point.dividendsCollected,
      currency: point.currency
    }))
    .filter((point) => point.investedCapital > 0 || point.portfolioValue > 0);

  const intervalPoints = new Map<string, PortfolioDevelopmentPoint>();

  for (const point of dailyPoints) {
    intervalPoints.set(intervalKey(point.date, interval), point);
  }

  return [...intervalPoints.values()];
}

export function calculateCapitalDeployment(
  transactions: Transaction[],
  interval: ChartInterval
): CapitalDeploymentPoint[] {
  const relevantTransactions = transactions
    .filter((transaction) =>
      ["buy", "sell", "dividend"].includes(transaction.type)
    )
    .sort((a, b) => {
      const dateComparison = dateTimestamp(a.trade_date) - dateTimestamp(b.trade_date);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return a.created_at.localeCompare(b.created_at);
    });
  const points: CapitalDeploymentPoint[] = [];
  let capitalDeployed = 0;
  let dividendsCollected = 0;

  for (const transaction of relevantTransactions) {
    const analyticsTransaction = toAnalyticsTransaction(transaction);

    if (transaction.type === "buy") {
      capitalDeployed += acquisitionCost(analyticsTransaction);
    }

    if (transaction.type === "sell") {
      capitalDeployed -= saleProceeds(analyticsTransaction);
    }

    if (transaction.type === "dividend") {
      dividendsCollected += dividendAmount(analyticsTransaction);
    }

    points.push({
      date: transaction.trade_date,
      capitalDeployed,
      dividendsCollected,
      currency: transaction.currency
    });
  }

  const intervalPoints = new Map<string, CapitalDeploymentPoint>();

  for (const point of points) {
    intervalPoints.set(intervalKey(point.date, interval), point);
  }

  return [...intervalPoints.values()].filter(
    (point) => point.capitalDeployed !== 0 || point.dividendsCollected !== 0
  );
}

export function findSecuritiesWithoutBuyHistory(
  transactions: Transaction[]
): SecurityActivityWithoutBuyHistory[] {
  const activityBySecurity = new Map<
    string,
    SecurityActivityWithoutBuyHistory & { buyCount: number }
  >();

  for (const transaction of transactions) {
    const key = transactionSecurityKey(transaction);
    const existing = activityBySecurity.get(key);
    const activity = existing ?? {
      securityKey: key,
      securityName: transaction.security_name,
      isin: transaction.isin,
      ticker: transaction.ticker,
      buyCount: 0,
      dividendCount: 0,
      sellCount: 0,
      totalDividends: 0,
      latestTransactionDate: transaction.trade_date,
      currency: transaction.currency
    };

    if (transaction.type === "buy") {
      activity.buyCount += 1;
    }

    if (transaction.type === "sell") {
      activity.sellCount += 1;
    }

    if (transaction.type === "dividend") {
      activity.dividendCount += 1;
      activity.totalDividends += cashAmount(transaction);
    }

    if (dateTimestamp(transaction.trade_date) > dateTimestamp(activity.latestTransactionDate)) {
      activity.latestTransactionDate = transaction.trade_date;
    }

    activityBySecurity.set(key, activity);
  }

  return [...activityBySecurity.values()]
    .filter((activity) => activity.buyCount === 0)
    .filter((activity) => activity.dividendCount > 0 || activity.sellCount > 0)
    .map((activity) => ({
      securityKey: activity.securityKey,
      securityName: activity.securityName,
      isin: activity.isin,
      ticker: activity.ticker,
      dividendCount: activity.dividendCount,
      sellCount: activity.sellCount,
      totalDividends: activity.totalDividends,
      latestTransactionDate: activity.latestTransactionDate,
      currency: activity.currency
    }))
    .sort((a, b) => a.securityName.localeCompare(b.securityName));
}
