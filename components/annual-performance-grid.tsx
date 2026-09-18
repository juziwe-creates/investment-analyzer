import { formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { annualBenchmarkComparison, type AnnualReturn } from "@/lib/analytics/benchmarks";

export type AnnualPerformancePoint = AnnualReturn;

export function AnnualPerformanceGrid({ securityName, points, benchmarkLabel, benchmarkPoints = [], benchmarkError }: {
  securityName: string; points: AnnualPerformancePoint[]; benchmarkLabel: string;
  benchmarkPoints?: AnnualPerformancePoint[]; benchmarkError?: string | null;
}) {
  const comparison = annualBenchmarkComparison(points, benchmarkPoints);
  const rows = [
    { label: securityName, values: comparison.map((point) => point.returnPercent) },
    { label: benchmarkLabel, values: comparison.map((point) => point.benchmarkReturn) },
    { label: "Difference", values: comparison.map((point) => point.difference), difference: true }
  ];
  return <section className="space-y-4" aria-labelledby="annual-performance-heading">
    <div><h2 id="annual-performance-heading" className="alpha-section-title">Annual performance</h2><p className="mt-1 text-sm text-muted-foreground">Calendar-year security price performance, independent of your personal cash flows.</p></div>
    {points.length === 0 ? <div className="alpha-surface flex h-36 items-center justify-center px-6 text-center text-sm text-muted-foreground">More year-end price history is needed for annual performance.</div>
      : <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="alpha-table min-w-[620px]">
        <thead><tr><th>Series</th>{points.map((point) => <th key={point.year} className="text-right">{point.year}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.label}><th scope="row" className="font-medium">{row.label}</th>{row.values.map((value, index) =>
          <td key={points[index].year} className={cn("text-right", value === null ? "text-muted-foreground" : value > 0 ? "bg-[hsl(var(--positive-subtle))]" : value < 0 ? "bg-[hsl(var(--negative-subtle))]" : "")}>
            {value === null ? "Unavailable" : row.difference ? `${value.toFixed(2)} pp` : formatPercent(value)}
          </td>)}</tr>)}</tbody>
      </table></div>}
    {benchmarkError ? <p role="alert" className="text-sm text-muted-foreground">{benchmarkError}</p> : null}
    <p className="text-xs text-muted-foreground">Annual return = last stored level in the year / last stored level in the previous calendar year - 1. YTD uses the latest available observation; series may have different observation dates. Difference is investment minus benchmark, in percentage points. Missing prior-year history is unavailable. Benchmarks include reinvested dividends; security performance uses adjusted prices where available and does not add your cash dividends.</p>
  </section>;
}
