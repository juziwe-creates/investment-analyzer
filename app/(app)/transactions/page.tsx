import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { buildCurrentAnalytics } from "@/lib/analytics/portfolio";
import { calculateTransactionAnalytics } from "@/lib/analytics/transaction-analytics";
import { createClient } from "@/lib/supabase/server";

const pageSize = 50;

function pageHref(page: number, portfolioId?: string) { const params = new URLSearchParams({ page: String(page) }); if (portfolioId) params.set("portfolio", portfolioId); return `/transactions?${params}`; }

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ message?: string; page?: string; portfolio?: string }> }) {
  const { message, page: rawPage, portfolio: portfolioId } = await searchParams;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const supabase = await createClient();
  const ledgerQuery = supabase.from("transactions").select("*", { count: "exact" }).order("trade_date", { ascending: false }).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  const analyticsTransactionsQuery = supabase.from("transactions").select("*").order("trade_date", { ascending: true }).order("created_at", { ascending: true });
  const latestQuery = supabase.from("latest_market_prices").select("*");
  const manualQuery = supabase.from("manual_security_prices").select("*");
  if (portfolioId) { ledgerQuery.eq("portfolio_id", portfolioId); analyticsTransactionsQuery.eq("portfolio_id", portfolioId); latestQuery.eq("portfolio_id", portfolioId); manualQuery.eq("portfolio_id", portfolioId); }
  const [{ data: ledger, count, error: ledgerError }, { data: analyticsTransactions, error: analyticsError }, { data: latestPrices, error: latestError }, { data: manualPrices, error: manualError }] = await Promise.all([ledgerQuery, analyticsTransactionsQuery, latestQuery, manualQuery]);
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const { lots } = buildCurrentAnalytics(analyticsTransactions ?? [], latestPrices ?? [], manualPrices ?? [], { lotMatchingMethod: "lifo" });
  const analyticsRows = calculateTransactionAnalytics(lots);
  const errors = [ledgerError, analyticsError, latestError, manualError].filter(Boolean);

  return <div className="space-y-10">
    <header className="border-b border-border/70 pb-7"><p className="alpha-kpi-label">Source of truth</p><h1 className="mt-2 text-3xl font-medium">Transactions</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Your private event ledger. Portfolio, investments, dividends, and decision analytics derive from these records.</p></header>
    {message ? <div className="alpha-surface px-4 py-3 text-sm text-muted-foreground">{message}</div> : null}
    {errors.length ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errors[0]?.message}</div> : null}
    <details className="alpha-surface p-4"><summary className="alpha-focus cursor-pointer font-medium">Add a transaction</summary><div className="mt-5"><TransactionForm portfolioId={portfolioId} /></div></details>
    <TransactionList transactions={ledger ?? []} analyticsRows={analyticsRows} page={Math.min(page, pageCount)} pageCount={pageCount} previousHref={page > 1 ? pageHref(page - 1, portfolioId) : null} nextHref={page < pageCount ? pageHref(page + 1, portfolioId) : null} />
  </div>;
}
