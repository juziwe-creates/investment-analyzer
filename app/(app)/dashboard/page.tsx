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
  const { summary } = buildCurrentAnalytics(
    transactions ?? [],
    latestMarketPrices ?? [],
    manualPrices ?? []
  );
  const developmentPoints = calculatePortfolioDevelopment(
    transactions ?? [],
    marketPrices ?? [],
    interval
  );
  const metrics = [
    {
      label: "Portfolio value",
      value: formatCurrency(summary.portfolioValue, summary.currency)
    },
    {
      label: "Invested capital",
      value: formatCurrency(summary.investedCapital, summary.currency)
    },
    {
      label: "Investment gain/loss",
      value: formatCurrency(summary.investmentGain, summary.currency)
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
          <PortfolioDevelopmentChart points={developmentPoints} interval={interval} />
        </CardContent>
      </Card>
    </div>
  );
}
