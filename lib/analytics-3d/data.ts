import "server-only";
import { presentationEnabled, presentationTransactions } from "@/lib/presentation";
import { createClient } from "@/lib/supabase/server";
import { buildCurrentAnalytics, transactionSecurityKey } from "@/lib/analytics/portfolio";
import { buildInvestmentLedger } from "@/lib/analytics/engine";
import { eurAggregationStatus } from "@/lib/analytics/currency";
import { marketDataCurrency } from "@/lib/market-data/currency";
import { universeModel } from "./model";

export async function loadUniverse(portfolio?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  const asOfDate = new Date().toISOString().slice(0, 10);
  const latestQuery = supabase.from("latest_market_prices").select("*");
  const manualQuery = supabase.from("manual_security_prices").select("*");
  if (portfolio) { latestQuery.eq("portfolio_id", portfolio); manualQuery.eq("portfolio_id", portfolio); }
  const [transactionsResult, latestResult, manualResult, accountsResult, presenting] = await Promise.all([
    presentationTransactions(portfolio), latestQuery, manualQuery,
    supabase.from("portfolios").select("id,name").order("created_at"), presentationEnabled()
  ]);
  if (transactionsResult.error || latestResult.error || manualResult.error || accountsResult.error) throw new Error("Portfolio data could not be loaded.");
  const accounts = accountsResult.data ?? [];
  const accountIndex = accounts.findIndex((account) => account.id === portfolio);
  if (portfolio && accountIndex < 0) throw new Error("Account is unavailable.");
  const transactions = transactionsResult.data.filter((transaction) => transaction.trade_date <= asOfDate);
  const keys = new Set(transactions.map(transactionSecurityKey));
  const latest = (latestResult.data ?? []).filter((price) => keys.has(price.security_key) && price.price_date <= asOfDate);
  const manual = (manualResult.data ?? []).filter((price) => keys.has(price.security_key) && price.price_date <= asOfDate);
  const { holdings } = buildCurrentAnalytics(transactions, latest, manual);
  const inventoryComplete = buildInvestmentLedger(transactions).at(-1)?.complete ?? true;
  const currencyReady = eurAggregationStatus([
    ...transactions.map((row) => row.currency), ...manual.map((row) => row.currency),
    ...latest.map((row) => marketDataCurrency({ fallbackCurrency: row.currency, providerId: row.provider, providerSymbol: row.provider_symbol }))
  ]).canAggregate;
  return { ...universeModel({ holdings, asOfDate, portfolio, currencyReady, inventoryComplete,
    account: portfolio ? presenting ? `Account ${accountIndex + 1}` : accounts[accountIndex].name : "All accounts",
    metadata: new Map(transactions.map((row) => [transactionSecurityKey(row), { ticker: row.ticker }]))
  }), presentation: presenting };
}
