"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { LotProfitability } from "@/lib/analytics/profitability";
import { useTimeViewport } from "@/components/time-viewport";
import { lotsInViewport } from "@/lib/charts/series";
import type { BenchmarkView } from "@/lib/analytics/benchmark-portfolio";
import { BenchmarkMethodology, ComparisonViewControl, DecisionComparisonRows } from "@/components/benchmark-comparison";

type LotTab = "open" | "closed" | "all";

export function PurchaseLotsTable({ lots, comparison }: { lots: LotProfitability[]; comparison?: BenchmarkView }) {
  const [compare, setCompare] = useState(false);
  const [tab, setTab] = useState<LotTab>("open");
  const { range } = useTimeViewport();
  const rows = useMemo(() => lotsInViewport(lots, range, tab), [lots, range, tab]);
  const comparisonsById = useMemo(() => new Map(comparison?.lots.map((row) => [row.id, row]) ?? []), [comparison]);

  return <section className="space-y-4" aria-labelledby="purchase-lots-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="purchase-lots-heading" className="alpha-section-title">Purchase lots</h2><p className="mt-1 text-sm text-muted-foreground">Every purchase decision remains available after a sale.</p></div><div className="inline-flex rounded-md border border-border bg-card p-1" role="tablist" aria-label="Purchase lot status">{(["open", "closed", "all"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn("alpha-focus rounded px-3 py-1.5 text-sm capitalize text-muted-foreground", tab === value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{value}</button>)}</div></div>
    {comparison ? <ComparisonViewControl active={compare} onChange={setCompare} /> : null}
    {rows.length === 0 ? <div className="alpha-surface flex h-36 items-center justify-center text-sm text-muted-foreground">No {tab === "all" ? "" : `${tab} `}purchase lots in this period.</div> : compare && comparison ? <DecisionComparisonRows rows={rows.flatMap((lot) => { const row = comparisonsById.get(lot.id); return row ? [row] : []; })} label={comparison.label} /> : <>
      <div className="hidden overflow-clip rounded-lg border border-border bg-card md:block"><table className="alpha-table"><thead><tr><th>Date</th><th className="text-right">Qty</th><th className="text-right">Buy Price</th><th className="text-right">Deployed</th><th className="text-right">Value / Reference</th><th className="text-right">Current model return</th><th className="text-right">Current model XIRR</th></tr></thead><tbody>{rows.map((lot) => <tr key={lot.id}><td>{formatDate(lot.tradeDate)}</td><td className="text-right">{formatNumber(lot.quantity)}</td><td className="text-right">{formatCurrency(lot.buyPrice, lot.currency)}</td><td className="text-right">{formatCurrency(lot.costBasis, lot.currency)}</td><td className="text-right">{formatCurrency(lot.remainingQuantity > 0 ? lot.currentValue : lot.attributedSaleProceeds, lot.currency)}</td><td className="text-right">{formatPercent(lot.totalReturnPercent)}</td><td className="text-right">{formatPercent(lot.annualizedReturnPercent)}</td></tr>)}</tbody></table></div>
      <div className="space-y-2 md:hidden">{rows.map((lot) => <article key={lot.id} className="alpha-surface p-4"><div className="flex justify-between gap-4"><div><p className="font-medium">{formatDate(lot.tradeDate)}</p><p className="mt-1 text-xs text-muted-foreground">{formatNumber(lot.quantity)} shares at {formatCurrency(lot.buyPrice, lot.currency)}</p></div><span className="text-sm capitalize">{lot.remainingQuantity > 0 ? "Open" : "Closed"}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm"><div><dt className="text-muted-foreground">Deployed</dt><dd>{formatCurrency(lot.costBasis, lot.currency)}</dd></div><div><dt className="text-muted-foreground">Value / reference</dt><dd>{formatCurrency(lot.remainingQuantity > 0 ? lot.currentValue : lot.attributedSaleProceeds, lot.currency)}</dd></div><div><dt className="text-muted-foreground">Current model return</dt><dd>{formatPercent(lot.totalReturnPercent)}</dd></div><div><dt className="text-muted-foreground">Current model XIRR</dt><dd>{formatPercent(lot.annualizedReturnPercent)}</dd></div></dl></article>)}</div>
    </>}
    <p className="text-xs leading-5 text-muted-foreground">The visible period filters purchase dates only; returns retain their current valuation. Current-model returns include recorded dividends. Investment Detail uses LIFO. Yield on Cost is defined at investment level.</p>
    {compare && comparison ? <BenchmarkMethodology comparison={comparison} /> : null}
  </section>;
}
