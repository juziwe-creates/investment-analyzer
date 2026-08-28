import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type ManualSecurityPrice = Database["public"]["Tables"]["manual_security_prices"]["Row"];
type LatestMarketPrice = Database["public"]["Views"]["latest_market_prices"]["Row"];

export type ValuationPrice = {
  security_key: string;
  price: number;
  price_date: string;
  currency: string;
  source: "market" | "manual";
};

export type LotProfitability = {
  id: string;
  tradeDate: string;
  securityKey: string;
  securityName: string;
  type: "buy";
  quantity: number;
  remainingQuantity: number;
  costBasis: number;
  remainingCostBasis: number;
  latestPrice: number | null;
  priceSource: "market" | "manual" | null;
  priceDate: string | null;
  currentValue: number | null;
  unrealizedGainLoss: number | null;
  accumulatedDividends: number;
  totalProfitability: number | null;
  totalReturnPercent: number | null;
  annualizedReturnPercent: number | null;
  currency: string;
};

function securityKey(transaction: Pick<Transaction, "isin" | "ticker" | "security_name">) {
  return transaction.isin ?? transaction.ticker ?? transaction.security_name;
}

function numeric(value: number | null) {
  return value ?? 0;
}

function costBasis(transaction: Transaction) {
  if (transaction.net_amount !== null) {
    return Math.abs(transaction.net_amount);
  }

  if (transaction.gross_amount !== null) {
    return Math.abs(transaction.gross_amount);
  }

  return numeric(transaction.quantity) * numeric(transaction.unit_price);
}

function cashAmount(transaction: Transaction) {
  if (transaction.net_amount !== null) {
    return Math.abs(transaction.net_amount);
  }

  if (transaction.gross_amount !== null) {
    return Math.abs(transaction.gross_amount);
  }

  return 0;
}

function yearsBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return (end - start) / (1000 * 60 * 60 * 24 * 365.25);
}

function annualizedReturnPercent(
  costBasisValue: number,
  totalProfitability: number,
  startDate: string,
  endDate: string
) {
  const years = yearsBetween(startDate, endDate);
  const growthMultiple = (costBasisValue + totalProfitability) / costBasisValue;

  if (costBasisValue <= 0 || years <= 0 || growthMultiple <= 0) {
    return null;
  }

  return (growthMultiple ** (1 / years) - 1) * 100;
}

export function calculateLotProfitability(
  transactions: Transaction[],
  prices: ValuationPrice[]
) {
  const pricesBySecurity = new Map(prices.map((price) => [price.security_key, price]));
  const lots: LotProfitability[] = [];

  const chronologicalTransactions = [...transactions].sort((a, b) => {
    if (a.trade_date === b.trade_date) {
      return a.created_at.localeCompare(b.created_at);
    }

    return a.trade_date.localeCompare(b.trade_date);
  });

  for (const transaction of chronologicalTransactions) {
    const key = securityKey(transaction);

    if (transaction.type === "buy") {
      const quantity = numeric(transaction.quantity);
      const basis = costBasis(transaction);

      lots.push({
        id: transaction.id,
        tradeDate: transaction.trade_date,
        securityKey: key,
        securityName: transaction.security_name,
        type: "buy",
        quantity,
        remainingQuantity: quantity,
        costBasis: basis,
        remainingCostBasis: basis,
        latestPrice: null,
        priceSource: null,
        priceDate: null,
        currentValue: null,
        unrealizedGainLoss: null,
        accumulatedDividends: 0,
        totalProfitability: null,
        totalReturnPercent: null,
        annualizedReturnPercent: null,
        currency: transaction.currency
      });

      continue;
    }

    if (transaction.type === "sell") {
      let quantityToSell = numeric(transaction.quantity);
      const matchingLots = lots.filter(
        (lot) => lot.securityKey === key && lot.remainingQuantity > 0
      );

      for (const lot of matchingLots) {
        if (quantityToSell <= 0) {
          break;
        }

        const consumedQuantity = Math.min(lot.remainingQuantity, quantityToSell);
        const consumedRatio = lot.remainingQuantity > 0 ? consumedQuantity / lot.remainingQuantity : 0;

        lot.remainingQuantity -= consumedQuantity;
        lot.remainingCostBasis -= lot.remainingCostBasis * consumedRatio;
        quantityToSell -= consumedQuantity;
      }

      continue;
    }

    if (transaction.type === "dividend") {
      const dividendAmount = cashAmount(transaction);
      const eligibleLots = lots.filter(
        (lot) =>
          lot.securityKey === key &&
          lot.tradeDate <= transaction.trade_date &&
          lot.remainingQuantity > 0
      );
      const totalEligibleQuantity = eligibleLots.reduce(
        (sum, lot) => sum + lot.remainingQuantity,
        0
      );

      if (totalEligibleQuantity <= 0) {
        continue;
      }

      for (const lot of eligibleLots) {
        lot.accumulatedDividends +=
          dividendAmount * (lot.remainingQuantity / totalEligibleQuantity);
      }
    }
  }

  for (const lot of lots) {
    const price = pricesBySecurity.get(lot.securityKey);

    if (!price) {
      continue;
    }

    lot.latestPrice = price.price;
    lot.priceSource = price.source;
    lot.priceDate = price.price_date;
    lot.currentValue = lot.remainingQuantity * price.price;
    lot.unrealizedGainLoss = lot.currentValue - lot.remainingCostBasis;
    lot.totalProfitability = lot.unrealizedGainLoss + lot.accumulatedDividends;
    lot.totalReturnPercent =
      lot.costBasis > 0 ? (lot.totalProfitability / lot.costBasis) * 100 : null;
    lot.annualizedReturnPercent = annualizedReturnPercent(
      lot.costBasis,
      lot.totalProfitability,
      lot.tradeDate,
      price.price_date
    );
    lot.currency = price.currency;
  }

  return lots.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
}

export function buildValuationPrices(
  marketPrices: LatestMarketPrice[],
  manualPrices: ManualSecurityPrice[]
): ValuationPrice[] {
  const pricesBySecurity = new Map<string, ValuationPrice>();

  for (const manualPrice of manualPrices) {
    pricesBySecurity.set(manualPrice.security_key, {
      security_key: manualPrice.security_key,
      price: manualPrice.price,
      price_date: manualPrice.price_date,
      currency: manualPrice.currency,
      source: "manual"
    });
  }

  for (const marketPrice of marketPrices) {
    pricesBySecurity.set(marketPrice.security_key, {
      security_key: marketPrice.security_key,
      price: marketPrice.adjusted_close_price ?? marketPrice.close_price,
      price_date: marketPrice.price_date,
      currency: marketPrice.currency,
      source: "market"
    });
  }

  return [...pricesBySecurity.values()];
}
