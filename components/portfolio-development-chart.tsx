"use client";

import { useState, type MouseEvent } from "react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ChartInterval, PortfolioDevelopmentPoint } from "@/lib/analytics/portfolio";

type PortfolioDevelopmentChartProps = {
  points: PortfolioDevelopmentPoint[];
  interval: ChartInterval;
  emptyMessage?: string;
  earliestBuyDate?: string | null;
};

const chartWidth = 900;
const chartHeight = 320;
const padding = {
  top: 20,
  right: 24,
  bottom: 44,
  left: 72
};

type HoverPoint = {
  point: PortfolioDevelopmentPoint;
  x: number;
};

function areaPath(
  points: PortfolioDevelopmentPoint[],
  xForPoint: (point: PortfolioDevelopmentPoint) => number,
  yForValue: (value: number) => number,
  topValue: (point: PortfolioDevelopmentPoint) => number,
  bottomValue: (point: PortfolioDevelopmentPoint) => number
) {
  const top = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xForPoint(point)} ${yForValue(topValue(point))}`)
    .join(" ");
  const bottom = [...points]
    .reverse()
    .map((point) => `L ${xForPoint(point)} ${yForValue(bottomValue(point))}`)
    .join(" ");

  return `${top} ${bottom} Z`;
}

function linePath(
  points: PortfolioDevelopmentPoint[],
  xForPoint: (point: PortfolioDevelopmentPoint) => number,
  yForValue: (value: number) => number,
  value: (point: PortfolioDevelopmentPoint) => number
) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xForPoint(point)} ${yForValue(value(point))}`)
    .join(" ");
}

function dateTimestamp(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function nearestPoint(
  points: PortfolioDevelopmentPoint[],
  svgX: number,
  xForPoint: (point: PortfolioDevelopmentPoint) => number
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

export function PortfolioDevelopmentChart({
  points,
  interval,
  emptyMessage = "Sync market prices to see portfolio development.",
  earliestBuyDate
}: PortfolioDevelopmentChartProps) {
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);

  if (points.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const values = points.flatMap((point) => [
    0,
    point.investedCapital,
    point.portfolioValue
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
  const xForPoint = (point: PortfolioDevelopmentPoint) =>
    padding.left + ((dateTimestamp(point.date) - firstTimestamp) / timeRange) * plotWidth;
  const yForValue = (value: number) =>
    padding.top + plotHeight - ((value - minValue) / range) * plotHeight;
  const positiveGainPoints = points.map((point) => ({
    ...point,
    portfolioValue: Math.max(point.portfolioValue, point.investedCapital)
  }));
  const negativeGainPoints = points.map((point) => ({
    ...point,
    portfolioValue: Math.min(point.portfolioValue, point.investedCapital)
  }));
  const hasIncompletePoints = points.some((point) => !point.hasCompletePricing);
  const unpricedPointCount = points.filter((point) => !point.hasCompletePricing).length;
  const hasPositiveGain = points.some((point) => point.investmentGain > 0);
  const hasNegativeGain = points.some((point) => point.investmentGain < 0);
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
      <svg
          role="img"
          aria-label={`Portfolio development chart with ${interval} interval`}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-80 min-w-[720px] w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPoint(null)}
        >
          <line
            x1={padding.left}
            y1={yForValue(0)}
            x2={chartWidth - padding.right}
            y2={yForValue(0)}
            stroke="hsl(var(--border-subtle))"
          />
          <path
            d={areaPath(points, xForPoint, yForValue, (point) => point.investedCapital, () => 0)}
            fill="hsl(var(--chart-deployed) / 0.08)"
          />
          {hasPositiveGain ? (
            <path
              d={areaPath(
                positiveGainPoints,
                xForPoint,
                yForValue,
                (point) => point.portfolioValue,
                (point) => point.investedCapital
              )}
              fill="hsl(var(--positive-subtle) / 0.8)"
            />
          ) : null}
          {hasNegativeGain ? (
            <path
              d={areaPath(
                negativeGainPoints,
                xForPoint,
                yForValue,
                (point) => point.investedCapital,
                (point) => point.portfolioValue
              )}
              fill="hsl(var(--negative-subtle) / 0.9)"
            />
          ) : null}
          <path
            d={linePath(points, xForPoint, yForValue, (point) => point.portfolioValue)}
            fill="none"
            stroke="hsl(var(--chart-portfolio))"
            strokeWidth="2"
          />
          <path
            d={linePath(points, xForPoint, yForValue, (point) => point.investedCapital)}
            fill="none"
            stroke="hsl(var(--chart-deployed))"
            strokeWidth="2"
            strokeDasharray="5 5"
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
                cy={yForValue(hoverPoint.point.portfolioValue)}
                r="4"
                fill="hsl(var(--chart-portfolio))"
              />
              <circle
                cx={hoverPoint.x}
                cy={yForValue(hoverPoint.point.investedCapital)}
                r="4"
                fill="hsl(var(--chart-deployed))"
              />
              <g transform={`translate(${tooltipX} ${padding.top + 8})`}>
                <rect
                  width={tooltipWidth}
                  height="116"
                  rx="8"
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border-subtle))"
                />
                <text x="12" y="22" className="fill-foreground text-xs font-semibold">
                  {formatDate(hoverPoint.point.date)}
                </text>
                <text x="12" y="44" className="fill-muted-foreground text-xs">
                  Portfolio: {formatCurrency(hoverPoint.point.portfolioValue, currency)}
                </text>
                <text x="12" y="64" className="fill-muted-foreground text-xs">
                  Invested: {formatCurrency(hoverPoint.point.investedCapital, currency)}
                </text>
                <text x="12" y="84" className="fill-muted-foreground text-xs">
                  Gain/loss: {formatCurrency(hoverPoint.point.investmentGain, currency)}
                </text>
                <text x="12" y="104" className="fill-muted-foreground text-xs">
                  Dividends: {formatCurrency(hoverPoint.point.dividendsReceived, currency)}
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
                  stroke="hsl(var(--border-subtle))"
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
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>
          Filled base: {hasIncompletePoints ? "priced invested capital" : "invested capital"}
        </span>
        <span>Green/red area: investment gain/loss</span>
        <span>
          Solid line: {hasIncompletePoints ? "priced portfolio value" : "portfolio value"}
        </span>
        <span>
          Dashed line: {hasIncompletePoints ? "priced invested capital" : "invested capital"}
        </span>
      </div>
      {firstPoint ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>
            Earliest buy seen: {earliestBuyDate ? formatDate(earliestBuyDate) : "none"}. First
            chart point: {formatDate(firstPoint.date)} with{" "}
            {formatCurrency(firstPoint.investedCapital, currency)} priced invested capital and{" "}
            {formatCurrency(firstPoint.portfolioValue, currency)} priced portfolio value.
          </div>
          {hasIncompletePoints ? (
            <div>
              {unpricedPointCount} chart {unpricedPointCount === 1 ? "point excludes" : "points exclude"}{" "}
              holdings without historical prices.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
