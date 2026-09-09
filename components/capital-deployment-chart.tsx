"use client";

import { TimeSeriesChart } from "@/components/time-series-chart";
import { formatCurrency } from "@/lib/formatters";
import type { CapitalDeploymentPoint } from "@/lib/analytics/portfolio";

export function CapitalDeploymentChart({ points }: { points: CapitalDeploymentPoint[] }) {
  return <TimeSeriesChart points={points} label="Capital deployment" emptyMessage="Add buy, sell, or dividend transactions to see capital deployment." series={[
    { label: "Net capital deployed", color: "hsl(var(--chart-deployed))", value: (point) => point.capitalDeployed, stepped: true },
    { label: "Cumulative dividends received", color: "hsl(var(--chart-dividend))", value: (point) => point.dividendsCollected, stepped: true }
  ]} tooltip={(point) => [
    { label: "Net deployed", value: formatCurrency(point.capitalDeployed, point.currency) },
    { label: "Dividends", value: formatCurrency(point.dividendsCollected, point.currency) }
  ]} />;
}
