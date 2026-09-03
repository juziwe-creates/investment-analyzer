import { MissingBuyHistoryTable } from "@/components/missing-buy-history-table";
import { PortfolioHoldingsTable } from "@/components/portfolio-holdings-table";
import {
  buildCurrentAnalytics,
  findSecuritiesWithoutBuyHistory
} from "@/lib/analytics/portfolio";
import { createClient } from "@/lib/supabase/server";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const transactionsQuery = supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });
  const latestMarketPricesQuery = supabase
    .from("latest_market_prices")
    .select("*");
  const manualPricesQuery = supabase
    .from("manual_security_prices")
    .select("*");
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
  const { holdings } = buildCurrentAnalytics(
    transactions ?? [],
    latestMarketPrices ?? [],
    manualPrices ?? []
  );
  const missingBuyHistory = findSecuritiesWithoutBuyHistory(transactions ?? []);

  return (
    <div className="space-y-8">
      <header className="border-b border-border/70 pb-6">
        <p className="alpha-kpi-label">Investment inventory</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em]">Investments</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Current holdings calculated from transactions and latest available prices.
        </p>
      </header>

      {errors.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors[0]?.message}
        </div>
      ) : null}

      <PortfolioHoldingsTable holdings={holdings} />
      <MissingBuyHistoryTable securities={missingBuyHistory} />
    </div>
  );
}
