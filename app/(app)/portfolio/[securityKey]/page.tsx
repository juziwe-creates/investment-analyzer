import { Suspense } from "react";
import { presentationTransactions } from "@/lib/presentation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnualPerformanceGrid } from "@/components/annual-performance-grid";
import { BenchmarkSelector } from "@/components/benchmark-selector";
import { annualPriceReturns, benchmarkOptions, parseBenchmarks } from "@/lib/analytics/benchmarks";
import { readBenchmarkHistory } from "@/lib/market-data/benchmark-history";
import { type InvestmentMarker } from "@/components/investment-detail-chart";
import { InvestmentHistoryPanel } from "@/components/investment-history-panel";
import { investmentHistory } from "@/lib/analytics/investment-history";
import { buildCurrentAnalytics, transactionSecurityKey } from "@/lib/analytics/portfolio";
import { calculateStockAnalytics, calculateTransactionAnalytics } from "@/lib/analytics/transaction-analytics";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { marketDataCurrency } from "@/lib/market-data/currency";
import { createClient } from "@/lib/supabase/server";
import { readMarketHistory } from "@/lib/market-data/history";
import type { Database } from "@/types/database";
import { calculateYieldOnCost, investmentDividendEvents } from "@/lib/analytics/dividends";
import { dividendAmount } from "@/lib/analytics/engine";
import { benchmarkView, buildBenchmarkComparison, calculateVirtualBenchmarkTimeline } from "@/lib/analytics/benchmark-portfolio";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

function cashAmount(transaction: Transaction) {
  return Math.abs(transaction.gross_amount ?? transaction.net_amount ?? ((transaction.quantity ?? 0) * (transaction.unit_price ?? 0)));
}

