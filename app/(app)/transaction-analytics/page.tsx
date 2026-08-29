import { TransactionAnalyticsTable } from "@/components/transaction-analytics-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCurrentAnalytics } from "@/lib/analytics/portfolio";
import { calculateTransactionAnalytics } from "@/lib/analytics/transaction-analytics";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

export default async function TransactionAnalyticsPage() {
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
    manualPrices ?? []
  );
  const rows = calculateTransactionAnalytics(lots);
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
    { label: "Purchase decisions", value: rows.length.toString() },
    {
      label: "Dividends after tax",
      value: formatCurrency(totalAfterTaxDividends, currency)
    },
    {
      label: "Priced raw profit",
      value: formatCurrency(pricedRawProfit, currency)
    },
    {
      label: "Best annualized return",
      value: formatPercent(bestAnnualizedReturn)
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Transaction Analytics</h2>
        <p className="text-muted-foreground">
          Purchase-level profitability with dividends attributed back to the buy lots that
          earned them.
        </p>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors[0]?.message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
        Raw profitability uses current value plus sale proceeds plus after-tax dividends,
        minus original acquisition cost. Dividend tax assumption: 71.575% retained.
      </div>

      <TransactionAnalyticsTable rows={rows} />
    </div>
  );
}
