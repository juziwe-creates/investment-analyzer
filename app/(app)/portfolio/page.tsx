import { Suspense } from "react";
import { presentationTransactions } from "@/lib/presentation";
import { InvestmentInventoryTable } from "@/components/investment-inventory-table";
import { MissingBuyHistoryTable } from "@/components/missing-buy-history-table";
import {
  buildCurrentAnalytics,
  findSecuritiesWithoutBuyHistory
} from "@/lib/analytics/portfolio";
import { calculateStockAnalytics } from "@/lib/analytics/transaction-analytics";
import { createClient } from "@/lib/supabase/server";

export default async function PortfolioPage({
  searchParams
}: {
  searchParams: Promise<{ portfolio?: string }>;
}) {
  const { portfolio: portfolioId } = await searchParams;
  const supabase = await createClient();
  const transactionsQuery = presentationTransactions(portfolioId);
  const latestMarketPricesQuery = supabase
    .from("latest_market_prices")
    .select("*");
  const manualPricesQuery = supabase
    .from("manual_security_prices")
    .select("*");
  if (portfolioId) {
    latestMarketPricesQuery.eq("portfolio_id", portfolioId);
    manualPricesQuery.eq("portfolio_id", portfolioId);
  }
  const [
    { data: transactions, error: transactionsError },
    { data: latestMarketPrices, error: latestPricesError },
    { data: manualPrices, error: manualPricesError }
  ] = await Promise.all([
    transactionsQuery,
    latestMarketPricesQuery,
    manualPricesQuery
  ]);
  const errors = [transactionsError, latestPricesError, manualPricesError].filter(Boolean);
  const { lots } = buildCurrentAnalytics(
    transactions ?? [],
    latestMarketPrices ?? [],
    manualPrices ?? []
  );
  const investmentRows = calculateStockAnalytics(lots);
  const missingBuyHistory = findSecuritiesWithoutBuyHistory(transactions ?? []);

  return (
    <div className="space-y-8">
      <header className="border-b border-border/70 pb-6">
        <p className="alpha-kpi-label">Investment inventory</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em]">Investments</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Search current and closed investments, then open one to inspect its complete decision history.
        </p>
      </header>

      {errors.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors[0]?.message}
        </div>
      ) : null}

      <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-muted" />}>
        <InvestmentInventoryTable rows={investmentRows} />
      </Suspense>
      <MissingBuyHistoryTable securities={missingBuyHistory} />
    </div>
  );
}
