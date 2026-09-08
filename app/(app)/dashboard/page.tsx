import { Suspense } from "react";
import { presentationTransactions } from "@/lib/presentation";
import Link from "next/link";
import { BenchmarkSelector } from "@/components/benchmark-selector";
import { CapitalDeploymentChart } from "@/components/capital-deployment-chart";
import { PortfolioDevelopmentChart } from "@/components/portfolio-development-chart";
import { PortfolioHoldingsTable } from "@/components/portfolio-holdings-table";
import { PortfolioMetrics } from "@/components/portfolio-metrics";
import { Button } from "@/components/ui/button";
import { buildCurrentAnalytics, calculateCapitalDeployment, calculatePortfolioDevelopment, findSecuritiesWithoutBuyHistory, parseChartInterval, transactionSecurityKey, type ChartInterval } from "@/lib/analytics/portfolio";
import { benchmarkOptions, parseBenchmark } from "@/lib/analytics/benchmarks";
import { eurAggregationStatus } from "@/lib/analytics/currency";
import { formatCurrency } from "@/lib/formatters";
import { marketDataCurrency } from "@/lib/market-data/currency";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const periods = [{ label: "1M", months: 1 }, { label: "3M", months: 3 }, { label: "YTD", ytd: true }, { label: "1Y", months: 12 }, { label: "3Y", months: 36 }, { label: "5Y", months: 60 }, { label: "10Y", months: 120 }, { label: "MAX" }];
const intervals: { label: string; value: ChartInterval }[] = [{ label: "Daily", value: "daily" }, { label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }];
type Params = { interval?: string; from?: string; to?: string; security?: string | string[]; portfolio?: string; benchmark?: string };

