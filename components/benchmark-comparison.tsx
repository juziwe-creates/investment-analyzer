import Link from "next/link";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import type { BenchmarkView, DecisionComparison } from "@/lib/analytics/benchmark-portfolio";
import { cn } from "@/lib/utils";

export function BenchmarkMethodology({ comparison }: { comparison: BenchmarkView }) {
  return <div className="space-y-2">
    {comparison.error ? <p role="status" className="text-sm text-muted-foreground">{comparison.error}</p> : null}
    <details className="text-xs leading-5 text-muted-foreground"><summary className="alpha-focus cursor-pointer">Comparison method: {comparison.label} · {comparison.matching.toUpperCase()}</summary>
      <p className="mt-2">{comparison.description}. Each purchase invests the same acquisition cost; sales close the same fraction of its benchmark lot. Levels use the last observation on or before each decision or valuation date.</p>
      <p>Current-model returns include recorded actual dividends, preferring gross then net, with no additional tax multiplier. Benchmark dividends follow its stored series type. XIRR uses original purchases, dated exits and remaining value at the actual valuation date. Holding returns include earlier closed lots. Portfolio charts show remaining positions, excluding cash dividends and proceeds already withdrawn.</p>
      <p>Dashboard uses FIFO; Investment Detail uses LIFO. Partial sales can therefore produce different comparisons. Benchmark Yield on Cost is unavailable because no separate dividend cash series exists.</p>
    </details>
  </div>;
}

export function ComparisonViewControl({ active, onChange }: { active: boolean; onChange: (value: boolean) => void }) {
  return <div className="inline-flex rounded-md border border-border bg-card p-1" aria-label="Comparison view">
    {[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={active === value} onClick={() => onChange(value)}
      className={cn("alpha-focus rounded px-3 py-1.5 text-sm text-muted-foreground", active === value && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{value ? "Benchmark Comparison" : "Actual"}</button>)}
  </div>;
}

const differenceClass = (value: number | null) => value === null ? "text-muted-foreground" : value > 0 ? "text-[hsl(var(--positive))]" : value < 0 ? "text-[hsl(var(--negative))]" : "";
const cash = (value: number | null) => value === null ? "Unavailable" : formatCurrency(value, "EUR");
const percent = (value: number | null) => value === null ? "Unavailable" : formatPercent(value);
const pp = (value: number | null) => value === null ? "Unavailable" : `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;

export function DecisionComparisonRows({ rows, label, holding = false, href }: {
  rows: DecisionComparison[]; label: string; holding?: boolean; href?: (row: DecisionComparison) => string;
}) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted-foreground">No investments match this filter.</p>;
  return <div className="space-y-2">{rows.map((row) => {
    if (row.currency !== "EUR") return <div key={row.id} className="alpha-surface p-4"><p className="font-medium">{holding ? row.name : formatDate(row.buyDate)}</p><p className="mt-2 text-sm text-muted-foreground">Comparison unavailable: EUR acquisition costs and valuations are required.</p></div>;
    const actualValue = holding ? row.actual.currentValue : row.actual.referenceValue;
    const benchmarkValue = holding ? row.benchmark.currentValue : row.benchmark.referenceValue;
    const metrics = [
      { name: "Original deployed", actual: cash(row.actual.deployed), benchmark: cash(row.benchmark.deployed), difference: cash(0) },
      { name: "Remaining cost", actual: cash(row.actual.remainingCapital), benchmark: cash(row.benchmark.remainingCapital), difference: cash(0) },
      { name: "Current value", actual: cash(row.actual.currentValue), benchmark: cash(row.benchmark.currentValue), difference: cash(row.difference.currentValue) },
      { name: "Value + sale proceeds", actual: cash(row.actual.referenceValue), benchmark: cash(row.benchmark.referenceValue), difference: cash(row.difference.referenceValue) },
      { name: "Gain / loss (current model)", actual: cash(row.actual.gain), benchmark: cash(row.benchmark.gain), difference: cash(row.difference.gain) },
      { name: "Total return (current model)", actual: percent(row.actual.returnPercent), benchmark: percent(row.benchmark.returnPercent), difference: pp(row.difference.returnPercent) },
      { name: "Annualized / XIRR", actual: percent(row.actual.annualizedPercent), benchmark: percent(row.benchmark.annualizedPercent), difference: pp(row.difference.annualizedPercent) }
    ];
    return <details key={row.id} className="alpha-surface group p-3 sm:p-4">
      <summary className="alpha-focus cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{holding ? row.name : formatDate(row.buyDate)}</span><span className="text-xs text-muted-foreground group-open:hidden">Details</span></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm tabular-nums">
          <div><span className="block text-xs text-muted-foreground">Actual {holding ? "value" : "value / ref"}</span><span className="break-words">{cash(actualValue)}</span></div>
          <div><span className="block text-xs text-muted-foreground">{label}</span><span className="break-words">{cash(benchmarkValue)}</span></div>
          <div><span className="block text-xs text-muted-foreground">Difference</span><span className={cn("break-words", differenceClass(row.difference.value))}>{cash(row.difference.value)}</span></div>
        </div>
        <p className={cn("mt-2 text-xs", differenceClass(row.difference.returnPercent))}>Return difference: {pp(row.difference.returnPercent)}</p>
      </summary>
      {row.reason ? <p className="mt-3 text-sm text-muted-foreground">{row.reason}</p> : null}
      <div className="mt-4 space-y-3 border-t border-border pt-3">{metrics.map((metric) => <div key={metric.name} className="grid grid-cols-3 gap-x-2 gap-y-1 text-sm sm:grid-cols-4">
        <p className="col-span-3 text-muted-foreground sm:col-span-1">{metric.name}</p>
        {[["Actual", metric.actual], [label, metric.benchmark], ["Difference", metric.difference]].map(([heading, value]) => <div key={heading} className="min-w-0 break-words tabular-nums"><span className="block text-[10px] text-muted-foreground">{heading}</span>{value}</div>)}
      </div>)}</div>
      <p className="mt-3 text-xs text-muted-foreground">Valuation: {row.valuationDate ?? "Unavailable"} · Benchmark observation: {row.observationDate ?? "Unavailable"}. Value / reference includes proceeds from partial and full exits. Benchmark Yield on Cost: Unavailable.</p>
      {href ? <Link className="alpha-focus mt-3 inline-block text-sm underline" href={href(row)}>Open investment</Link> : null}
    </details>;
  })}</div>;
}
