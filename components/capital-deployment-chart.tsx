"use client";

import { useState, type MouseEvent } from "react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CapitalDeploymentPoint, ChartInterval } from "@/lib/analytics/portfolio";

type CapitalDeploymentChartProps = {
  points: CapitalDeploymentPoint[];
  interval: ChartInterval;
};

const chartWidth = 900;
const chartHeight = 300;
const padding = {
  top: 20,
  right: 24,
  bottom: 44,
  left: 72
};

type HoverPoint = {
  point: CapitalDeploymentPoint;
  x: number;
};

function dateTimestamp(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function nearestPoint(
  points: CapitalDeploymentPoint[],
  svgX: number,
  xForPoint: (point: CapitalDeploymentPoint) => number
) {
  return points.reduce(
    (nearest, point) => {
      const distance = Math.abs(xForPoint(point) - svgX);

      if (distance < nearest.distance) {
        return { point, distance };
      }

      return nearest;
    },
    { point: points[0], distance: Number.POSITIVE_INFINITY }
  ).point;
}

function areaPath(
  points: CapitalDeploymentPoint[],
  xForPoint: (point: CapitalDeploymentPoint) => number,
  yForValue: (value: number) => number
) {
  const top = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xForPoint(point)} ${yForValue(point.capitalDeployed)}`
    )
    .join(" ");
  const bottom = [...points]
    .reverse()
    .map((point) => `L ${xForPoint(point)} ${yForValue(0)}`)
    .join(" ");

  return `${top} ${bottom} Z`;
}

function linePath(
  points: CapitalDeploymentPoint[],
  xForPoint: (point: CapitalDeploymentPoint) => number,
  yForValue: (value: number) => number,
  value: (point: CapitalDeploymentPoint) => number
) {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xForPoint(point)} ${yForValue(value(point))}`
    )
    .join(" ");
}

export function CapitalDeploymentChart({
  points,
  interval
}: CapitalDeploymentChartProps) {
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);

  if (points.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
        Add buy, sell, or dividend transactions to see capital deployment.
      </div>
    );
  }

  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const values = points.flatMap((point) => [
    0,
    point.capitalDeployed,
    point.dividendsCollected
  ]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const currency = points[points.length - 1]?.currency ?? "EUR";
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const firstTimestamp = dateTimestamp(firstPoint.date);
  const lastTimestamp = dateTimestamp(lastPoint.date);
  const timeRange = lastTimestamp - firstTimestamp || 1;
  const xForPoint = (point: CapitalDeploymentPoint) =>
    padding.left + ((dateTimestamp(point.date) - firstTimestamp) / timeRange) * plotWidth;
  const yForValue = (value: number) =>
    padding.top + plotHeight - ((value - minValue) / range) * plotHeight;
  const tooltipWidth = 230;
  const tooltipX =
    hoverPoint && hoverPoint.x > chartWidth - padding.right - tooltipWidth
      ? hoverPoint.x - tooltipWidth - 12
      : (hoverPoint?.x ?? 0) + 12;

  function handleMouseMove(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * chartWidth;

    if (svgX < padding.left || svgX > chartWidth - padding.right) {
      setHoverPoint(null);
      return;
    }

    const point = nearestPoint(points, svgX, xForPoint);
    setHoverPoint({ point, x: xForPoint(point) });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={`Capital deployment chart with ${interval} interval`}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-72 min-w-[720px] w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPoint(null)}
        >
          <line
            x1={padding.left}
            y1={yForValue(0)}
            x2={chartWidth - padding.right}
            y2={yForValue(0)}
            stroke="hsl(var(--border))"
          />
          <path
            d={areaPath(points, xForPoint, yForValue)}
            fill="hsl(var(--primary) / 0.18)"
          />
          <path
            d={linePath(points, xForPoint, yForValue, (point) => point.capitalDeployed)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
          <path
            d={linePath(points, xForPoint, yForValue, (point) => point.dividendsCollected)}
            fill="none"
            stroke="hsl(142 70% 38%)"
            strokeWidth="2"
          />
          {hoverPoint ? (
            <g pointerEvents="none">
              <line
                x1={hoverPoint.x}
                y1={padding.top}
                x2={hoverPoint.x}
                y2={chartHeight - padding.bottom}
                stroke="hsl(var(--foreground) / 0.35)"
                strokeDasharray="4 4"
              />
              <circle
                cx={hoverPoint.x}
                cy={yForValue(hoverPoint.point.capitalDeployed)}
                r="4"
                fill="hsl(var(--primary))"
              />
              <circle
                cx={hoverPoint.x}
                cy={yForValue(hoverPoint.point.dividendsCollected)}
                r="4"
                fill="hsl(142 70% 38%)"
              />
              <g transform={`translate(${tooltipX} ${padding.top + 8})`}>
                <rect
                  width={tooltipWidth}
                  height="78"
                  rx="8"
                  fill="hsl(var(--background))"
                  stroke="hsl(var(--border))"
                />
                <text x="12" y="22" className="fill-foreground text-xs font-semibold">
                  {formatDate(hoverPoint.point.date)}
                </text>
                <text x="12" y="44" className="fill-muted-foreground text-xs">
                  Net deployed: {formatCurrency(hoverPoint.point.capitalDeployed, currency)}
                </text>
                <text x="12" y="64" className="fill-muted-foreground text-xs">
                  Dividends: {formatCurrency(hoverPoint.point.dividendsCollected, currency)}
                </text>
              </g>
            </g>
          ) : null}
          {[0, 0.5, 1].map((tick) => {
            const value = minValue + range * tick;

            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={yForValue(value)}
                  x2={chartWidth - padding.right}
                  y2={yForValue(value)}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 6"
                />
                <text
                  x={padding.left - 12}
                  y={yForValue(value)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-xs"
                >
                  {formatCurrency(value, currency)}
                </text>
              </g>
            );
          })}
          <text
            x={padding.left}
            y={chartHeight - 14}
            className="fill-muted-foreground text-xs"
          >
            {formatDate(firstPoint.date)}
          </text>
          <text
            x={chartWidth - padding.right}
            y={chartHeight - 14}
            textAnchor="end"
            className="fill-muted-foreground text-xs"
          >
            {formatDate(lastPoint.date)}
          </text>
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Blue area/line: cumulative buys minus sells</span>
        <span>Green line: cumulative dividends collected</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Current net capital deployed:{" "}
        {formatCurrency(lastPoint.capitalDeployed, currency)}. Total dividends collected:{" "}
        {formatCurrency(lastPoint.dividendsCollected, currency)}.
      </div>
    </div>
  );
}
