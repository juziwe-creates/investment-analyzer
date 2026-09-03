import { SecurityList } from "@/components/security-list";
import {
  buildCurrentAnalytics,
  calculateSecurityInventory
} from "@/lib/analytics/portfolio";
import { createClient } from "@/lib/supabase/server";

export default async function SecuritiesPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const manualPricesQuery = supabase
    .from("manual_security_prices")
    .select(
      "id,user_id,portfolio_id,security_key,security_name,isin,ticker,price,currency,price_date,created_at,updated_at"
    );
  const marketPricesQuery = supabase
    .from("latest_market_prices")
    .select(
      "id,user_id,portfolio_id,security_key,security_name,isin,ticker,provider,provider_symbol,price_date,close_price,adjusted_close_price,currency,created_at,updated_at"
    );
  const transactionsQuery = supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });
  const [
    { data: prices, error: pricesError },
    { data: marketPrices, error: marketPricesError },
    { data: transactions, error: transactionsError }
  ] = await Promise.all([manualPricesQuery, marketPricesQuery, transactionsQuery]);
  const { holdings } = buildCurrentAnalytics(
    transactions ?? [],
    marketPrices ?? [],
    prices ?? []
  );
  const securities = calculateSecurityInventory(transactions ?? [], holdings);

  return (
    <div className="space-y-8">
      <div>
        <p className="alpha-kpi-label">Security universe</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-foreground">
          Securities
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A read-only lookup derived from your transactions. No manual security catalog needed.
        </p>
      </div>

      {message ? (
        <div className="alpha-surface px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      {pricesError || marketPricesError || transactionsError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {pricesError?.message ??
            marketPricesError?.message ??
            transactionsError?.message}
        </div>
      ) : null}

      <SecurityList
        securities={securities}
        prices={prices ?? []}
        marketPrices={marketPrices ?? []}
      />
    </div>
  );
}
