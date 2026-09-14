"use client";

import { useState } from "react";
import { TimeSeriesChart } from "@/components/time-series-chart";
import { SelectedTransactions } from "@/components/selected-transactions";
import { useTimeViewport } from "@/components/time-viewport";
import { dateString, parseDate, type TimeRange } from "@/lib/charts/time-viewport";
import { selectionRange } from "@/lib/charts/series";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { AnnualPersonalDividendYield } from "@/lib/analytics/dividends";
import type { SelectedTransaction } from "@/lib/analytics/selected-transactions";
import type { CapitalDeploymentPoint } from "@/lib/analytics/portfolio";

export function CapitalDeploymentChart({ points, annual = [], transactions = [] }: { points: CapitalDeploymentPoint[]; annual?: AnnualPersonalDividendYield[]; transactions?: SelectedTransaction[] }) {
  const [active, setActive] = useState(false);
  const [selection, setSelection] = useState<TimeRange | null>(null);
  const { full, range, times } = useTimeViewport();
  return <div className="space-y-5"><div className="flex flex-wrap items-end gap-3"><button type="button" aria-pressed={active} disabled={!times.length} onClick={() => setActive(!active)} className={`alpha-focus rounded-md border px-3 py-2 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>Select period</button>{selection ? <button type="button" onClick={() => setSelection(null)} className="alpha-focus rounded-md border border-border px-3 py-2 text-sm">Clear selection</button> : null}{active || selection ? (["start", "end"] as const).map((edge) => <label key={edge} className="text-xs text-muted-foreground">{edge === "start" ? "Selection start" : "Selection end"}<input type="date" aria-label={`Selection ${edge}`} min={dateString(full.start)} max={dateString(full.end)} value={dateString((selection ?? range)[edge])} onChange={(event) => { const time = parseDate(event.target.value); if (time !== null) { const next = { ...(selection ?? range), [edge]: time }; setSelection(selectionRange(next.start, next.end, full)); } }} className="alpha-focus mt-1 block min-h-10 rounded-md border border-border bg-card px-2 text-sm text-foreground" /></label>) : null}</div><TimeSeriesChart points={points} label="Capital deployment" selection={{ active, range: selection, onChange: setSelection }} emptyMessage="Add buy, sell, or dividend transactions to see capital deployment." series={[
    { label: "Net capital deployed", color: "hsl(var(--chart-deployed))", value: (point) => point.capitalDeployed, stepped: true },
    { label: "Cumulative dividends received", color: "hsl(var(--chart-dividend))", value: (point) => point.dividendsCollected, stepped: true },
    ...(annual.some((row) => row.yieldPercent !== null) ? [{ label: "Personal Dividend Yield (right axis)", color: "hsl(var(--accent-brand))", value: () => null, axis: "right" as const, render: "lollipop" as const, format: (value: number) => formatPercent(value), observations: annual.map((row) => ({ date: row.date, value: row.yieldPercent, tooltip: [
      { label: "Calendar period", value: `${row.year}${row.ytd ? " YTD" : ""}` },
      { label: "Gross dividends received", value: formatCurrency(row.grossDividends, row.currency) },
      { label: "Avg. acquisition cost", value: formatCurrency(row.averageCost, row.currency) },
      { label: "Personal Dividend Yield", value: row.reason ?? formatPercent(row.yieldPercent) }
    ] })) }] : [])
  ]} tooltip={(point) => [
    { label: "Net deployed", value: formatCurrency(point.capitalDeployed, point.currency) },
    { label: "Dividends", value: formatCurrency(point.dividendsCollected, point.currency) }
  ]} />{annual.some((row) => row.reason) ? <p className="text-xs text-muted-foreground">Personal Dividend Yield unavailable for {annual.filter((row) => row.reason).map((row) => `${row.year}: ${row.reason}`).join("; ")}.</p> : null}<SelectedTransactions transactions={transactions} range={selection} /></div>;
}
