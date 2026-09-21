"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { benchmarkOptions, type BenchmarkId } from "@/lib/analytics/benchmarks";
import { cn } from "@/lib/utils";

export function BenchmarkSelector({ selected }: { selected: BenchmarkId | BenchmarkId[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedIds = Array.isArray(selected) ? selected : [selected];
  return <div className="inline-flex rounded-md border border-border bg-card p-1" aria-label="Benchmark">{benchmarkOptions.map((option) => {
    const params = new URLSearchParams(searchParams.toString());
    const active = selectedIds.includes(option.id);
    const next = active ? selectedIds.filter((id) => id !== option.id) : [...selectedIds, option.id];
    const retained = next.length ? next : selectedIds;
    params.delete("benchmark");
    benchmarkOptions.forEach(({ id }) => { if (retained.includes(id)) params.append("benchmark", id); });
    return <Link key={option.id} href={`${pathname}?${params.toString()}`} aria-pressed={active} className={cn("alpha-focus rounded px-3 py-1.5 text-sm text-muted-foreground", active && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{active ? "✓ " : ""}{option.label}</Link>;
  })}</div>;
}
