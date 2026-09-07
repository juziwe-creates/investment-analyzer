import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnualPerformanceGrid, type AnnualPerformancePoint } from "@/components/annual-performance-grid";
import { BenchmarkSelector } from "@/components/benchmark-selector";
import { benchmarkOptions, parseBenchmark } from "@/lib/analytics/benchmarks";
import { InvestmentDetailChart, type InvestmentChartPoint, type InvestmentMarker } from "@/components/investment-detail-chart";
import { PurchaseLotsTable } from "@/components/purchase-lots-table";
import { buildCurrentAnalytics, calculatePortfolioDevelopment, transactionSecurityKey } from "@/lib/analytics/portfolio";
import { calculateStockAnalytics, calculateTransactionAnalytics } from "@/lib/analytics/transaction-analytics";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { marketDataCurrency } from "@/lib/market-data/currency";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type MarketPrice = Database["public"]["Tables"]["market_prices"]["Row"];

function cashAmount(transaction: Transaction) {
  return Math.abs(transaction.gross_amount ?? transaction.net_amount ?? ((transaction.quantity ?? 0) * (transaction.unit_price ?? 0)));
}

function quantityAt(transactions: Transaction[], date: string) {
  return transactions.filter((transaction) => transaction.trade_date <= date).reduce((sum, transaction) => transaction.type === "buy" ? sum + (transaction.quantity ?? 0) : transaction.type === "sell" ? sum - (transaction.quantity ?? 0) : sum, 0);
}

function chartPoints(transactions: Transaction[], prices: MarketPrice[]): InvestmentChartPoint[] {
  const firstTransactionDate = transactions.map((transaction) => transaction.trade_date).sort()[0];
  const relevantPrices = prices.filter((price) => !firstTransactionDate || price.price_date >= firstTransactionDate).sort((a, b) => a.price_date.localeCompare(b.price_date));
  const development = calculatePortfolioDevelopment(transactions, relevantPrices, "daily", { lotMatchingMethod: "lifo" });
  let developmentIndex = 0;
  let latestDeployed = 0;

  return relevantPrices.map((price) => {
    while (developmentIndex < development.length && development[developmentIndex].date <= price.price_date) {
      latestDeployed = development[developmentIndex].investedCapital;
      developmentIndex += 1;
    }
    const shares = Math.max(quantityAt(transactions, price.price_date), 0);
    const close = price.adjusted_close_price ?? price.close_price;
    const positionValue = shares * close;
    return {
      date: price.price_date,
      price: close,
      shares,
      positionValue,
      deployedCapital: shares > 0 ? latestDeployed : 0,
      unrealizedReturnPercent: shares > 0 && latestDeployed > 0 ? ((positionValue - latestDeployed) / latestDeployed) * 100 : null,
      currency: marketDataCurrency({ fallbackCurrency: price.currency, providerId: price.provider, providerSymbol: price.provider_symbol })
    };
  });
}

function annualPerformance(prices: MarketPrice[]): AnnualPerformancePoint[] {
  const latestByYear = new Map<number, MarketPrice>();
  for (const price of [...prices].sort((a, b) => a.price_date.localeCompare(b.price_date))) latestByYear.set(Number(price.price_date.slice(0, 4)), price);
  const years = [...latestByYear.keys()].sort((a, b) => a - b);
  const currentYear = new Date().getUTCFullYear();
  return years.slice(1).map((year) => {
    const previous = latestByYear.get(year - 1);
    const current = latestByYear.get(year)!;
    if (!previous) return null;
    const previousClose = previous.adjusted_close_price ?? previous.close_price;
    const currentClose = current.adjusted_close_price ?? current.close_price;
    return { year: year === currentYear ? `${year} YTD` : String(year), returnPercent: ((currentClose / previousClose) - 1) * 100 };
  }).filter((point): point is AnnualPerformancePoint => point !== null);
}

