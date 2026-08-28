import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CapitalDeploymentChart } from "@/components/capital-deployment-chart";
import { PortfolioDevelopmentChart } from "@/components/portfolio-development-chart";
import {
  buildCurrentAnalytics,
  calculateCapitalDeployment,
  calculatePortfolioDevelopment,
  findSecuritiesWithoutBuyHistory,
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

function isDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function filterPointsByDate<T extends { date: string }>(
  points: T[],
  fromDate: string,
  toDate: string
) {
  return points.filter((point) => {
    if (fromDate && point.date < fromDate) {
      return false;
    }

    if (toDate && point.date > toDate) {
      return false;
    }

    return true;
  });
}

function dashboardHref(interval: ChartInterval, fromDate: string, toDate: string) {
  const params = new URLSearchParams({ interval });

  if (fromDate) {
    params.set("from", fromDate);
  }

  if (toDate) {
    params.set("to", toDate);
  }

  return `/dashboard?${params.toString()}`;
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ interval?: string; from?: string; to?: string }>;
}) {
  const { interval: rawInterval, from: rawFromDate, to: rawToDate } = await searchParams;
  const interval = parseChartInterval(rawInterval);
  const fromDate = isDate(rawFromDate) ? rawFromDate ?? "" : "";
  const toDate = isDate(rawToDate) ? rawToDate ?? "" : "";
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
  const allDevelopmentPoints = calculatePortfolioDevelopment(
    transactions ?? [],
    marketPrices ?? [],
    interval
  );
  const allCapitalDeploymentPoints = calculateCapitalDeployment(transactions ?? [], interval);
  const developmentPoints = filterPointsByDate(allDevelopmentPoints, fromDate, toDate);
  const capitalDeploymentPoints = filterPointsByDate(
    allCapitalDeploymentPoints,
    fromDate,
    toDate
  );
  const earliestBuyDate =
    transactions
      ?.filter((transaction) => transaction.type === "buy")
      .map((transaction) => transaction.trade_date)
      .sort()[0] ?? null;
  const firstDevelopmentPointDate = developmentPoints[0]?.date ?? null;
  const hasDevelopmentCoverageGap =
    !fromDate &&
    earliestBuyDate !== null &&
    firstDevelopmentPointDate !== null &&
    earliestBuyDate < firstDevelopmentPointDate;
  const hasIncompleteDevelopmentPoints = developmentPoints.some(
    (point) => !point.hasCompletePricing
  );
  const missingBuyHistory = findSecuritiesWithoutBuyHistory(transactions ?? []);
  const missingBuyHistoryNames = missingBuyHistory
    .slice(0, 3)
    .map((security) => security.securityName)
    .join(", ");
  const hasMoreMissingBuyHistory = missingBuyHistory.length > 3;
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

      {hasDevelopmentCoverageGap ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The earliest buy transaction is before the first chart point. This means no
          historical price was available yet for that first holding.
        </div>
      ) : null}

      {hasIncompleteDevelopmentPoints ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The portfolio development chart includes only positions with historical prices
          at each point in time. Add historical prices for the remaining securities to turn
          it into a complete portfolio chart.
        </div>
      ) : null}

      {missingBuyHistory.length > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {missingBuyHistory.length} securities have dividends or sells, but no buy
          transactions yet{missingBuyHistoryNames ? `: ${missingBuyHistoryNames}` : ""}
          {hasMoreMissingBuyHistory ? " and more" : ""}. They are excluded from current
          holdings until their buy history is imported.
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
        <CardHeader>
          <CardTitle>Chart filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex w-fit rounded-md border p-1">
              {intervals.map((option) => (
                <a
                  key={option.value}
                  href={dashboardHref(option.value, fromDate, toDate)}
                  className={cn(
                    "rounded px-3 py-1 text-sm text-muted-foreground",
                    option.value === interval && "bg-primary text-primary-foreground"
                  )}
                >
                  {option.label}
                </a>
              ))}
            </div>
            <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-end">
              <input type="hidden" name="interval" value={interval} />
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">From</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={fromDate}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">To</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={toDate}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <Button type="submit">Apply</Button>
              <Button asChild type="button" variant="outline">
                <a href={`/dashboard?interval=${interval}`}>Clear</a>
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Showing {developmentPoints.length} portfolio points and{" "}
              {capitalDeploymentPoints.length} capital deployment points.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio development</CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioDevelopmentChart
            points={developmentPoints}
            interval={interval}
            earliestBuyDate={earliestBuyDate}
            emptyMessage={
              marketPrices && marketPrices.length > 0
                ? "Historical prices are needed before portfolio development can be shown."
                : "Sync market prices to see portfolio development."
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capital Deployment</CardTitle>
        </CardHeader>
        <CardContent>
          <CapitalDeploymentChart points={capitalDeploymentPoints} interval={interval} />
        </CardContent>
      </Card>
    </div>
  );
}
