"use server";

import { createClient } from "@/lib/supabase/server";
import { presentationEnabled, presentationTransactions } from "@/lib/presentation";
import { readMarketHistory } from "@/lib/market-data/history";
import { toAnalyticsPrices } from "@/lib/analytics/portfolio";
import { eurAggregationStatus } from "@/lib/analytics/currency";
import { buildUniverseHistory, type UniverseHistory } from "@/lib/analytics-3d/history";

export async function loadUniverseHistory(portfolio: string | undefined, expectedPresentation: boolean): Promise<{ history: UniverseHistory | null; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Authentication required.");
    if (await presentationEnabled() !== expectedPresentation) return { history: null, error: "Presentation settings changed. Reload before loading history." };
    if (portfolio) {
      const { data, error } = await supabase.from("portfolios").select("id").eq("id", portfolio).single();
      if (error || !data) throw new Error("Account unavailable.");
    }
    const [transactions, history] = await Promise.all([presentationTransactions(portfolio), readMarketHistory(portfolio)]);
    if (transactions.error || history.error) throw new Error("History unavailable.");
    const today = new Date().toISOString().slice(0, 10);
    const rows = transactions.data.filter((row) => row.trade_date <= today);
    const keys = new Set(rows.map((row) => row.isin ?? row.ticker ?? row.security_name));
    const prices = toAnalyticsPrices(history.data.filter((row) => keys.has(row.security_key) && row.price_date <= today));
    const currencyReady = eurAggregationStatus([...rows.map((row) => row.currency), ...prices.map((row) => row.currency)]).canAggregate;
    return { history: buildUniverseHistory({ transactions: rows, prices, today, portfolio, currencyReady }), error: null };
  } catch {
    return { history: null, error: "Portfolio history could not be loaded. Try again or reload the page." };
  }
}
