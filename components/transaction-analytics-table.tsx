"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import type { TransactionAnalyticsRow } from "@/lib/analytics/transaction-analytics";

type SortKey =
  | "purchaseDate"
  | "securityName"
  | "quantityBought"
  | "openQuantity"
  | "ownershipStatus"
  | "costBasisPerShare"
  | "costBasis"
  | "currentValue"
  | "currentDividendYieldPercent"
  | "accumulatedDividendsTaxFree"
  | "accumulatedDividendsAfterTax"
  | "totalRawProfitability"
  | "totalRawProfitabilityPercent"
  | "totalRawProfitabilityAnnualizedPercent";

type SortDirection = "asc" | "desc";

type TransactionAnalyticsTableProps = {
  rows: TransactionAnalyticsRow[];
};

function compareValues(
  a: string | number | null,
  b: string | number | null,
  direction: SortDirection
) {
  if (a === null && b === null) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  const result = typeof a === "string" ? a.localeCompare(String(b)) : a - Number(b);

  return direction === "asc" ? result : -result;
}

export function TransactionAnalyticsTable({ rows }: TransactionAnalyticsTableProps) {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalRawProfitability");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows
      .filter((row) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          row.securityName.toLowerCase().includes(normalizedSearch) ||
          row.securityKey.toLowerCase().includes(normalizedSearch);
        const matchesFrom = !fromDate || row.purchaseDate >= fromDate;
        const matchesTo = !toDate || row.purchaseDate <= toDate;

        return matchesSearch && matchesFrom && matchesTo;
      })
      .sort((a, b) => compareValues(a[sortKey], b[sortKey], sortDirection));
  }, [fromDate, rows, search, sortDirection, sortKey, toDate]);
  const hasActiveFilters = search || fromDate || toDate;

  function updateSort(nextSortKey: SortKey) {
    if (nextSortKey === sortKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("desc");
  }

  function clearFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
  }

  function sortableHeader(label: string, key: SortKey, align: "left" | "right" = "right") {
    const isActive = sortKey === key;

    return (
      <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} font-medium`}>
        <button
          type="button"
          onClick={() => updateSort(key)}
          className="inline-flex items-center gap-1 rounded-sm hover:text-foreground"
        >
          {label}
          {isActive ? (
            <span className="text-[10px] uppercase text-foreground">
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </span>
          ) : null}
        </button>
      </th>
    );
  }

  function ownershipLabel(row: TransactionAnalyticsRow) {
    if (row.ownershipStatus === "owned") {
      return `Owned (${formatNumber(row.openQuantity)})`;
    }

    if (row.ownershipStatus === "partially_sold") {
      return `Partial (${formatNumber(row.openQuantity)})`;
    }

    return "Sold";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction analytics</CardTitle>
        <CardDescription>
          Every row is one buy decision, including dividends allocated back to that lot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            Add buy transactions to analyze purchase-level profitability.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto] md:items-end">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Stock</span>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, ISIN, or ticker"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Purchase from</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Purchase to</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </label>
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground md:block">
                <span>
                  Showing {filteredRows.length} of {rows.length}
                </span>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-0 rounded-md border bg-background px-3 py-1.5 text-sm text-foreground hover:bg-accent md:ml-3"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
                No purchase lots match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1740px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      {sortableHeader("Stock", "securityName", "left")}
                      {sortableHeader("Bought", "quantityBought")}
                      {sortableHeader("Purchase date", "purchaseDate", "left")}
                      {sortableHeader("Ownership", "ownershipStatus", "left")}
                      {sortableHeader("Cost/share", "costBasisPerShare")}
                      {sortableHeader("Cost basis", "costBasis")}
                      <th className="px-3 py-2 text-right font-medium">Latest price</th>
                      {sortableHeader("Latest value", "currentValue")}
                      {sortableHeader("Current div. yield", "currentDividendYieldPercent")}
                      {sortableHeader("Dividends tax free", "accumulatedDividendsTaxFree")}
                      {sortableHeader("Dividends after tax", "accumulatedDividendsAfterTax")}
                      {sortableHeader("Raw profit", "totalRawProfitability")}
                      {sortableHeader("Raw return", "totalRawProfitabilityPercent")}
                      {sortableHeader("Annualized", "totalRawProfitabilityAnnualizedPercent")}
                      <th className="px-3 py-2 text-left font-medium">Data dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-3 py-3 font-medium">{row.securityName}</td>
                        <td className="px-3 py-3 text-right">
                          {formatNumber(row.quantityBought)}
                        </td>
                        <td className="px-3 py-3">{formatDate(row.purchaseDate)}</td>
                        <td className="px-3 py-3">{ownershipLabel(row)}</td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(row.costBasisPerShare, row.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(row.costBasis, row.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(row.latestPrice, row.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(row.currentValue, row.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatPercent(row.currentDividendYieldPercent)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(row.accumulatedDividendsTaxFree, row.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatCurrency(row.accumulatedDividendsAfterTax, row.currency)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium">
                          {formatCurrency(row.totalRawProfitability, row.currency)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatPercent(row.totalRawProfitabilityPercent)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatPercent(row.totalRawProfitabilityAnnualizedPercent)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          Price: {row.priceDate ? formatDate(row.priceDate) : "missing"}
                          <br />
                          Dividend:{" "}
                          {row.latestDividendDate
                            ? formatDate(row.latestDividendDate)
                            : "none"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
