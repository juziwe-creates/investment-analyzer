import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioDevelopmentChart } from "@/components/portfolio-development-chart";
import {
  buildCurrentAnalytics,
  calculatePortfolioDevelopment,
  parseChartInterval,
  type ChartInterval
} from "@/lib/analytics/portfolio";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

const intervals: { label: string; value: ChartInterval }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" }
];

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const { interval: rawInterval } = await searchParams;
  const interval = parseChartInterval(rawInterval);
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
  const { data: marketPrices, error: marketPricesError } = await supabase
    .from("market_prices")
    .select("*")
    .order("price_date", { ascending: true });
  const errors = [
    transactionsError,
    latestPricesError,
    manualPricesError,
    marketPricesError
  ].filter(Boolean);
  const { holdings, summary } = buildCurrentAnalytics(
    transactions ?? [],
    latestMarketPrices ?? [],
    manualPrices ?? []
  );
  const developmentPoints = calculatePortfolioDevelopment(
    transactions ?? [],
    marketPrices ?? [],
    interval
  );
  const unpricedHoldings = holdings.filter(
    (holding) => holding.quantity > 0 && holding.marketValue === null
  );
  const unpricedHoldingNames = unpricedHoldings
    .slice(0, 3)
    .map((holding) => holding.securityName)
    .join(", ");
  const hasMoreUnpricedHoldings = unpricedHoldings.length > 3;
  const metrics = [
    {
      label: summary.hasCompletePricing ? "Portfolio value" : "Priced value",
      value: formatCurrency(
        summary.hasCompletePricing ? summary.portfolioValue : summary.pricedPortfolioValue,
        summary.currency
      )
    },
    {
      label: "Invested capital",
      value: formatCurrency(summary.investedCapital, summary.currency)
    },
    {
      label: summary.hasCompletePricing ? "Investment gain/loss" : "Priced gain/loss",
      value: formatCurrency(
        summary.hasCompletePricing ? summary.investmentGain : summary.pricedInvestmentGain,
        summary.currency
      )
    },
    {
      label: "Dividends received",
      value: formatCurrency(summary.dividendsReceived, summary.currency)
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Portfolio analytics calculated from your transactions and synced market prices.
        </p>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors[0]?.message}
        </div>
      ) : null}

      {!summary.hasCompletePricing ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Prices are missing for {unpricedHoldings.length} open{" "}
          {unpricedHoldings.length === 1 ? "position" : "positions"}
          {unpricedHoldingNames ? `: ${unpricedHoldingNames}` : ""}
          {hasMoreUnpricedHoldings ? " and more" : ""}. Invested capital includes all
          open positions, but value and gain/loss currently show only the priced subset.
          Unpriced invested capital:{" "}
          {formatCurrency(summary.unpricedInvestedCapital, summary.currency)}.
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

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Portfolio development</CardTitle>
          <div className="flex rounded-md border p-1">
            {intervals.map((option) => (
              <a
                key={option.value}
                href={`/dashboard?interval=${option.value}`}
                className={cn(
                  "rounded px-3 py-1 text-sm text-muted-foreground",
                  option.value === interval && "bg-primary text-primary-foreground"
                )}
              >
                {option.label}
              </a>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <PortfolioDevelopmentChart
            points={developmentPoints}
            interval={interval}
            emptyMessage={
              marketPrices && marketPrices.length > 0
                ? "Complete price coverage is needed before portfolio development can be shown."
                : "Sync market prices to see portfolio development."
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
