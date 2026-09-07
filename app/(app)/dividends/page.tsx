import Link from "next/link";
import { eurAggregationStatus } from "@/lib/analytics/currency";
import { transactionSecurityKey } from "@/lib/analytics/portfolio";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

export default async function DividendsPage({ searchParams }: { searchParams: Promise<{ portfolio?: string }> }) {
  const { portfolio: portfolioId } = await searchParams;
  const supabase = await createClient();
  const query = supabase.from("transactions").select("*").eq("type", "dividend").order("trade_date", { ascending: false }).order("created_at", { ascending: false });
  if (portfolioId) query.eq("portfolio_id", portfolioId);
  const { data, error } = await query;
  const dividends = data ?? [];
  const amount = (transaction: (typeof dividends)[number]) => Math.abs(transaction.gross_amount ?? transaction.net_amount ?? ((transaction.quantity ?? 0) * (transaction.unit_price ?? 0)));
  const { canAggregate: currencyReady, unsupportedCurrencies } = eurAggregationStatus(dividends.map((transaction) => transaction.currency));
  const currentYear = String(new Date().getUTCFullYear());
  const total = dividends.reduce((sum, transaction) => sum + amount(transaction), 0);
  const currentYearTotal = dividends.filter((transaction) => transaction.trade_date.startsWith(currentYear)).reduce((sum, transaction) => sum + amount(transaction), 0);
  const bySecurity = new Map<string, { key: string; name: string; total: number; count: number; latest: string }>();
  const byYear = new Map<string, number>();
  dividends.forEach((transaction) => {
    const key = transactionSecurityKey(transaction);
    const existing = bySecurity.get(key);
    bySecurity.set(key, existing ? { ...existing, total: existing.total + amount(transaction), count: existing.count + 1, latest: existing.latest > transaction.trade_date ? existing.latest : transaction.trade_date } : { key, name: transaction.security_name, total: amount(transaction), count: 1, latest: transaction.trade_date });
    const year = transaction.trade_date.slice(0, 4);
    byYear.set(year, (byYear.get(year) ?? 0) + amount(transaction));
  });
  const securityRows = [...bySecurity.values()].sort((a, b) => b.total - a.total);
  const yearRows = [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return <div className="space-y-10">
    <header className="border-b border-border/70 pb-7"><p className="alpha-kpi-label">Income</p><h1 className="mt-2 text-3xl font-medium">Dividends</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Received dividend cash from your transaction ledger, grouped by investment and year.</p></header>
    {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.message}</div> : null}
    {!currencyReady ? <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">EUR conversion is unavailable for {unsupportedCurrencies.join(", ")}. Cross-currency dividend totals are withheld.</div> : null}
    {dividends.length === 0 ? <section className="alpha-surface flex min-h-64 items-center justify-center px-6 text-center"><div><h2 className="alpha-section-title">No dividend payments yet</h2><p className="mt-2 text-sm text-muted-foreground">Import or add dividend transactions to see income analysis.</p><Link href={portfolioId ? `/transactions?portfolio=${encodeURIComponent(portfolioId)}` : "/transactions"} className="alpha-focus mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Add transactions</Link></div></section> : <>
      <section className="grid gap-x-8 gap-y-6 border-b border-border/70 pb-7 sm:grid-cols-2 lg:grid-cols-4"><div className="sm:col-span-2"><p className="alpha-kpi-label">Total dividends received</p><p className="mt-2 text-4xl font-medium">{currencyReady ? formatCurrency(total, "EUR") : "Unavailable"}</p></div><div><p className="alpha-kpi-label">This year</p><p className="mt-2 text-2xl font-medium">{currencyReady ? formatCurrency(currentYearTotal, "EUR") : "Unavailable"}</p></div><div><p className="alpha-kpi-label">Payments</p><p className="mt-2 text-2xl font-medium">{dividends.length}</p></div></section>
      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"><div className="space-y-4"><div><h2 className="alpha-section-title">Contribution by investment</h2><p className="mt-1 text-sm text-muted-foreground">Actual received cash, not provider estimates.</p></div><div className="overflow-clip rounded-lg border border-border bg-card"><table className="alpha-table"><thead><tr><th>Investment</th><th className="text-right">Payments</th><th className="text-right">Received</th><th className="text-right">Latest</th></tr></thead><tbody>{securityRows.map((row) => { const path = `/portfolio/${encodeURIComponent(row.key)}`; const href = portfolioId ? `${path}?portfolio=${encodeURIComponent(portfolioId)}` : path; return <tr key={row.key}><td><Link href={href} className="alpha-focus font-medium hover:text-[hsl(var(--accent-brand))]">{row.name}</Link></td><td className="text-right">{row.count}</td><td className="text-right">{currencyReady ? formatCurrency(row.total, "EUR") : "Unavailable"}</td><td className="text-right text-muted-foreground">{formatDate(row.latest)}</td></tr>; })}</tbody></table></div></div>
      <div className="space-y-4"><div><h2 className="alpha-section-title">By year</h2><p className="mt-1 text-sm text-muted-foreground">Calendar-year received dividends.</p></div><dl className="alpha-surface divide-y divide-border/70 px-4">{yearRows.map(([year, value]) => <div key={year} className="flex items-baseline justify-between py-3"><dt className="text-sm text-muted-foreground">{year}</dt><dd className="font-medium">{currencyReady ? formatCurrency(value, "EUR") : "Unavailable"}</dd></div>)}</dl></div></section>
      <section className="space-y-4"><div><h2 className="alpha-section-title">Dividend history</h2><p className="mt-1 text-sm text-muted-foreground">Complete received-payment history for the selected account context.</p></div><div className="space-y-2 md:hidden">{dividends.map((transaction) => <article key={transaction.id} className="alpha-surface p-4"><div className="flex justify-between gap-4"><div><p className="font-medium">{transaction.security_name}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(transaction.trade_date)}</p></div><p className="font-medium">{formatCurrency(amount(transaction), transaction.currency)}</p></div></article>)}</div><div className="hidden overflow-clip rounded-lg border border-border bg-card md:block"><table className="alpha-table"><thead><tr><th>Date</th><th>Investment</th><th className="text-right">Gross/received amount</th><th className="text-right">Yield on Cost</th></tr></thead><tbody>{dividends.map((transaction) => <tr key={transaction.id}><td>{formatDate(transaction.trade_date)}</td><td>{transaction.security_name}</td><td className="text-right">{formatCurrency(amount(transaction), transaction.currency)}</td><td className="text-right text-muted-foreground" title="Yield on Cost definition is unresolved">Pending definition</td></tr>)}</tbody></table></div></section>
      <details className="alpha-surface p-4"><summary className="alpha-focus cursor-pointer font-medium">How is this calculated?</summary><p className="mt-3 text-sm leading-6 text-muted-foreground">Amounts use gross amount when present, otherwise net amount, otherwise quantity multiplied by unit price, as documented in Analytics Rules. Gross/after-tax performance treatment and Yield on Cost remain unresolved.</p></details>
    </>}
  </div>;
}
