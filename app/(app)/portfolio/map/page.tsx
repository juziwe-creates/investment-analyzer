import Link from "next/link";
import { PortfolioMap } from "@/components/portfolio-map";
import { buildCurrentAnalytics } from "@/lib/analytics/portfolio";
import { benchmarkView, buildBenchmarkComparison } from "@/lib/analytics/benchmark-portfolio";
import { parseBenchmark } from "@/lib/analytics/benchmarks";
import { readBenchmarkHistory } from "@/lib/market-data/benchmark-history";
import { buildPortfolioMapModel } from "@/lib/portfolio-map/model";
import { presentationTransactions } from "@/lib/presentation";
import { createClient } from "@/lib/supabase/server";

export default async function PortfolioMapPage({ searchParams }: {
  searchParams: Promise<{ portfolio?: string; benchmark?: string }>;
}) {
  const { portfolio: portfolioId, benchmark: rawBenchmark } = await searchParams;
  const benchmarkId = parseBenchmark(rawBenchmark);
  const supabase = await createClient();
  const transactionsQuery = presentationTransactions(portfolioId);
  const latestQuery = supabase.from("latest_market_prices").select("*");
  const manualQuery = supabase.from("manual_security_prices").select("*");
  if (portfolioId) {
    latestQuery.eq("portfolio_id", portfolioId);
    manualQuery.eq("portfolio_id", portfolioId);
  }
  const [transactionsResult, latestResult, manualResult, reference] = await Promise.all([
    transactionsQuery, latestQuery, manualQuery, readBenchmarkHistory(benchmarkId)
  ]);
  const error = [transactionsResult.error, latestResult.error, manualResult.error].find(Boolean);
  const transactions = transactionsResult.data ?? [];
  const { holdings, lots } = buildCurrentAnalytics(transactions, latestResult.data ?? [], manualResult.data ?? [], { lotMatchingMethod: "fifo" });
  const comparison = buildBenchmarkComparison(lots, reference.data, benchmarkId, "fifo");
  if (reference.error) comparison.error = reference.error;
  const tickerByKey = new Map(transactions.flatMap((transaction) => {
    const key = transaction.isin ?? transaction.ticker ?? transaction.security_name;
    return transaction.ticker ? [[key, transaction.ticker] as const] : [];
  }));
  const model = buildPortfolioMapModel({ holdings, lots, comparison: benchmarkView(comparison), benchmarkId, portfolioId, tickerByKey });
  const back = portfolioId ? `/portfolio?portfolio=${encodeURIComponent(portfolioId)}` : "/portfolio";

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/70 pb-5">
      <div><Link href={back} className="alpha-focus text-sm text-muted-foreground hover:text-foreground">Back to Investments</Link><h1 className="mt-4 text-3xl font-medium">Portfolio Map</h1><p className="mt-2 text-sm text-muted-foreground">Composition, relative performance, and the purchase decisions behind each investment.</p></div>
    </header>
    {error ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.message}</p> : <PortfolioMap model={model} portfolioId={portfolioId} />}
  </div>;
}
