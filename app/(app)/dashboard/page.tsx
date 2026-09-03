import { Button } from "@/components/ui/button";
import { CapitalDeploymentChart } from "@/components/capital-deployment-chart";
import { PortfolioDevelopmentChart } from "@/components/portfolio-development-chart";
import {
  buildCurrentAnalytics,
  calculateCapitalDeployment,
  calculatePortfolioDevelopment,
  findSecuritiesWithoutBuyHistory,
  parseChartInterval,
  transactionSecurityKey,
  type ChartInterval
} from "@/lib/analytics/portfolio";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

const intervals: { label: string; value: ChartInterval }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" }
];

const periodPresets = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "YTD", ytd: true },
  { label: "1Y", months: 12 },
  { label: "3Y", months: 36 },
  { label: "5Y", months: 60 },
  { label: "10Y", months: 120 },
  { label: "MAX" }
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

function searchParamValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function dashboardHref(
  interval: ChartInterval,
  fromDate: string,
  toDate: string,
  selectedSecurityKeys: string[]
) {
  const params = new URLSearchParams({ interval });

  if (fromDate) {
    params.set("from", fromDate);
  }

  if (toDate) {
    params.set("to", toDate);
  }

  for (const securityKey of selectedSecurityKeys) {
    params.append("security", securityKey);
  }

  return `/dashboard?${params.toString()}`;
}

function subtractMonths(date: string, months: number) {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  parsedDate.setUTCMonth(parsedDate.getUTCMonth() - months);

  return parsedDate.toISOString().slice(0, 10);
}

function startOfYear(date: string) {
  return `${date.slice(0, 4)}-01-01`;
}

function periodHref(
  label: string,
  interval: ChartInterval,
  lastDate: string | null,
  selectedSecurityKeys: string[]
) {
  if (!lastDate || label === "MAX") {
    return dashboardHref(interval, "", "", selectedSecurityKeys);
  }

  const preset = periodPresets.find((period) => period.label === label);
  const fromDate = preset?.ytd
    ? startOfYear(lastDate)
    : preset?.months
      ? subtractMonths(lastDate, preset.months)
      : "";

  return dashboardHref(interval, fromDate, lastDate, selectedSecurityKeys);
}

function toneClass(value: number | null) {
  if (value === null || value === 0) {
    return "text-foreground";
  }

  return value > 0 ? "text-[hsl(var(--positive))]" : "text-[hsl(var(--negative))]";
}

