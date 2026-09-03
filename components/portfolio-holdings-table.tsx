"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { PortfolioHolding } from "@/lib/analytics/portfolio";

type PortfolioHoldingsTableProps = {
  holdings: PortfolioHolding[];
};

function numericFilterValue(value: string) {
  const normalizedValue = value.trim().replace(",", ".");

  if (!normalizedValue) {
    return null;
  }

  const parsed = Number(normalizedValue);

  return Number.isFinite(parsed) ? parsed : null;
}

function isAtLeast(value: number | null, filter: string) {
  const parsed = numericFilterValue(filter);

  if (parsed === null) {
    return true;
  }

  return value !== null && value >= parsed;
}

function isAtMost(value: number | null, filter: string) {
  const parsed = numericFilterValue(filter);

  if (parsed === null) {
    return true;
  }

  return value !== null && value <= parsed;
}

function toneClass(value: number | null) {
  if (value === null || value === 0) {
    return "text-foreground";
  }

  return value > 0 ? "text-[hsl(var(--positive))]" : "text-[hsl(var(--negative))]";
}

export function PortfolioHoldingsTable({ holdings }: PortfolioHoldingsTableProps) {
  const [search, setSearch] = useState("");
  const [minTotalGain, setMinTotalGain] = useState("");
  const [maxTotalGain, setMaxTotalGain] = useState("");
  const [minTotalReturn, setMinTotalReturn] = useState("");
  const [maxTotalReturn, setMaxTotalReturn] = useState("");
  const [minAnnualizedReturn, setMinAnnualizedReturn] = useState("");
  const [maxAnnualizedReturn, setMaxAnnualizedReturn] = useState("");
  const [priceStatus, setPriceStatus] = useState("all");
  const totalMarketValue = useMemo(
    () => holdings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0),
    [holdings]
  );
  const filteredHoldings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return holdings
      .filter((holding) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          holding.securityName.toLowerCase().includes(normalizedSearch) ||
          holding.securityKey.toLowerCase().includes(normalizedSearch);
        const matchesPriceStatus =
          priceStatus === "all" ||
          (priceStatus === "priced" && holding.marketValue !== null) ||
          (priceStatus === "unpriced" && holding.marketValue === null);

        return (
          matchesSearch &&
          matchesPriceStatus &&
          isAtLeast(holding.totalProfitability, minTotalGain) &&
          isAtMost(holding.totalProfitability, maxTotalGain) &&
          isAtLeast(holding.totalReturnPercent, minTotalReturn) &&
          isAtMost(holding.totalReturnPercent, maxTotalReturn) &&
          isAtLeast(holding.annualizedReturnPercent, minAnnualizedReturn) &&
          isAtMost(holding.annualizedReturnPercent, maxAnnualizedReturn)
        );
      })
      .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
  }, [
    holdings,
    maxAnnualizedReturn,
    maxTotalGain,
    maxTotalReturn,
    minAnnualizedReturn,
    minTotalGain,
    minTotalReturn,
    priceStatus,
    search
  ]);
  const hasActiveFilters =
    search ||
    minTotalGain ||
    maxTotalGain ||
    minTotalReturn ||
    maxTotalReturn ||
    minAnnualizedReturn ||
    maxAnnualizedReturn ||
    priceStatus !== "all";

  function clearFilters() {
    setSearch("");
    setMinTotalGain("");
    setMaxTotalGain("");
    setMinTotalReturn("");
    setMaxTotalReturn("");
    setMinAnnualizedReturn("");
    setMaxAnnualizedReturn("");
    setPriceStatus("all");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
        <CardDescription>
          Current positions derived from buy and sell transactions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {holdings.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            Add buy transactions and prices to see current holdings.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Stock</span>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or ISIN"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Price status</span>
                <select
                  value={priceStatus}
                  onChange={(event) => setPriceStatus(event.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All</option>
                  <option value="priced">Priced only</option>
                  <option value="unpriced">Missing price</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Total gain min</span>
                <Input
                  value={minTotalGain}
                  onChange={(event) => setMinTotalGain(event.target.value)}
                  inputMode="decimal"
                  placeholder="EUR"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Total gain max</span>
                <Input
                  value={maxTotalGain}
                  onChange={(event) => setMaxTotalGain(event.target.value)}
                  inputMode="decimal"
                  placeholder="EUR"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Total return min %</span>
                <Input
                  value={minTotalReturn}
                  onChange={(event) => setMinTotalReturn(event.target.value)}
                  inputMode="decimal"
                  placeholder="%"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Total return max %</span>
                <Input
                  value={maxTotalReturn}
                  onChange={(event) => setMaxTotalReturn(event.target.value)}
                  inputMode="decimal"
                  placeholder="%"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Annualized min %</span>
                <Input
                  value={minAnnualizedReturn}
                  onChange={(event) => setMinAnnualizedReturn(event.target.value)}
                  inputMode="decimal"
                  placeholder="%"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Annualized max %</span>
                <Input
                  value={maxAnnualizedReturn}
                  onChange={(event) => setMaxAnnualizedReturn(event.target.value)}
                  inputMode="decimal"
                  placeholder="%"
                />
              </label>
              <div className="flex items-end justify-between gap-3 text-sm text-muted-foreground xl:col-span-4">
                <span>
                  Showing {filteredHoldings.length} of {holdings.length} holdings
                </span>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-background"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>

            {filteredHoldings.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
                No holdings match the current filters.
              </div>
            ) : (
              <table className="alpha-table min-w-[1240px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th>Investment</th>
                      <th className="text-right">Value</th>
                      <th className="text-right">Deployed</th>
                      <th className="text-right">Return</th>
                      <th className="text-right">Ann. Return</th>
                      <th className="text-right">Yield on Cost</th>
                      <th className="text-right">Ptf Weight</th>
                      <th>Price date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHoldings.map((holding) => {
                      const portfolioWeight =
                        totalMarketValue > 0 && holding.marketValue !== null
                          ? (holding.marketValue / totalMarketValue) * 100
                          : null;
                      const yieldOnCost =
                        holding.investedCapital > 0
                          ? (holding.dividendsReceived / holding.investedCapital) * 100
                          : null;

                      return (
                        <tr key={holding.securityKey} className="border-b last:border-0">
                          <td className="font-medium">
                            <div>{holding.securityName}</div>
                            <div className="text-xs font-normal text-muted-foreground">
                              {formatNumber(holding.quantity)} shares · latest{" "}
                              {formatCurrency(holding.latestPrice, holding.currency)}
                            </div>
                          </td>
                          <td className="text-right">
                            {formatCurrency(holding.marketValue, holding.currency)}
                          </td>
                          <td className="text-right">
                            {formatCurrency(holding.investedCapital, holding.currency)}
                          </td>
                          <td className={cn("text-right font-medium", toneClass(holding.totalProfitability))}>
                            <div>{formatCurrency(holding.totalProfitability, holding.currency)}</div>
                            <div className="text-xs font-normal">
                              {formatPercent(holding.totalReturnPercent)}
                            </div>
                          </td>
                          <td className={cn("text-right", toneClass(holding.annualizedReturnPercent))}>
                            {formatPercent(holding.annualizedReturnPercent)}
                          </td>
                          <td className="text-right">{formatPercent(yieldOnCost)}</td>
                          <td className="text-right">{formatPercent(portfolioWeight)}</td>
                          <td className="text-muted-foreground">
                            {holding.priceDate ? formatDate(holding.priceDate) : "Add price"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
