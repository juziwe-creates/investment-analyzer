import { MarketDataSyncTable } from "@/components/market-data-sync-table";
import {
  buildCurrentAnalytics,
  calculateSecurityInventory
} from "@/lib/analytics/portfolio";
import { configuredMarketDataProviderId } from "@/lib/market-data";
import { createClient } from "@/lib/supabase/server";

export default async function MarketDataPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const providerId = configuredMarketDataProviderId();
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
  const providerSymbolsQuery = supabase
    .from("security_provider_symbols")
    .select(
      "id,user_id,portfolio_id,security_key,provider,provider_symbol,source,notes,resolved_at,created_at,updated_at"
    )
    .eq("provider", providerId);
  const syncRunsQuery = supabase
    .from("market_data_sync_runs")
    .select(
      "id,user_id,portfolio_id,security_key,provider,provider_symbol,status,prices_imported,dividends_imported,error_message,started_at,finished_at,created_at"
    )
    .eq("provider", providerId)
    .order("created_at", { ascending: false })
    .limit(100);
  const transactionsQuery = supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });
  const [
    { data: manualPrices, error: manualPricesError },
    { data: marketPrices, error: marketPricesError },
    { data: providerSymbols, error: providerSymbolsError },
    { data: syncRuns, error: syncRunsError },
    { data: transactions, error: transactionsError }
  ] = await Promise.all([
    manualPricesQuery,
    marketPricesQuery,
    providerSymbolsQuery,
    syncRunsQuery,
    transactionsQuery
  ]);
  const { holdings } = buildCurrentAnalytics(
    transactions ?? [],
    marketPrices ?? [],
    manualPrices ?? []
  );
  const securities = calculateSecurityInventory(transactions ?? [], holdings);
  const firstError =
    manualPricesError ??
    marketPricesError ??
    providerSymbolsError ??
    syncRunsError ??
    transactionsError;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Market Data</h2>
        <p className="text-muted-foreground">
          Manage provider symbols and sync historical prices without wasting API calls.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border bg-background p-4">
          <p className="text-sm text-muted-foreground">Active provider</p>
          <p className="mt-1 text-xl font-semibold">{providerId}</p>
        </div>
        <div className="rounded-md border bg-background p-4">
          <p className="text-sm text-muted-foreground">Sync mode</p>
          <p className="mt-1 text-xl font-semibold">One security</p>
        </div>
        <div className="rounded-md border bg-background p-4">
          <p className="text-sm text-muted-foreground">Estimated calls</p>
          <p className="mt-1 text-xl font-semibold">2 per sync</p>
        </div>
      </div>

      {message ? (
        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      {firstError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {firstError.message}
        </div>
      ) : (
        <MarketDataSyncTable
          providerId={providerId}
          securities={securities}
          providerSymbols={providerSymbols ?? []}
          marketPrices={marketPrices ?? []}
          syncRuns={syncRuns ?? []}
        />
      )}
    </div>
  );
}