export default async function InvestmentDetailPage({ params, searchParams }: { params: Promise<{ securityKey: string }>; searchParams: Promise<{ portfolio?: string; benchmark?: string }> }) {
  const { securityKey: encodedKey } = await params;
  const { portfolio: portfolioId, benchmark: rawBenchmark } = await searchParams;
  const securityKey = decodeURIComponent(encodedKey);
  const benchmark = parseBenchmark(rawBenchmark);
  const benchmarkLabel = benchmarkOptions.find((option) => option.id === benchmark)!.label;
  const supabase = await createClient();
  const transactionsQuery = supabase.from("transactions").select("*").order("trade_date", { ascending: true }).order("created_at", { ascending: true });
  const latestPricesQuery = supabase.from("latest_market_prices").select("*");
  const manualPricesQuery = supabase.from("manual_security_prices").select("*");
  const marketPricesQuery = supabase.from("market_prices").select("*").eq("security_key", securityKey).order("price_date", { ascending: true });
  if (portfolioId) { transactionsQuery.eq("portfolio_id", portfolioId); latestPricesQuery.eq("portfolio_id", portfolioId); manualPricesQuery.eq("portfolio_id", portfolioId); marketPricesQuery.eq("portfolio_id", portfolioId); }
  const [{ data: allTransactions, error: transactionError }, { data: latestPrices, error: latestError }, { data: manualPrices, error: manualError }, { data: prices, error: priceError }] = await Promise.all([transactionsQuery, latestPricesQuery, manualPricesQuery, marketPricesQuery]);
  const transactions = (allTransactions ?? []).filter((transaction) => transactionSecurityKey(transaction) === securityKey);
  if (transactions.length === 0) notFound();
  const errors = [transactionError, latestError, manualError, priceError].filter(Boolean);
  const { holdings, lots } = buildCurrentAnalytics(transactions, latestPrices ?? [], manualPrices ?? [], { lotMatchingMethod: "lifo" });
  const holding = holdings[0] ?? null;
  const stock = calculateStockAnalytics(lots)[0] ?? null;
  const lotRows = calculateTransactionAnalytics(lots);
  const metadata = transactions.at(-1)!;
  const history = chartPoints(transactions, prices ?? []);
  const latestPoint = history.at(-1) ?? null;
  const previousPoint = history.at(-2) ?? null;
  const dailyMovement = latestPoint && previousPoint && previousPoint.price > 0 ? ((latestPoint.price / previousPoint.price) - 1) * 100 : null;
  const dividends = transactions.filter((transaction) => transaction.type === "dividend").reduce((sum, transaction) => sum + cashAmount(transaction), 0);
  const markers: InvestmentMarker[] = transactions.filter((transaction) => ["buy", "sell", "dividend"].includes(transaction.type)).map((transaction) => {
    const lot = lotRows.find((row) => row.id === transaction.id);
    const baseMetrics = [{ label: "Quantity", value: formatNumber(transaction.quantity) }, { label: "Unit price", value: formatCurrency(transaction.unit_price, transaction.currency) }, { label: "Transaction amount", value: formatCurrency(cashAmount(transaction), transaction.currency) }];
    const metrics = lot ? [...baseMetrics, { label: "Capital deployed", value: formatCurrency(lot.costBasis, lot.currency) }, { label: "Reference value", value: formatCurrency(lot.referenceValue, lot.currency) }, { label: "Current model return", value: formatPercent(lot.totalRawProfitabilityPercent) }, { label: "Current model XIRR", value: formatPercent(lot.totalRawProfitabilityAnnualizedPercent) }, { label: "Attributed dividends", value: formatCurrency(lot.accumulatedDividendsTaxFree, lot.currency) }, { label: "Yield on Cost", value: "Pending definition" }] : baseMetrics;
    return { id: transaction.id, date: transaction.trade_date, type: transaction.type as InvestmentMarker["type"], label: transaction.security_name, subtitle: `${formatDate(transaction.trade_date)} · ${transaction.type.toUpperCase()}`, metrics, note: lot ? "Current-model values use the existing LIFO lot view. Canonical lot matching, dividend-tax semantics, and Yield on Cost remain unresolved." : "Transaction fact from the source-of-truth ledger." };
  });
  const backHref = portfolioId ? `/portfolio?portfolio=${encodeURIComponent(portfolioId)}` : "/portfolio";

  return <div className="space-y-10">
    <header className="border-b border-border/70 pb-7"><Link href={backHref} className="alpha-focus text-sm text-muted-foreground hover:text-foreground">← Investments</Link><div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="alpha-kpi-label">Investment</p><h1 className="mt-2 text-3xl font-medium">{metadata.security_name}</h1><p className="mt-2 text-sm text-muted-foreground">{[metadata.ticker, metadata.exchange, metadata.asset_type].filter(Boolean).join(" · ")}</p></div><div className="lg:text-right"><p className="text-3xl font-medium">{formatCurrency(latestPoint?.price ?? holding?.latestPrice ?? null, latestPoint?.currency ?? holding?.currency ?? "EUR")}</p><p className="mt-1 text-sm text-muted-foreground">{formatPercent(dailyMovement)} latest daily movement</p><p className="mt-3 text-sm">{formatNumber(holding?.quantity ?? 0)} shares · {formatCurrency(holding?.marketValue ?? 0, holding?.currency ?? "EUR")} current value</p></div></div></header>
    {errors.length ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors[0]?.message}</div> : null}
    <section aria-labelledby="investment-kpis"><p id="investment-kpis" className="alpha-kpi-label">Your investment</p><div className="mt-4 grid gap-x-8 gap-y-6 border-y border-border/70 py-6 sm:grid-cols-2 lg:grid-cols-5"><div className="sm:col-span-2"><p className="text-sm text-muted-foreground">Total Return</p><p className="mt-2 text-3xl font-medium text-muted-foreground">Pending definition</p></div>{[
      ["Annualized Return", stock?.accumulatedDividendsTaxFree ? "Pending dividend policy" : formatPercent(stock?.totalRawProfitabilityAnnualizedPercent ?? null)], ["Current Value", formatCurrency(holding?.marketValue ?? 0, holding?.currency ?? "EUR")], ["Current Deployed", formatCurrency(holding?.investedCapital ?? 0, holding?.currency ?? "EUR")], ["Realized Gain", "Pending definition"], ["Unrealized Gain", formatCurrency(holding?.investmentGain ?? null, holding?.currency ?? "EUR")], ["Dividends", formatCurrency(dividends, metadata.currency)], ["Yield on Cost", "Pending definition"], ["Average Purchase Price", holding && holding.quantity > 0 ? formatCurrency(holding.investedCapital / holding.quantity, holding.currency) : "-"], ["Quantity", formatNumber(holding?.quantity ?? 0)]
    ].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-medium">{value}</p></div>)}</div></section>
    <InvestmentDetailChart points={history} markers={markers} />
    <PurchaseLotsTable lots={lots} />
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="alpha-kpi-label">Comparison context</p><p className="mt-1 text-sm text-muted-foreground">One benchmark applies to annual and future normalized comparisons.</p></div><Suspense fallback={<div className="h-9 w-72 animate-pulse rounded-md bg-muted" />}><BenchmarkSelector selected={benchmark} /></Suspense></div>
    <AnnualPerformanceGrid securityName={metadata.security_name} points={annualPerformance(prices ?? [])} benchmarkLabel={benchmarkLabel} />
    <details className="alpha-surface p-4"><summary className="alpha-focus cursor-pointer font-medium">How is this calculated?</summary><div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground"><p>Transactions are the source of truth. Price history provides dated valuation points; holdings and lots are derived at read time.</p><p>Annual performance is year-end security price divided by the previous year-end price minus one. It is not your personal investment return.</p><p>Metrics marked pending depend on unresolved definitions recorded in the authoritative analytics rules.</p></div></details>
  </div>;
}
