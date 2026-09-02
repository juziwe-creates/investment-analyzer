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
  searchParams: Promise<{ filter?: string; message?: string; q?: string }>;
}) {
  const { filter, message, q } = await searchParams;
  const providerId = configuredMarketDataProviderId();
  const supabase = await createClient();
  // This operational counter should reflect the current request time.
  // eslint-disable-next-line react-hooks/purity
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const manualPricesQuery = supabase
    .from("manual_security_prices")
    .select(
      "id,user_id,portfolio_id,security_key,security_name,isin,ticker,price,currency,price_date,created_at,updated_at"
    );
  const marketPricesQuery = supabase
    .from("latest_provider_market_prices")
    .select(
      "id,user_id,portfolio_id,security_key,security_name,isin,ticker,provider,provider_symbol,price_date,close_price,adjusted_close_price,currency,created_at,updated_at"
    )
    .eq("provider", providerId);
  const priceCoverageQuery = supabase
    .from("market_price_coverage")
    .select(
      "user_id,portfolio_id,security_key,provider,price_count,first_price_date,latest_price_date,latest_updated_at"
    )
    .eq("provider", providerId);
  const dividendCoverageQuery = supabase
    .from("market_dividend_coverage")
    .select(
      "user_id,portfolio_id,security_key,provider,dividend_count,first_ex_dividend_date,latest_ex_dividend_date,latest_updated_at"
    )
    .eq("provider", providerId);
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
  const recentSyncRunsQuery = supabase
    .from("market_data_sync_runs")
    .select("status,created_at")
    .eq("provider", providerId)
    .gte("created_at", oneHourAgo)
    .limit(1000);
  const transactionsQuery = supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });
  const [
    { data: manualPrices, error: manualPricesError },
    { data: marketPrices, error: marketPricesError },
    { data: priceCoverage, error: priceCoverageError },
    { data: dividendCoverage, error: dividendCoverageError },
    { data: providerSymbols, error: providerSymbolsError },
    { data: syncRuns, error: syncRunsError },
    { data: recentSyncRuns, error: recentSyncRunsError },
    { data: transactions, error: transactionsError }
  ] = await Promise.all([
    manualPricesQuery,
    marketPricesQuery,
    priceCoverageQuery,
    dividendCoverageQuery,
    providerSymbolsQuery,
    syncRunsQuery,
    recentSyncRunsQuery,
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
    priceCoverageError ??
    dividendCoverageError ??
    providerSymbolsError ??
    syncRunsError ??
    recentSyncRunsError ??
    transactionsError;
  const estimatedApiCallsLastHour = (recentSyncRuns ?? []).reduce(
    (total, run) =>
      total +
      (run.status === "completed" || run.status === "completed_with_errors" ? 2 : 1),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Market Data</h2>
        <p className="text-muted-foreground">
          Manage provider symbols and sync historical prices without wasting API calls.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
        <div className="rounded-md border bg-background p-4">
          <p className="text-sm text-muted-foreground">Est. calls last hour</p>
          <p className="mt-1 text-xl font-semibold">{estimatedApiCallsLastHour}</p>
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
          filter={filter}
          providerId={providerId}
          query={q}
          securities={securities}
          providerSymbols={providerSymbols ?? []}
          marketPrices={marketPrices ?? []}
          priceCoverage={priceCoverage ?? []}
          dividendCoverage={dividendCoverage ?? []}
          syncRuns={syncRuns ?? []}
        />
      )}
    </div>
  );
}