export default async function InvestmentDetailPage({ params, searchParams }: { params: Promise<{ securityKey: string }>; searchParams: Promise<{ portfolio?: string; benchmark?: string | string[] }> }) {
  const { securityKey: encodedKey } = await params;
  const { portfolio: portfolioId, benchmark: rawBenchmark } = await searchParams;
  const securityKey = decodeURIComponent(encodedKey);
  const benchmarks = parseBenchmarks(rawBenchmark);
  const benchmark = benchmarks[0];
  const benchmarkLabel = benchmarkOptions.find((option) => option.id === benchmark)!.label;
  const supabase = await createClient();
  const transactionsQuery = presentationTransactions(portfolioId);
  const latestPricesQuery = supabase.from("latest_market_prices").select("*");
  const manualPricesQuery = supabase.from("manual_security_prices").select("*");
  const marketPricesQuery = readMarketHistory(undefined, securityKey);
  if (portfolioId) { latestPricesQuery.eq("portfolio_id", portfolioId); manualPricesQuery.eq("portfolio_id", portfolioId); }
  const [{ data: allTransactions, error: transactionError }, { data: latestPrices, error: latestError }, { data: manualPrices, error: manualError }, { data: prices, error: priceError }, references] = await Promise.all([transactionsQuery, latestPricesQuery, manualPricesQuery, marketPricesQuery, Promise.all(benchmarks.map((selectedBenchmark) => readBenchmarkHistory(selectedBenchmark)))]);
  const transactions = (allTransactions ?? []).filter((transaction) => transactionSecurityKey(transaction) === securityKey);
  if (transactions.length === 0) notFound();
  const errors = [transactionError, latestError, manualError, priceError].filter(Boolean);
  const { holdings, lots } = buildCurrentAnalytics(transactions, latestPrices ?? [], manualPrices ?? [], { lotMatchingMethod: "lifo" });
  const holding = holdings[0] ?? null;
  const stock = calculateStockAnalytics(lots)[0] ?? null;
  const lotRows = calculateTransactionAnalytics(lots);
  const metadata = transactions.at(-1)!;
  const history = investmentHistory(transactions, (prices ?? []).map((price) => ({ security_key: securityKey, price_date: price.price_date,
    price: price.adjusted_close_price ?? price.close_price, currency: marketDataCurrency({ fallbackCurrency: price.currency, providerId: price.provider, providerSymbol: price.provider_symbol }) })));
  const priceDates = new Set((prices ?? []).map((price) => price.price_date));
  const benchmarkSeries = benchmarks.map((selectedBenchmark, index) => {
    const reference = references[index];
    const comparison = buildBenchmarkComparison(lots, reference.data, selectedBenchmark, "lifo");
    if (reference.error) comparison.error = reference.error;
    return { comparison, reference, timeline: calculateVirtualBenchmarkTimeline(comparison.virtualLots, reference.data, selectedBenchmark, history.map((point) => point.date)) };
  });
  const comparison = benchmarkSeries[0].comparison;
  const reference = benchmarkSeries[0].reference;
  const quotedPoints = history.filter((point) => point.price !== null && priceDates.has(point.date));
  const latestPoint = quotedPoints.at(-1) ?? null;
  const previousPoint = quotedPoints.at(-2) ?? null;
  const dailyMovement = latestPoint?.price !== null && latestPoint?.price !== undefined && previousPoint?.price && previousPoint.price > 0 ? ((latestPoint.price / previousPoint.price) - 1) * 100 : null;
  const yieldOnCost = calculateYieldOnCost(transactions, new Date().toISOString().slice(0, 10));
  const dividends = transactions.filter((transaction) => transaction.type === "dividend").reduce((sum, transaction) => sum + dividendAmount(transaction), 0);
  const markers: InvestmentMarker[] = transactions.filter((transaction) => ["buy", "sell", "dividend"].includes(transaction.type)).map((transaction) => {
    const lot = lotRows.find((row) => row.id === transaction.id);
    const baseMetrics = [{ label: "Quantity", value: formatNumber(transaction.quantity) }, { label: "Unit price", value: formatCurrency(transaction.unit_price, transaction.currency) }, { label: "Transaction amount", value: formatCurrency(cashAmount(transaction), transaction.currency) }];
    const metrics = lot ? [...baseMetrics, { label: "Capital deployed", value: formatCurrency(lot.costBasis, lot.currency) }, { label: "Reference value", value: formatCurrency(lot.referenceValue, lot.currency) }, { label: "Current model return", value: formatPercent(lot.totalRawProfitabilityPercent) }, { label: "Current model XIRR", value: formatPercent(lot.totalRawProfitabilityAnnualizedPercent) }, { label: "Attributed dividends", value: formatCurrency(lot.accumulatedDividendsTaxFree, lot.currency) }, { label: `Investment Yield on Cost (${yieldOnCost.year})`, value: formatPercent(yieldOnCost.yieldPercent) }] : baseMetrics;
    return { id: transaction.id, date: transaction.trade_date, type: transaction.type as InvestmentMarker["type"], label: transaction.security_name, subtitle: `${formatDate(transaction.trade_date)} · ${transaction.type.toUpperCase()}`, metrics, note: lot ? "Current-model values use the existing LIFO lot view. Canonical lot matching and dividend-tax semantics remain unresolved. Yield on Cost is investment-level." : "Transaction fact from the source-of-truth ledger." };
  });
  const backHref = portfolioId ? `/portfolio?portfolio=${encodeURIComponent(portfolioId)}` : "/portfolio";

  return <div className="space-y-10">
    <header className="border-b border-border/70 pb-7"><Link href={backHref} className="alpha-focus text-sm text-muted-foreground hover:text-foreground">← Investments</Link><div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="alpha-kpi-label">Investment</p><h1 className="mt-2 text-3xl font-medium">{metadata.security_name}</h1><p className="mt-2 text-sm text-muted-foreground">{[metadata.ticker, metadata.exchange, metadata.asset_type].filter(Boolean).join(" · ")}</p></div><div className="lg:text-right"><p className="text-3xl font-medium">{formatCurrency(latestPoint?.price ?? holding?.latestPrice ?? null, latestPoint?.currency ?? holding?.currency ?? "EUR")}</p><p className="mt-1 text-sm text-muted-foreground">{formatPercent(dailyMovement)} latest daily movement</p><p className="mt-3 text-sm">{formatNumber(holding?.quantity ?? 0)} shares · {formatCurrency(holding?.marketValue ?? 0, holding?.currency ?? "EUR")} current value</p></div></div></header>
    {errors.length ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors[0]?.message}</div> : null}
    <section aria-labelledby="investment-kpis"><p id="investment-kpis" className="alpha-kpi-label">Your investment</p><div className="mt-4 grid gap-x-8 gap-y-6 border-y border-border/70 py-6 sm:grid-cols-2 lg:grid-cols-5"><div className="sm:col-span-2"><p className="text-sm text-muted-foreground">Total Return</p><p className="mt-2 text-3xl font-medium text-muted-foreground">Pending definition</p></div>{[
      ["Annualized Return", stock?.accumulatedDividendsTaxFree ? "Pending dividend policy" : formatPercent(stock?.totalRawProfitabilityAnnualizedPercent ?? null)], ["Current Value", formatCurrency(holding?.marketValue ?? 0, holding?.currency ?? "EUR")], ["Current Deployed", formatCurrency(holding?.investedCapital ?? 0, holding?.currency ?? "EUR")], ["Realized Gain", "Pending definition"], ["Unrealized Gain", formatCurrency(holding?.investmentGain ?? null, holding?.currency ?? "EUR")], ["Dividends", formatCurrency(dividends, metadata.currency)], [`Yield on Cost (${yieldOnCost.year})`, formatPercent(yieldOnCost.yieldPercent)], ["Average Purchase Price", holding && holding.quantity > 0 ? formatCurrency(holding.investedCapital / holding.quantity, holding.currency) : "-"], ["Quantity", formatNumber(holding?.quantity ?? 0)]
    ].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-medium">{value}</p></div>)}</div></section>
    <InvestmentHistoryPanel points={history} markers={markers} dividends={investmentDividendEvents(transactions, { lotMatchingMethod: "lifo" })} lots={lots} comparison={benchmarkView(comparison)} benchmarks={benchmarkSeries.map(({ comparison: seriesComparison, timeline }) => ({ comparison: benchmarkView(seriesComparison), timeline }))} />
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="alpha-kpi-label">Comparison context</p><p className="mt-1 text-sm text-muted-foreground">Select one or more EUR counterfactual benchmarks. The first selected benchmark is used in the tables below.</p></div><Suspense fallback={<div className="h-9 w-72 animate-pulse rounded-md bg-muted" />}><BenchmarkSelector selected={benchmarks} /></Suspense></div>
    <AnnualPerformanceGrid securityName={metadata.security_name} points={annualPriceReturns((prices ?? []).map((price) => ({ date: price.price_date, value: price.adjusted_close_price ?? price.close_price })))} benchmarkLabel={benchmarkLabel} benchmarkPoints={annualPriceReturns(reference.data.filter((price) => price.currency === "EUR").map((price) => ({ date: price.price_date, value: price.close_price })))} benchmarkError={reference.error} />
    <details className="alpha-surface p-4"><summary className="alpha-focus cursor-pointer font-medium">How is this calculated?</summary><div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground"><p>Transactions are the source of truth. Value is the market value of shares held on each date. Economic Value adds cumulative attributed sale proceeds and recorded dividends without changing acquisition cost.</p><p>Actual dividends are dated cash flows. Total-return benchmark dividends are embedded and reinvested according to each index methodology; no synthetic benchmark dividend is added.</p><p>Annual performance is year-end security price divided by the previous year-end price minus one. It is not your personal investment return.</p></div></details>
  </div>;
}