function values(value: string | string[] | undefined) { return Array.isArray(value) ? value : value ? [value] : []; }
function subtractMonths(date: string, months: number) { const parsed = new Date(`${date}T00:00:00Z`); parsed.setUTCMonth(parsed.getUTCMonth() - months); return parsed.toISOString().slice(0, 10); }
function periodFrom(label: string, lastDate: string | null) { if (!lastDate || label === "MAX") return ""; const period = periods.find((item) => item.label === label); return period?.ytd ? `${lastDate.slice(0, 4)}-01-01` : period?.months ? subtractMonths(lastDate, period.months) : ""; }
function validDate(value: string | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""; }
function filterDates<T extends { date: string }>(points: T[], from: string, to: string) { return points.filter((point) => (!from || point.date >= from) && (!to || point.date <= to)); }
function hrefFor({ interval, from, to, securities, portfolio, benchmark }: { interval: ChartInterval; from?: string; to?: string; securities: string[]; portfolio?: string; benchmark: string }) { const params = new URLSearchParams({ interval, benchmark }); if (from) params.set("from", from); if (to) params.set("to", to); if (portfolio) params.set("portfolio", portfolio); securities.forEach((security) => params.append("security", security)); return `/dashboard?${params}`; }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const interval = parseChartInterval(params.interval);
  const from = validDate(params.from);
  const to = validDate(params.to);
  const benchmark = parseBenchmark(params.benchmark);
  const benchmarkLabel = benchmarkOptions.find((option) => option.id === benchmark)!.label;
  const supabase = await createClient();
  const transactionsQuery = presentationTransactions(params.portfolio);
  const latestQuery = supabase.from("latest_market_prices").select("*");
  const manualQuery = supabase.from("manual_security_prices").select("*");
  const marketQuery = supabase.from("market_prices").select("*").order("price_date", { ascending: true });
  if (params.portfolio) { latestQuery.eq("portfolio_id", params.portfolio); manualQuery.eq("portfolio_id", params.portfolio); marketQuery.eq("portfolio_id", params.portfolio); }
  const [{ data: allTransactions, error: transactionsError }, { data: allLatest, error: latestError }, { data: allManual, error: manualError }, { data: allMarket, error: marketError }] = await Promise.all([transactionsQuery, latestQuery, manualQuery, marketQuery]);
  const transactions = allTransactions ?? [];
  const optionsByKey = new Map<string, string>();
  transactions.forEach((transaction) => optionsByKey.set(transactionSecurityKey(transaction), transaction.security_name));
  const selected = [...new Set(values(params.security).filter((key) => optionsByKey.has(key)))];
  const selectedSet = new Set(selected);
  const filteredTransactions = selected.length ? transactions.filter((transaction) => selectedSet.has(transactionSecurityKey(transaction))) : transactions;
  const latest = selected.length ? (allLatest ?? []).filter((price) => selectedSet.has(price.security_key)) : allLatest ?? [];
  const manual = selected.length ? (allManual ?? []).filter((price) => selectedSet.has(price.security_key)) : allManual ?? [];
  const market = selected.length ? (allMarket ?? []).filter((price) => selectedSet.has(price.security_key)) : allMarket ?? [];
  const { holdings, summary } = buildCurrentAnalytics(filteredTransactions, latest, manual);
  const development = filterDates(calculatePortfolioDevelopment(filteredTransactions, market, interval), from, to);
  const deployment = filterDates(calculateCapitalDeployment(filteredTransactions, interval), from, to);
  const lastDate = development.at(-1)?.date ?? deployment.at(-1)?.date ?? null;
  const { canAggregate: currencyReady, unsupportedCurrencies } = eurAggregationStatus([
    ...filteredTransactions.map((transaction) => transaction.currency),
    ...manual.map((price) => price.currency),
    ...market.map((price) => marketDataCurrency({ fallbackCurrency: price.currency, providerId: price.provider, providerSymbol: price.provider_symbol }))
  ]);
  const portfolioValue = currencyReady ? (summary.hasCompletePricing ? summary.portfolioValue : summary.pricedPortfolioValue) : null;
  const unpriced = holdings.filter((holding) => holding.marketValue === null);
  const missingBuyHistory = findSecuritiesWithoutBuyHistory(filteredTransactions);
  const errors = [transactionsError, latestError, manualError, marketError].filter(Boolean);
  const baseHref = (overrides: { interval?: ChartInterval; from?: string; to?: string } = {}) => hrefFor({ interval: overrides.interval ?? interval, from: overrides.from ?? from, to: overrides.to ?? to, securities: selected, portfolio: params.portfolio, benchmark });

  return <div className="space-y-10">
    <header className="border-b border-border/70 pb-7"><p className="alpha-kpi-label">Portfolio value</p><div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-4xl font-medium tracking-[-0.035em] sm:text-5xl">{formatCurrency(portfolioValue, "EUR")}</h1><p className="mt-3 text-lg font-medium text-muted-foreground">Total Return pending approved methodology</p><p className="mt-2 text-sm text-muted-foreground">{selected.length ? `${selected.length} selected investments` : "All current investments"}</p></div><nav className="flex flex-wrap gap-1" aria-label="Portfolio period">{periods.map((period) => { const periodStart = periodFrom(period.label, lastDate); const active = period.label === "MAX" ? !from && !to : from === periodStart && to === (lastDate ?? ""); return <Link key={period.label} href={hrefFor({ interval, from: periodStart, to: period.label === "MAX" ? "" : lastDate ?? "", securities: selected, portfolio: params.portfolio, benchmark })} className={cn("alpha-focus rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-card", active && "bg-card text-foreground ring-1 ring-border")}>{period.label}</Link>; })}</nav></div></header>
    {errors.length ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors[0]?.message}</div> : null}
    {!currencyReady ? <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">EUR conversion is unavailable for {unsupportedCurrencies.join(", ")}. Cross-currency totals and charts are withheld instead of aggregating unlike currencies.</div> : null}
    {unpriced.length ? <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{unpriced.length} open {unpriced.length === 1 ? "holding has" : "holdings have"} no current price. Portfolio Value shows only the priced subset; missing values are not treated as zero.</div> : null}
    {missingBuyHistory.length ? <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">{missingBuyHistory.length} investments contain sells or dividends without complete buy history and are excluded from holdings.</div> : null}
    <PortfolioMetrics primary={[{ label: "Current deployed", value: currencyReady ? formatCurrency(summary.investedCapital, "EUR") : "Unavailable" }, { label: "Annualized return", value: "Pending definition", muted: true }, { label: "Dividends received", value: currencyReady ? formatCurrency(summary.dividendsReceived, "EUR") : "Unavailable" }]} secondary={[{ label: "Realized gain", value: "Pending definition", muted: true }, { label: "Unrealized gain", value: currencyReady ? formatCurrency(summary.hasCompletePricing ? summary.investmentGain : summary.pricedInvestmentGain, "EUR") : "Unavailable" }, { label: "This year", value: "Pending definition", muted: true }, { label: "Last 365 days", value: "Pending definition", muted: true }]} />
    <section className="space-y-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="alpha-section-title">Portfolio performance</h2><p className="mt-1 text-sm text-muted-foreground">Portfolio value and currently deployed capital over time.</p></div><div className="flex flex-wrap gap-2"><div className="inline-flex rounded-md border border-border bg-card p-1">{intervals.map((option) => <Link key={option.value} href={baseHref({ interval: option.value })} className={cn("alpha-focus rounded px-3 py-1.5 text-sm text-muted-foreground", interval === option.value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{option.label}</Link>)}</div><Suspense fallback={<div className="h-9 w-72 animate-pulse rounded-md bg-muted" />}><BenchmarkSelector selected={benchmark} /></Suspense></div></div>
      <div className="alpha-surface p-3 sm:p-5"><PortfolioDevelopmentChart points={currencyReady ? development : []} interval={interval} emptyMessage={currencyReady ? "Sync historical prices to see portfolio development." : "Portfolio history is unavailable until EUR conversion is defined."} /></div><p className="text-xs text-muted-foreground">{benchmarkLabel} selected. Normalized benchmark comparison is unavailable until benchmark history is stored. No `α` metric is shown because its definition remains unresolved.</p>
    </section>
    <details className="alpha-surface p-4"><summary className="alpha-focus cursor-pointer font-medium">Filter analytical context</summary><form className="mt-4 space-y-4"><input type="hidden" name="interval" value={interval} /><input type="hidden" name="benchmark" value={benchmark} />{params.portfolio ? <input type="hidden" name="portfolio" value={params.portfolio} /> : null}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]"><label className="text-sm"><span className="text-muted-foreground">From</span><input type="date" name="from" defaultValue={from} className="alpha-focus mt-1 h-9 w-full rounded-md border bg-background px-3" /></label><label className="text-sm"><span className="text-muted-foreground">To</span><input type="date" name="to" defaultValue={to} className="alpha-focus mt-1 h-9 w-full rounded-md border bg-background px-3" /></label><Button type="submit" className="self-end">Apply</Button><Button type="button" asChild variant="outline" className="self-end"><Link href={hrefFor({ interval, securities: [], portfolio: params.portfolio, benchmark })}>Clear</Link></Button></div><fieldset><legend className="text-sm font-medium">Investments</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...optionsByKey.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-sm"><input type="checkbox" name="security" value={key} defaultChecked={selectedSet.has(key)} /><span className="truncate">{label}</span></label>)}</div></fieldset></form></details>
    <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-muted" />}><PortfolioHoldingsTable holdings={holdings} /></Suspense>
    <section className="space-y-4"><div><h2 className="alpha-section-title">Capital deployment</h2><p className="mt-1 text-sm text-muted-foreground">Cumulative purchase cost minus sale proceeds, alongside received dividends.</p></div><div className="alpha-surface p-3 sm:p-5"><CapitalDeploymentChart points={currencyReady ? deployment : []} interval={interval} /></div></section>
    <details className="alpha-surface p-4"><summary className="alpha-focus cursor-pointer font-medium">How is this calculated?</summary><div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground"><p>Portfolio Value uses open quantity multiplied by the latest available price. Current Deployed Capital is remaining cost basis of open lots. Missing prices are excluded and disclosed.</p><p>Total Return, Realized Gain, annualized portfolio return, YTD, last-365-day return, FX conversion, and `α` remain unavailable until their authoritative definitions are approved.</p></div></details>
  </div>;
}
