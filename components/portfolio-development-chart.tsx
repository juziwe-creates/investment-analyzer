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

export function PortfolioDevelopmentChart({
  points,
  interval,
  emptyMessage = "Sync market prices to see portfolio development.",
  earliestBuyDate
}: PortfolioDevelopmentChartProps) {
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
  const hasPositiveGain = points.some((point) => point.investmentGain > 0);
  const hasNegativeGain = points.some((point) => point.investmentGain < 0);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label={`Portfolio development chart with ${interval} interval`}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-80 min-w-[720px] w-full"
        >
          <line
            x1={padding.left}
            y1={yForValue(0)}
            x2={chartWidth - padding.right}
            y2={yForValue(0)}
            stroke="hsl(var(--border))"
          />
          <path
            d={areaPath(points, xForPoint, yForValue, (point) => point.investedCapital, () => 0)}
            fill="hsl(var(--primary) / 0.22)"
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
              fill="hsl(142 70% 45% / 0.28)"
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
              fill="hsl(var(--destructive) / 0.24)"
            />
          ) : null}
          <path
            d={linePath(points, xForPoint, yForValue, (point) => point.portfolioValue)}
            fill="none"
            stroke="hsl(var(--foreground))"
            strokeWidth="2"
          />
          <path
            d={linePath(points, xForPoint, yForValue, (point) => point.investedCapital)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
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
        <span>Filled base: invested capital</span>
        <span>Green/red area: investment gain/loss</span>
        <span>Solid line: portfolio value</span>
        <span>Dashed line: invested capital</span>
      </div>
      {firstPoint ? (
        <div className="text-xs text-muted-foreground">
          Earliest buy seen: {earliestBuyDate ? formatDate(earliestBuyDate) : "none"}. First
          valued point: {formatDate(firstPoint.date)} with{" "}
          {formatCurrency(firstPoint.investedCapital, currency)} invested and{" "}
          {formatCurrency(firstPoint.portfolioValue, currency)} portfolio value.
        </div>
      ) : null}
    </div>
  );
}
