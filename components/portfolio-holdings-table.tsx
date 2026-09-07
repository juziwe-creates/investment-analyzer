"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { PortfolioHolding } from "@/lib/analytics/portfolio";

type SortKey = "name" | "value" | "deployed" | "annualized" | "weight";

function detailHref(securityKey: string, portfolio: string | null) {
  const path = `/portfolio/${encodeURIComponent(securityKey)}`;
  return portfolio ? `${path}?portfolio=${encodeURIComponent(portfolio)}` : path;
}

function SortButton({ label, value, onSort }: { label: string; value: SortKey; onSort: (value: SortKey) => void }) {
  return <button type="button" className="alpha-focus inline-flex items-center gap-1" onClick={() => onSort(value)}>{label}<ArrowUpDown className="h-3 w-3" aria-hidden="true" /></button>;
}

export function PortfolioHoldingsTable({ holdings }: { holdings: PortfolioHolding[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portfolio = searchParams.get("portfolio");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [ascending, setAscending] = useState(false);
  const totalValue = useMemo(
    () => holdings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0),
    [holdings]
  );
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const valueFor = (holding: PortfolioHolding): string | number => {
      if (sortKey === "name") return holding.securityName.toLowerCase();
      if (sortKey === "value") return holding.marketValue ?? -Infinity;
      if (sortKey === "deployed") return holding.investedCapital;
      if (sortKey === "annualized") return holding.annualizedReturnPercent ?? -Infinity;
      return totalValue > 0 && holding.marketValue !== null ? holding.marketValue / totalValue : -Infinity;
    };

    return holdings
      .filter((holding) => !term || holding.securityName.toLowerCase().includes(term) || holding.securityKey.toLowerCase().includes(term))
      .sort((a, b) => {
        const left = valueFor(a);
        const right = valueFor(b);
        const result = typeof left === "string" && typeof right === "string" ? left.localeCompare(right) : Number(left) - Number(right);
        return ascending ? result : -result;
      });
  }, [ascending, holdings, search, sortKey, totalValue]);

  function changeSort(next: SortKey) {
    if (next === sortKey) {
      setAscending((value) => !value);
      return;
    }
    setSortKey(next);
    setAscending(next === "name");
  }

  if (holdings.length === 0) {
    return <section className="alpha-surface flex min-h-56 items-center justify-center px-6 text-center"><div><h2 className="alpha-section-title">No current holdings</h2><p className="mt-2 text-sm text-muted-foreground">Add or import buy transactions, then sync prices to begin portfolio analysis.</p></div></section>;
  }

  return (
    <section className="space-y-4" aria-labelledby="holdings-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 id="holdings-heading" className="alpha-section-title">Current holdings</h2><p className="mt-1 text-sm text-muted-foreground">{rows.length} of {holdings.length} investments</p></div>
        <label className="relative block w-full sm:w-72"><span className="sr-only">Filter holdings</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter investments" className="pl-9" /></label>
      </div>
      {rows.length === 0 ? <div className="alpha-surface flex h-40 items-center justify-center text-sm text-muted-foreground">No holdings match this filter.</div> : (
        <>
          <div className="hidden overflow-clip rounded-lg border border-border/80 bg-card md:block">
            <table className="alpha-table"><thead><tr><th><SortButton label="Investment" value="name" onSort={changeSort} /></th><th className="text-right"><SortButton label="Value" value="value" onSort={changeSort} /></th><th className="text-right"><SortButton label="Deployed" value="deployed" onSort={changeSort} /></th><th className="text-right">Return</th><th className="text-right"><SortButton label="Ann. Return" value="annualized" onSort={changeSort} /></th><th className="text-right">Yield on Cost</th><th className="text-right"><SortButton label="Ptf Weight" value="weight" onSort={changeSort} /></th></tr></thead>
              <tbody>{rows.map((holding) => {
                const weight = totalValue > 0 && holding.marketValue !== null ? (holding.marketValue / totalValue) * 100 : null;
                const href = detailHref(holding.securityKey, portfolio);
                return <tr key={holding.securityKey} role="link" tabIndex={0} className="cursor-pointer" onClick={() => router.push(href)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(href); } }}>
                  <td><p className="font-medium">{holding.securityName}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatNumber(holding.quantity)} shares</p></td>
                  <td className="text-right">{formatCurrency(holding.marketValue, holding.currency)}</td><td className="text-right">{formatCurrency(holding.investedCapital, holding.currency)}</td>
                  <td className="text-right text-muted-foreground" title="Total Return definition is pending approval">Pending</td><td className="text-right">{formatPercent(holding.annualizedReturnPercent)}</td><td className="text-right text-muted-foreground" title="Yield on Cost definition is pending approval">Pending</td><td className="text-right">{formatPercent(weight)}</td>
                </tr>;
              })}</tbody></table>
          </div>
          <div className="space-y-2 md:hidden">{rows.map((holding) => {
            const weight = totalValue > 0 && holding.marketValue !== null ? (holding.marketValue / totalValue) * 100 : null;
            return <button key={holding.securityKey} type="button" onClick={() => router.push(detailHref(holding.securityKey, portfolio))} className="alpha-focus alpha-surface w-full p-4 text-left"><div className="flex items-start justify-between gap-4"><div><p className="font-medium">{holding.securityName}</p><p className="mt-1 text-lg font-medium">{formatCurrency(holding.marketValue, holding.currency)}</p></div><span className="text-sm font-medium">{formatPercent(weight)}</span></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-sm"><div><span className="text-muted-foreground">Deployed</span><p>{formatCurrency(holding.investedCapital, holding.currency)}</p></div><div><span className="text-muted-foreground">Annualized</span><p>{formatPercent(holding.annualizedReturnPercent)}</p></div></div></button>;
          })}</div>
        </>
      )}
    </section>
  );
}
