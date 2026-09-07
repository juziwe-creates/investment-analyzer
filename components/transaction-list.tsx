"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";
import { DecisionDrawer } from "@/components/decision-drawer";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import type { TransactionAnalyticsRow } from "@/lib/analytics/transaction-analytics";
import type { Database } from "@/types/database";

type Transaction = Pick<Database["public"]["Tables"]["transactions"]["Row"], "id" | "type" | "trade_date" | "security_name" | "isin" | "ticker" | "quantity" | "unit_price" | "gross_amount" | "net_amount" | "currency">;
type SortKey = "date" | "security" | "type" | "amount";

function amount(transaction: Transaction) { return Math.abs(transaction.gross_amount ?? transaction.net_amount ?? ((transaction.quantity ?? 0) * (transaction.unit_price ?? 0))); }

function SortButton({ label, value, onSort }: { label: string; value: SortKey; onSort: (value: SortKey) => void }) {
  return <button type="button" onClick={() => onSort(value)} className="alpha-focus inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3" /></button>;
}

export function TransactionList({ transactions, analyticsRows, page, pageCount, previousHref, nextHref }: { transactions: Transaction[]; analyticsRows: TransactionAnalyticsRow[]; page: number; pageCount: number; previousHref: string | null; nextHref: string | null }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [ascending, setAscending] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const analytics = useMemo(() => new Map(analyticsRows.map((row) => [row.id, row])), [analyticsRows]);
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const value = (transaction: Transaction): string | number => sortKey === "date" ? transaction.trade_date : sortKey === "security" ? transaction.security_name.toLowerCase() : sortKey === "type" ? transaction.type : amount(transaction);
    return transactions.filter((transaction) => !term || `${transaction.security_name} ${transaction.isin ?? ""} ${transaction.ticker ?? ""} ${transaction.type}`.toLowerCase().includes(term)).sort((a, b) => { const left = value(a); const right = value(b); const comparison = typeof left === "string" && typeof right === "string" ? left.localeCompare(right) : Number(left) - Number(right); return ascending ? comparison : -comparison; });
  }, [ascending, search, sortKey, transactions]);
  const selectedAnalytics = selected ? analytics.get(selected.id) : undefined;
  const drawerMetrics = selected ? [
    { label: "Quantity", value: formatNumber(selected.quantity) },
    { label: "Unit price", value: formatCurrency(selected.unit_price, selected.currency) },
    { label: "Transaction amount", value: formatCurrency(amount(selected), selected.currency) },
    ...(selectedAnalytics ? [{ label: "Capital deployed", value: formatCurrency(selectedAnalytics.costBasis, selectedAnalytics.currency) }, { label: "Reference value", value: formatCurrency(selectedAnalytics.referenceValue, selectedAnalytics.currency) }, { label: "Current model return", value: formatPercent(selectedAnalytics.totalRawProfitabilityPercent) }, { label: "Current model XIRR", value: formatPercent(selectedAnalytics.totalRawProfitabilityAnnualizedPercent) }, { label: "Attributed dividends", value: formatCurrency(selectedAnalytics.accumulatedDividendsTaxFree, selectedAnalytics.currency) }, { label: "Yield on Cost", value: "Pending definition" }] : [])
  ] : [];

  function changeSort(next: SortKey) { if (next === sortKey) setAscending((value) => !value); else { setSortKey(next); setAscending(next === "security" || next === "type"); } }
  return <section className="space-y-4" aria-labelledby="transaction-history-heading"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="transaction-history-heading" className="alpha-section-title">Transaction history</h2><p className="mt-1 text-sm text-muted-foreground">Page {page} of {pageCount}. Select a row for source and decision context.</p></div><label className="relative block w-full sm:w-72"><span className="sr-only">Filter current page</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter current page" className="pl-9" /></label></div>
    {transactions.length === 0 ? <div className="alpha-surface flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">No transactions in this account context yet.</div> : <><div className="space-y-2 md:hidden">{rows.map((transaction) => <button key={transaction.id} type="button" onClick={() => setSelected(transaction)} className="alpha-focus alpha-surface w-full p-4 text-left"><div className="flex items-start justify-between gap-4"><div><p className="font-medium">{transaction.security_name}</p><p className="mt-1 text-xs uppercase text-muted-foreground">{transaction.type} · {formatDate(transaction.trade_date)}</p></div><p className="font-medium">{formatCurrency(amount(transaction), transaction.currency)}</p></div><p className="mt-3 text-sm text-muted-foreground">{formatNumber(transaction.quantity)} shares at {formatCurrency(transaction.unit_price, transaction.currency)}</p></button>)}</div><div className="hidden overflow-clip rounded-lg border border-border bg-card md:block"><table className="alpha-table"><thead><tr><th><SortButton label="Date" value="date" onSort={changeSort} /></th><th><SortButton label="Asset" value="security" onSort={changeSort} /></th><th><SortButton label="Type" value="type" onSort={changeSort} /></th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right"><SortButton label="Total" value="amount" onSort={changeSort} /></th></tr></thead><tbody>{rows.map((transaction) => <tr key={transaction.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => setSelected(transaction)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(transaction); } }}><td>{formatDate(transaction.trade_date)}</td><td><p className="font-medium">{transaction.security_name}</p><p className="text-xs text-muted-foreground">{transaction.isin ?? transaction.ticker ?? "No identifier"}</p></td><td className="uppercase">{transaction.type}</td><td className="text-right">{formatNumber(transaction.quantity)}</td><td className="text-right">{formatCurrency(transaction.unit_price, transaction.currency)}</td><td className="text-right">{formatCurrency(amount(transaction), transaction.currency)}</td></tr>)}</tbody></table></div></>}
    <nav className="flex items-center justify-between" aria-label="Transaction pages"><span>{previousHref ? <Link href={previousHref} className="alpha-focus rounded-md border border-border bg-card px-3 py-2 text-sm">Previous</Link> : <span />}</span><span className="text-sm text-muted-foreground">{page} / {pageCount}</span><span>{nextHref ? <Link href={nextHref} className="alpha-focus rounded-md border border-border bg-card px-3 py-2 text-sm">Next</Link> : <span />}</span></nav>
    <DecisionDrawer open={selected !== null} onClose={() => setSelected(null)} eyebrow={selected?.type.toUpperCase() ?? "Transaction"} title={selected?.security_name ?? "Transaction"} subtitle={selected ? formatDate(selected.trade_date) : undefined} metrics={drawerMetrics} note={selectedAnalytics ? "Current-model lot values use the existing LIFO analytical view. Canonical Total Return, dividend tax treatment, Yield on Cost, and lot policy remain pending." : "This source-of-truth transaction has no separate lot analysis."} />
  </section>;
}
