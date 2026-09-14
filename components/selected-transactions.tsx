"use client";

import { useMemo, useState } from "react";
import { DecisionDrawer } from "@/components/decision-drawer";
import type { SelectedTransaction } from "@/lib/analytics/selected-transactions";
import { dateString, type TimeRange } from "@/lib/charts/time-viewport";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";

function metrics(row: SelectedTransaction) {
  return [
    { label: "Qty", value: formatNumber(row.quantity) },
    { label: "Price", value: formatCurrency(row.price, row.currency) },
    { label: row.type === "dividend" ? "Dividend cash" : "Deployed / Proceeds", value: formatCurrency(row.amount, row.currency) },
    { label: "Value / Reference", value: formatCurrency(row.reference, row.currency) },
    { label: "Current model return", value: formatPercent(row.returnPercent) },
    { label: "Current model XIRR", value: formatPercent(row.xirr) }
  ];
}

export function SelectedTransactions({ transactions, range }: { transactions: SelectedTransaction[]; range: TimeRange | null }) {
  const [selected, setSelected] = useState<SelectedTransaction | null>(null);
  const rows = useMemo(() => range ? transactions.filter((row) => row.date >= dateString(range.start) && row.date <= dateString(range.end)) : [], [transactions, range]);
  return <section className="space-y-4 border-t border-border/70 pt-5" aria-label="Transactions in selected period">
    <div><h3 className="alpha-section-title">Transactions in selected period</h3>{range ? <p className="mt-1 text-sm text-muted-foreground">{formatDate(dateString(range.start))} - {formatDate(dateString(range.end))} · {rows.length} transactions</p> : null}</div>
    {!range || !rows.length ? <p className="py-6 text-center text-sm text-muted-foreground">{range ? "No transactions in this period." : "Select a period to inspect transactions."}</p> : <>
      <div className="hidden rounded-md border border-border bg-card xl:block"><table className="alpha-table w-full table-fixed"><thead><tr>{["Date", "Type", "Investment", "Qty", "Price", "Deployed / Proceeds", "Value / Reference", "Return", "XIRR"].map((label, index) => <th key={label} className={index > 2 ? "text-right" : ""}>{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="cursor-pointer" onClick={() => setSelected(row)}><td>{formatDate(row.date)}</td><td className="uppercase">{row.type}</td><td><button type="button" className="alpha-focus text-left" onClick={() => setSelected(row)}>{row.name}</button></td>{metrics(row).map((item) => <td key={item.label} className="text-right tabular-nums">{item.value}</td>)}</tr>)}</tbody></table></div>
      <div className="space-y-2 xl:hidden">{rows.map((row) => <article key={row.id} className="alpha-surface p-4"><button type="button" onClick={() => setSelected(row)} className="alpha-focus w-full text-left"><span className="flex justify-between gap-4"><span className="font-medium">{row.name}</span><span className="text-xs uppercase text-muted-foreground">{row.type}</span></span><span className="mt-1 block text-sm text-muted-foreground">{formatDate(row.date)}</span><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm">{metrics(row).map((item) => <div key={item.label}><dt className="text-muted-foreground">{item.label}</dt><dd className="tabular-nums">{item.value}</dd></div>)}</dl></button></article>)}</div>
      <p className="text-xs text-muted-foreground">Buy rows use the Purchase Lots LIFO model. Sale and dividend rows show transaction facts; standalone returns do not apply.</p>
    </>}
    <DecisionDrawer modal={false} open={selected !== null} onClose={() => setSelected(null)} eyebrow={selected?.type.toUpperCase() ?? "Transaction"} title={selected?.name ?? "Transaction"} subtitle={selected ? formatDate(selected.date) : undefined} metrics={selected ? metrics(selected) : []} note="Source-of-truth transactions. Buy returns reuse the current Purchase Lots model; unresolved canonical return and lot-policy definitions are unchanged." />
  </section>;
}
