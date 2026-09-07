"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { StockAnalyticsRow } from "@/lib/analytics/transaction-analytics";

type InventoryTab = "current" | "closed" | "all";

export function InvestmentInventoryTable({ rows }: { rows: StockAnalyticsRow[] }) {
  const portfolio = useSearchParams().get("portfolio");
  const [tab, setTab] = useState<InventoryTab>("current");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => (tab === "all" || (tab === "current" ? row.openQuantity > 0 : row.openQuantity <= 0)) && (!term || row.securityName.toLowerCase().includes(term))).sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0));
  }, [rows, search, tab]);

  return <section className="space-y-4" aria-labelledby="investment-inventory-heading">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="investment-inventory-heading" className="alpha-section-title">Investment inventory</h2><div className="mt-3 inline-flex rounded-md border border-border bg-card p-1" role="tablist" aria-label="Investment state">{(["current", "closed", "all"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn("alpha-focus rounded px-3 py-1.5 text-sm capitalize text-muted-foreground", tab === value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{value}</button>)}</div></div><label className="relative block w-full sm:w-72"><span className="sr-only">Search investments</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search investments" className="pl-9" /></label></div>
    {filtered.length === 0 ? <div className="alpha-surface flex h-44 items-center justify-center px-6 text-center text-sm text-muted-foreground">No {tab} investments match this view.</div> : <div className="grid gap-2">{filtered.map((row) => {
      const path = `/portfolio/${encodeURIComponent(row.securityKey)}`;
      const href = portfolio ? `${path}?portfolio=${encodeURIComponent(portfolio)}` : path;
      return <Link key={row.securityKey} href={href} className="alpha-focus alpha-surface grid gap-3 p-4 transition-colors hover:bg-[hsl(var(--accent-subtle))]/50 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(110px,auto))] sm:items-center"><div><p className="font-medium">{row.securityName}</p><p className="mt-1 text-xs text-muted-foreground">First purchase {formatDate(row.firstPurchaseDate)}</p></div><div className="sm:text-right"><span className="text-xs text-muted-foreground">Open quantity</span><p>{formatNumber(row.openQuantity)}</p></div><div className="sm:text-right"><span className="text-xs text-muted-foreground">Current value</span><p>{formatCurrency(row.currentValue, row.currency)}</p></div><div className="sm:text-right"><span className="text-xs text-muted-foreground">Status</span><p>{row.openQuantity > 0 ? "Current" : "Closed"}</p></div></Link>;
    })}</div>}
  </section>;
}
