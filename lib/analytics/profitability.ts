import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type ManualSecurityPrice = Database["public"]["Tables"]["manual_security_prices"]["Row"];

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
  priceDate: string | null;
  currentValue: number | null;
  unrealizedGainLoss: number | null;
  accumulatedDividends: number;
  totalProfitability: number | null;
  totalReturnPercent: number | null;
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

export function calculateLotProfitability(
  transactions: Transaction[],
  prices: ManualSecurityPrice[]
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
        priceDate: null,
        currentValue: null,
        unrealizedGainLoss: null,
        accumulatedDividends: 0,
        totalProfitability: null,
        totalReturnPercent: null,
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
    lot.priceDate = price.price_date;
    lot.currentValue = lot.remainingQuantity * price.price;
    lot.unrealizedGainLoss = lot.currentValue - lot.remainingCostBasis;
    lot.totalProfitability = lot.unrealizedGainLoss + lot.accumulatedDividends;
    lot.totalReturnPercent =
      lot.costBasis > 0 ? (lot.totalProfitability / lot.costBasis) * 100 : null;
    lot.currency = price.currency;
  }

  return lots.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
}

