import { StockAnalyticsTable } from "@/components/stock-analytics-table";
import { buildCurrentAnalytics } from "@/lib/analytics/portfolio";
import { calculateStockAnalytics } from "@/lib/analytics/transaction-analytics";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

export default async function StockAnalyticsPage() {
  const supabase = await createClient();
  const transactionsQuery = supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: true })
    .order("created_at", { ascending: true });
  const latestMarketPricesQuery = supabase.from("latest_market_prices").select("*");
  const manualPricesQuery = supabase.from("manual_security_prices").select("*");
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
    manualPrices ?? [],
    { lotMatchingMethod: "lifo" }
  );
  const rows = calculateStockAnalytics(lots);
  const currency = rows[0]?.currency ?? "EUR";
  const pricedRows = rows.filter((row) => row.totalRawProfitability !== null);
  const totalAfterTaxDividends = rows.reduce(
    (sum, row) => sum + row.accumulatedDividendsAfterTax,
    0
  );
  const pricedRawProfit = pricedRows.reduce(
    (sum, row) => sum + (row.totalRawProfitability ?? 0),
    0
  );
  const bestAnnualizedReturn =
    rows
      .map((row) => row.totalRawProfitabilityAnnualizedPercent)
      .filter((value): value is number => value !== null)
      .sort((a, b) => b - a)[0] ?? null;
  const metrics = [
    { label: "Stocks analyzed", value: rows.length.toString() },
    {
      label: "Dividends after tax",
      value: formatCurrency(totalAfterTaxDividends, currency)
    },
    {
      label: "Priced raw profit",
      value: formatCurrency(pricedRawProfit, currency)
    },
    {
      label: "Best annualized stock",
      value: formatPercent(bestAnnualizedReturn)
    }
  ];

  return (
    <div className="space-y-8">
      <header className="border-b border-border/70 pb-6">
        <p className="alpha-kpi-label">Investment analytics</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em]">Stock Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Security-level profitability aggregated from the same buy-lot calculations used
          by transaction analytics.
        </p>
      </header>

      {errors.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors[0]?.message}
        </div>
      ) : null}

      <section className="grid gap-6 border-b border-border/70 pb-7 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="alpha-kpi-label">{metric.label}</p>
            <p className="mt-2 text-2xl font-medium tracking-[-0.02em]">{metric.value}</p>
          </div>
        ))}
      </section>

      <div className="alpha-surface px-4 py-3 text-sm leading-6 text-muted-foreground">
        Stock totals reconcile with the transaction analytics rows. Raw profitability uses
        current value plus sale proceeds plus after-tax dividends, minus acquisition cost.
      </div>

      <StockAnalyticsTable rows={rows} />
    </div>
  );
}
