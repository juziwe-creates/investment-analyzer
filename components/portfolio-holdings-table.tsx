"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
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

export function PortfolioHoldingsTable({ holdings }: PortfolioHoldingsTableProps) {
  const [search, setSearch] = useState("");
  const [minTotalGain, setMinTotalGain] = useState("");
  const [maxTotalGain, setMaxTotalGain] = useState("");
  const [minTotalReturn, setMinTotalReturn] = useState("");
  const [maxTotalReturn, setMaxTotalReturn] = useState("");
  const [minAnnualizedReturn, setMinAnnualizedReturn] = useState("");
  const [maxAnnualizedReturn, setMaxAnnualizedReturn] = useState("");
  const [priceStatus, setPriceStatus] = useState("all");
  const filteredHoldings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return holdings.filter((holding) => {
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
    });
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
        <CardTitle>Current holdings</CardTitle>
        <CardDescription>
          Open positions derived from buy and sell transactions.
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
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <table className="w-full min-w-[1240px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Security</th>
                      <th className="px-3 py-2 text-right font-medium">Quantity</th>
                      <th className="px-3 py-2 text-right font-medium">Invested capital</th>
                      <th className="px-3 py-2 text-right font-medium">Latest price</th>
                      <th className="px-3 py-2 text-right font-medium">Market value</th>
                      <th className="px-3 py-2 text-right font-medium">Gain/loss</th>
                      <th className="px-3 py-2 text-right font-medium">Dividends</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Total gain incl. dividends
                      </th>
                      <th className="px-3 py-2 text-right font-medium">Total return</th>
                      <th className="px-3 py-2 text-right font-medium">Annualized return</th>
                      <th className="px-3 py-2 font-medium">Price date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHoldings.map((holding) => (
                      <tr key={holding.securityKey} className="border-b last:border-0">
                        <td className="px-3 py-3 font-medium">{holding.securityName}</td>
                        <td className="px-3 py-3 text-right">{formatNumber(holding.quantity)}</td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(holding.investedCapital, holding.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(holding.latestPrice, holding.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(holding.marketValue, holding.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(holding.investmentGain, holding.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(holding.dividendsReceived, holding.currency)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {formatCurrency(holding.totalProfitability, holding.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatPercent(holding.totalReturnPercent)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatPercent(holding.annualizedReturnPercent)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {holding.priceDate ? formatDate(holding.priceDate) : "Add price"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
              </table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
