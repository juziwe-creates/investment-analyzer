import {
  buildValuationPrices,
  calculateLotProfitability,
  type LotProfitability,
  type ValuationPrice
} from "@/lib/analytics/profitability";
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
  currency: string;
};

export type PortfolioDevelopmentPoint = {
  date: string;
  investedCapital: number;
  investmentGain: number;
  portfolioValue: number;
  dividendsReceived: number;
  currency: string;
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

function intervalKey(date: string, interval: ChartInterval) {
  const parsedDate = new Date(`${date}T00:00:00Z`);
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

export function parseChartInterval(value: string | undefined): ChartInterval {
  return value === "weekly" || value === "monthly" ? value : "daily";
}

export function calculatePortfolioSummary(
  lots: LotProfitability[],
  transactions: Transaction[]
): PortfolioSummary {
  const investedCapital = lots.reduce((sum, lot) => sum + lot.remainingCostBasis, 0);
  const portfolioValue = lots.reduce(
    (sum, lot) => (lot.currentValue === null ? sum : sum + lot.currentValue),
    0
  );
  const hasPortfolioValue = lots.some((lot) => lot.currentValue !== null);
  const dividendsReceived = transactions
    .filter((transaction) => transaction.type === "dividend")
    .reduce((sum, transaction) => sum + cashAmount(transaction), 0);
  const investmentGain = hasPortfolioValue ? portfolioValue - investedCapital : null;

  return {
    portfolioValue: hasPortfolioValue ? portfolioValue : null,
    investedCapital,
    investmentGain,
    dividendsReceived,
    totalProfitability: investmentGain === null ? null : investmentGain + dividendsReceived,
    currency: lots[0]?.currency ?? transactions[0]?.currency ?? "EUR"
  };
}

export function calculatePortfolioHoldings(lots: LotProfitability[]): PortfolioHolding[] {
  const holdingsBySecurity = new Map<string, PortfolioHolding>();

  for (const lot of lots) {
    if (lot.remainingQuantity <= 0) {
      continue;
    }

    const existing = holdingsBySecurity.get(lot.securityKey);

    if (!existing) {
      holdingsBySecurity.set(lot.securityKey, {
        securityKey: lot.securityKey,
        securityName: lot.securityName,
        quantity: lot.remainingQuantity,
        investedCapital: lot.remainingCostBasis,
        latestPrice: lot.latestPrice,
        priceDate: lot.priceDate,
        marketValue: lot.currentValue,
        investmentGain: lot.unrealizedGainLoss,
        dividendsReceived: lot.accumulatedDividends,
        totalProfitability: lot.totalProfitability,
        currency: lot.currency
      });
      continue;
    }

    existing.quantity += lot.remainingQuantity;
    existing.investedCapital += lot.remainingCostBasis;
    existing.marketValue =
      existing.marketValue === null || lot.currentValue === null
        ? null
        : existing.marketValue + lot.currentValue;
    existing.investmentGain =
      existing.investmentGain === null || lot.unrealizedGainLoss === null
        ? null
        : existing.investmentGain + lot.unrealizedGainLoss;
    existing.dividendsReceived += lot.accumulatedDividends;
    existing.totalProfitability =
      existing.totalProfitability === null || lot.totalProfitability === null
        ? null
        : existing.totalProfitability + lot.totalProfitability;

    if (lot.priceDate && (!existing.priceDate || lot.priceDate > existing.priceDate)) {
      existing.latestPrice = lot.latestPrice;
      existing.priceDate = lot.priceDate;
    }
  }

  return [...holdingsBySecurity.values()].sort((a, b) =>
    a.securityName.localeCompare(b.securityName)
  );
}

export function buildCurrentAnalytics(
  transactions: Transaction[],
  latestMarketPrices: LatestMarketPrice[],
  manualPrices: ManualSecurityPrice[]
) {
  const valuationPrices = buildValuationPrices(latestMarketPrices, manualPrices);
  const lots = calculateLotProfitability(transactions, valuationPrices);

  return {
    lots,
    holdings: calculatePortfolioHoldings(lots),
    summary: calculatePortfolioSummary(lots, transactions)
  };
}

function valuationPricesForDate(
  prices: MarketPrice[],
  date: string,
  currency: string
): ValuationPrice[] {
  const latestBySecurity = new Map<string, MarketPrice>();

  for (const price of prices) {
    if (price.price_date > date) {
      continue;
    }

    const existing = latestBySecurity.get(price.security_key);

    if (!existing || price.price_date > existing.price_date) {
      latestBySecurity.set(price.security_key, price);
    }
  }

  return [...latestBySecurity.values()].map((price) => ({
    security_key: price.security_key,
    price: price.adjusted_close_price ?? price.close_price,
    price_date: price.price_date,
    currency: price.currency || currency,
    source: "market"
  }));
}

export function calculatePortfolioDevelopment(
  transactions: Transaction[],
  marketPrices: MarketPrice[],
  interval: ChartInterval
): PortfolioDevelopmentPoint[] {
  const dates = [...new Set(marketPrices.map((price) => price.price_date))].sort();
  const baseCurrency = transactions[0]?.currency ?? marketPrices[0]?.currency ?? "EUR";
  const dailyPoints = dates
    .map((date) => {
      const transactionsUntilDate = transactions.filter(
        (transaction) => transaction.trade_date <= date
      );
      const valuationPrices = valuationPricesForDate(marketPrices, date, baseCurrency);
      const lots = calculateLotProfitability(transactionsUntilDate, valuationPrices);
      const summary = calculatePortfolioSummary(lots, transactionsUntilDate);

      if (summary.portfolioValue === null || summary.investmentGain === null) {
        return null;
      }

      return {
        date,
        investedCapital: summary.investedCapital,
        investmentGain: summary.investmentGain,
        portfolioValue: summary.portfolioValue,
        dividendsReceived: summary.dividendsReceived,
        currency: summary.currency
      };
    })
    .filter((point): point is PortfolioDevelopmentPoint => Boolean(point));

  const intervalPoints = new Map<string, PortfolioDevelopmentPoint>();

  for (const point of dailyPoints) {
    intervalPoints.set(intervalKey(point.date, interval), point);
  }

  return [...intervalPoints.values()];
}