function buildSecurityOptions(
  transactions: Array<Parameters<typeof transactionSecurityKey>[0]>
) {
  const optionsByKey = new Map<string, { key: string; label: string; count: number }>();

  for (const transaction of transactions) {
    const key = transactionSecurityKey(transaction);
    const existing = optionsByKey.get(key);

    if (!existing) {
      optionsByKey.set(key, {
        key,
        label: transaction.security_name,
        count: 1
      });
      continue;
    }

    existing.count += 1;
    existing.label = transaction.security_name || existing.label;
  }

  return [...optionsByKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{
    interval?: string;
    from?: string;
    to?: string;
    security?: string | string[];
  }>;
}) {
  const {
    interval: rawInterval,
    from: rawFromDate,
    to: rawToDate,
    security: rawSecurity
  } = await searchParams;
  const interval = parseChartInterval(rawInterval);
  const fromDate = isDate(rawFromDate) ? rawFromDate ?? "" : "";
  const toDate = isDate(rawToDate) ? rawToDate ?? "" : "";
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
  const marketPricesQuery = supabase
    .from("market_prices")
    .select("*")
    .order("price_date", { ascending: true });
  const [
    { data: transactions, error: transactionsError },
    { data: latestMarketPrices, error: latestPricesError },
    { data: manualPrices, error: manualPricesError },
    { data: marketPrices, error: marketPricesError }
  ] = await Promise.all([
    transactionsQuery,
    latestMarketPricesQuery,
    manualPricesQuery,
    marketPricesQuery
  ]);
  const errors = [
    transactionsError,
    latestPricesError,
    manualPricesError,
    marketPricesError
  ].filter(Boolean);
  const allTransactions = transactions ?? [];
  const allLatestMarketPrices = latestMarketPrices ?? [];
  const allManualPrices = manualPrices ?? [];
  const allMarketPrices = marketPrices ?? [];
  const securityOptions = buildSecurityOptions(allTransactions);
  const availableSecurityKeys = new Set(securityOptions.map((option) => option.key));
  const selectedSecurityKeys = [
    ...new Set(
      searchParamValues(rawSecurity).filter((securityKey) =>
        availableSecurityKeys.has(securityKey)
      )
    )
  ];
  const selectedSecurityKeySet = new Set(selectedSecurityKeys);
  const hasSecurityFilter = selectedSecurityKeys.length > 0;
  const filteredTransactions = hasSecurityFilter
    ? allTransactions.filter((transaction) =>
        selectedSecurityKeySet.has(transactionSecurityKey(transaction))
      )
    : allTransactions;
  const filteredLatestMarketPrices = hasSecurityFilter
    ? allLatestMarketPrices.filter((price) => selectedSecurityKeySet.has(price.security_key))
    : allLatestMarketPrices;
  const filteredManualPrices = hasSecurityFilter
    ? allManualPrices.filter((price) => selectedSecurityKeySet.has(price.security_key))
    : allManualPrices;
  const filteredMarketPrices = hasSecurityFilter
    ? allMarketPrices.filter((price) => selectedSecurityKeySet.has(price.security_key))
    : allMarketPrices;
  const { holdings, summary } = buildCurrentAnalytics(
    filteredTransactions,
    filteredLatestMarketPrices,
    filteredManualPrices
  );
  const allDevelopmentPoints = calculatePortfolioDevelopment(
    filteredTransactions,
    filteredMarketPrices,
    interval
  );
  const allCapitalDeploymentPoints = calculateCapitalDeployment(filteredTransactions, interval);
  const developmentPoints = filterPointsByDate(allDevelopmentPoints, fromDate, toDate);
  const capitalDeploymentPoints = filterPointsByDate(
    allCapitalDeploymentPoints,
    fromDate,
    toDate
  );
  const earliestBuyDate =
    filteredTransactions
      .filter((transaction) => transaction.type === "buy")
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
  const missingBuyHistory = findSecuritiesWithoutBuyHistory(filteredTransactions);
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
  const selectedSecurityNames = securityOptions
    .filter((option) => selectedSecurityKeySet.has(option.key))
    .map((option) => option.label)
    .join(", ");
  const displayedPortfolioValue = summary.hasCompletePricing
    ? summary.portfolioValue
    : summary.pricedPortfolioValue;
  const displayedInvestmentGain = summary.hasCompletePricing
    ? summary.investmentGain
    : summary.pricedInvestmentGain;
  const totalReturnPercent =
    summary.totalProfitability !== null && summary.investedCapital > 0
      ? (summary.totalProfitability / summary.investedCapital) * 100
      : null;
  const currentPeriodLabel =
    fromDate || toDate
      ? `${fromDate || "Start"} to ${toDate || "latest"}`
      : "MAX";
  const latestChartDate =
    developmentPoints.at(-1)?.date ?? capitalDeploymentPoints.at(-1)?.date ?? null;
  const metrics = [
    {
      label: "Current deployed",
      value: formatCurrency(summary.investedCapital, summary.currency)
    },
    {
      label: summary.hasCompletePricing ? "Unrealized gain" : "Priced gain",
      value: formatCurrency(displayedInvestmentGain, summary.currency)
    },
    {
      label: "Dividends",
      value: formatCurrency(summary.dividendsReceived, summary.currency)
    },
    {
      label: "Period",
      value: currentPeriodLabel
    }
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 border-b border-border/70 pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="alpha-kpi-label">Portfolio value</p>
          <h1 className="mt-3 text-5xl font-medium tracking-[-0.04em] text-foreground">
            {formatCurrency(displayedPortfolioValue, summary.currency)}
          </h1>
          <p className={cn("mt-3 text-lg font-medium", toneClass(summary.totalProfitability))}>
            {formatCurrency(summary.totalProfitability, summary.currency)} ·{" "}
            {formatPercent(totalReturnPercent)} total return
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {hasSecurityFilter
              ? `Subset analytics for ${selectedSecurityNames}.`
              : "Portfolio analytics calculated from your transactions and synced market prices."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodPresets.map((period) => {
            const active =
              period.label === "MAX"
                ? !fromDate && !toDate
                : latestChartDate !== null &&
                  periodHref(period.label, interval, latestChartDate, selectedSecurityKeys) ===
                    dashboardHref(interval, fromDate, toDate, selectedSecurityKeys);

            return (
              <a
                key={period.label}
                href={periodHref(period.label, interval, latestChartDate, selectedSecurityKeys)}
                className={cn(
                  "rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-card hover:text-foreground",
                  active && "border-border bg-card text-foreground"
                )}
              >
                {period.label}
              </a>
            );
          })}
        </div>
      </section>

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

      <section className="grid gap-6 border-b border-border/70 pb-7 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="alpha-kpi-label">{metric.label}</p>
            <p className="mt-2 text-2xl font-medium tracking-[-0.02em]">{metric.value}</p>
          </div>
        ))}
      </section>

      <section className="alpha-surface p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="alpha-section-title">Analytical context</h2>
            <p className="text-sm text-muted-foreground">
              Filter the portfolio view by date range and selected investments.
            </p>
          </div>
          <div className="flex w-fit rounded-md border border-border/80 bg-background p-1">
            {intervals.map((option) => (
              <a
                key={option.value}
                href={dashboardHref(option.value, fromDate, toDate, selectedSecurityKeys)}
                className={cn(
                  "rounded px-3 py-1 text-sm text-muted-foreground transition hover:text-foreground",
                  option.value === interval && "bg-card text-foreground"
                )}
              >
                {option.label}
              </a>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <form className="space-y-4">
            <input type="hidden" name="interval" value={interval} />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-end">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">From</span>
                <input
                  type="date"
                  name="from"
                  defaultValue={fromDate}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">To</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={toDate}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </label>
              <Button type="submit">Apply</Button>
              <Button asChild type="button" variant="outline">
                <a href={`/dashboard?interval=${interval}`}>Clear</a>
              </Button>
            </div>
            {securityOptions.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Stocks</legend>
                <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {securityOptions.map((option) => (
                    <label
                      key={option.key}
                      className="flex items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-background"
                    >
                      <input
                        type="checkbox"
                        name="security"
                        value={option.key}
                        defaultChecked={selectedSecurityKeySet.has(option.key)}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{option.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.key} · {option.count} transactions
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </form>
          <p className="text-xs text-muted-foreground">
            {hasSecurityFilter
              ? `Selected ${selectedSecurityKeys.length} of ${securityOptions.length} stocks. `
              : `Showing all ${securityOptions.length} stocks. `}
            Showing {developmentPoints.length} portfolio points and{" "}
            {capitalDeploymentPoints.length} capital deployment points.
          </p>
        </div>
      </section>

      <section className="alpha-surface p-5">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="alpha-section-title">Portfolio development</h2>
          <p className="text-sm text-muted-foreground">
            Portfolio value and deployed capital over the selected period.
          </p>
        </div>
        <PortfolioDevelopmentChart
          points={developmentPoints}
          interval={interval}
          earliestBuyDate={earliestBuyDate}
          emptyMessage={
            filteredMarketPrices.length > 0
              ? "Historical prices are needed before portfolio development can be shown."
              : "Sync market prices to see portfolio development."
          }
        />
      </section>

      <section className="alpha-surface p-5">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="alpha-section-title">Capital deployment</h2>
          <p className="text-sm text-muted-foreground">
            Cumulative buys minus sells, with dividends collected as a separate line.
          </p>
        </div>
        <CapitalDeploymentChart points={capitalDeploymentPoints} interval={interval} />
      </section>
    </div>
  );
}
