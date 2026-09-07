"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Metric = { label: string; value: string; muted?: boolean };

function MetricValue({ metric, size = "large" }: { metric: Metric; size?: "large" | "small" }) {
  return <div><p className="alpha-kpi-label">{metric.label}</p><p className={cn("mt-2 font-medium", size === "large" ? "text-2xl" : "text-xl", metric.muted && "text-muted-foreground")}>{metric.value}</p></div>;
}

export function PortfolioMetrics({ primary, secondary }: { primary: Metric[]; secondary: Metric[] }) {
  const [expanded, setExpanded] = useState(false);
  return <section aria-label="Portfolio metrics"><div className="grid gap-x-8 gap-y-7 border-b border-border/70 pb-7 sm:grid-cols-2 lg:grid-cols-3">{primary.map((metric) => <MetricValue key={metric.label} metric={metric} />)}</div><div className={cn("gap-x-8 gap-y-6 py-7 sm:grid-cols-2 lg:grid-cols-4", expanded ? "grid" : "hidden md:grid")}>{secondary.map((metric) => <MetricValue key={metric.label} metric={metric} size="small" />)}</div><button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="alpha-focus mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium md:hidden">{expanded ? "Hide secondary metrics" : "View all metrics"}<ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} /></button></section>;
}
