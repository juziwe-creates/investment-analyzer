import "server-only";
import { calculateCapitalDeployment, calculatePortfolioDevelopment, transactionSecurityKey } from "./portfolio";
import { eurAggregationStatus } from "./currency";
import { readMarketHistory } from "@/lib/market-data/history";
import { marketDataCurrency } from "@/lib/market-data/currency";
import { measureAnalytics } from "@/lib/performance";
import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export async function loadDashboardHistory(transactions: Transaction[], portfolioId: string | undefined, currencyReady: boolean) {
  try {
    const keys = new Set(transactions.map(transactionSecurityKey));
    const result = currencyReady && keys.size ? await readMarketHistory(portfolioId, keys.size === 1 ? [...keys][0] : undefined) : { data: [], error: null };
    if (result.error) throw new Error("Historical prices could not be loaded.");
    const prices = result.data.filter((price) => keys.has(price.security_key));
    const ready = currencyReady && eurAggregationStatus(prices.map((price) => marketDataCurrency({ fallbackCurrency: price.currency, providerId: price.provider, providerSymbol: price.provider_symbol }))).canAggregate;
    return await measureAnalytics("dashboard.history.calculate", () => ({
      development: ready ? calculatePortfolioDevelopment(transactions, prices, "daily") : [],
      deployment: ready ? calculateCapitalDeployment(transactions, "daily") : [],
      error: ready ? null : "Portfolio history is unavailable until EUR conversion is defined."
    }));
  } catch {
    return { development: [], deployment: [], error: "Portfolio history could not be loaded. Reload the page to retry." };
  }
}
