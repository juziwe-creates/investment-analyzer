"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const benchmarkOptions = [
  { id: "msci-world", label: "MSCI World" },
  { id: "sp-500", label: "S&P 500" },
  { id: "dax", label: "DAX" }
] as const;

export type BenchmarkId = (typeof benchmarkOptions)[number]["id"];

export function parseBenchmark(value: string | undefined): BenchmarkId {
  return benchmarkOptions.some((option) => option.id === value) ? (value as BenchmarkId) : "msci-world";
}

export function BenchmarkSelector({ selected }: { selected: BenchmarkId }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return <div className="inline-flex rounded-md border border-border bg-card p-1" aria-label="Benchmark">{benchmarkOptions.map((option) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("benchmark", option.id);
    return <Link key={option.id} href={`${pathname}?${params.toString()}`} className={cn("alpha-focus rounded px-3 py-1.5 text-sm text-muted-foreground", selected === option.id && "bg-[hsl(var(--accent-subtle))] text-foreground")}>{option.label}</Link>;
  })}</div>;
}
