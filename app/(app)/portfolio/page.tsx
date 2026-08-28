import { PortfolioHoldingsTable } from "@/components/portfolio-holdings-table";
import { buildCurrentAnalytics } from "@/lib/analytics/portfolio";
import { createClient } from "@/lib/supabase/server";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });
  const { data: latestMarketPrices, error: latestPricesError } = await supabase
    .from("latest_market_prices")
    .select("*");
  const { data: manualPrices, error: manualPricesError } = await supabase
    .from("manual_security_prices")
    .select("*");
  const errors = [transactionsError, latestPricesError, manualPricesError].filter(Boolean);
  const { holdings } = buildCurrentAnalytics(
    transactions ?? [],
    latestMarketPrices ?? [],
    manualPrices ?? []
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Portfolio</h2>
        <p className="text-muted-foreground">
          Current holdings calculated from transactions and latest available prices.
        </p>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors[0]?.message}
        </div>
      ) : null}

      <PortfolioHoldingsTable holdings={holdings} />
    </div>
  );
}
