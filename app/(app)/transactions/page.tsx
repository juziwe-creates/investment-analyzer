import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { ProfitabilityTable } from "@/components/profitability-table";
import { buildCurrentAnalytics } from "@/lib/analytics/portfolio";
import { createClient } from "@/lib/supabase/server";

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });
  const { data: recentTransactions, error: recentTransactionsError } = await supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  const { data: prices, error: pricesError } = await supabase
    .from("manual_security_prices")
    .select("*");
  const { data: marketPrices, error: marketPricesError } = await supabase
    .from("latest_market_prices")
    .select("*");
  const { lots: profitabilityLots } = buildCurrentAnalytics(
    transactions ?? [],
    marketPrices ?? [],
    prices ?? []
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Transactions</h2>
        <p className="text-muted-foreground">
          Your private event log. Portfolio, dividends, securities, and analytics derive from this.
        </p>
      </div>

      {message ? (
        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      {error || recentTransactionsError || pricesError || marketPricesError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error?.message ??
            recentTransactionsError?.message ??
            pricesError?.message ??
            marketPricesError?.message}
        </div>
      ) : null}

      <ProfitabilityTable lots={profitabilityLots} />
      <TransactionForm />
      <TransactionList transactions={recentTransactions ?? []} />
    </div>
  );
}
