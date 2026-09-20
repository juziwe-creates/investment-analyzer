import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { annualBenchmarkComparison, annualPriceReturns, benchmarkOptions, normalizeBenchmarkComparison, parseBenchmark, type BenchmarkId, type BenchmarkObservation } from "./benchmarks";
import { visibleSamples } from "../charts/series";
import { buildBenchmarkComparison, benchmarkCounterfactualLabel, benchmarkView, calculateVirtualBenchmarkTimeline } from "./benchmark-portfolio";
import { sourceLots, transaction } from "./benchmark-test-fixtures";

const requireModule = createRequire(__filename);
function loadModule<T>(path: string, mocks: Record<string, unknown>): T {
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, URLSearchParams, require: (name: string) => name in mocks ? mocks[name] : requireModule(name) });
  return exports as T;
}
function observation(date: string, close: number, id = "msci-world"): BenchmarkObservation {
  return { benchmark_id: id, price_date: date, observation_date: date, close_price: close, currency: "EUR", series_type: "net_total_return", is_derived: true, is_partial_period: false };
}
const time = (date: string) => Date.parse(date + "T00:00:00Z");
const range = { start: time("2024-01-01"), end: time("2024-01-31") };
const portfolio = [
  { date: "2024-01-01", portfolioValue: 1000, hasCompletePricing: true },
  { date: "2024-01-05", portfolioValue: 1100, hasCompletePricing: true },
  { date: "2024-01-10", portfolioValue: 1210, hasCompletePricing: true },
  { date: "2024-01-19", portfolioValue: 1320, hasCompletePricing: true },
  { date: "2024-01-31", portfolioValue: 1500, hasCompletePricing: true }
];
const levels = [observation("2023-12-29", 190), observation("2024-01-05", 200), observation("2024-01-12", 210), observation("2024-01-19", 220)];

function historyHarness(failPage = -1) {
  const calls: { table: string; id?: string; order?: string; columns?: string; offset?: number }[] = [];
  const data = ["msci-world", "dax"].flatMap((id) => Array.from({ length: 1044 }, (_, i) => observation(new Date(Date.UTC(2006, 8, 22 + i * 7)).toISOString().slice(0, 10), 100 + i * (id === "dax" ? 2 : 1), id)));
  const db = { from(table: string) {
    const call: typeof calls[number] = { table }; calls.push(call);
    const builder = {
      select(columns: string) { call.columns = columns; return builder; },
      eq(column: string, id: string) { assert.equal(column, "benchmark_id"); call.id = id; return builder; },
      order(column: string) { call.order = column; return builder; },
      async range(from: number, to: number) {
        call.offset = from;
        return { data: data.filter((row) => row.benchmark_id === call.id).slice(from, to + 1), error: from === failPage ? { message: "denied" } : null };
      }
    };
    return builder;
  } };
  const reader = loadModule<{ readBenchmarkHistory: (id: BenchmarkId) => Promise<{ data: BenchmarkObservation[]; error: string | null }> }>("lib/market-data/benchmark-history.ts", {
    "server-only": {}, react: { cache: (fn: unknown) => fn }, "@/lib/supabase/server": { createClient: async () => db }
  });
  return { ...reader, calls };
}
for (const id of ["msci-world", "dax"] as const) test(`${id} loads all 1044 rows from the existing shared table`, async () => {
  const harness = historyHarness();
  const result = await harness.readBenchmarkHistory(id);
  assert.equal(result.error, null);
  assert.equal(result.data.length, 1044);
  assert.ok(result.data.every((row) => row.benchmark_id === id));
  assert.deepEqual(harness.calls.map((call) => [call.table, call.id, call.order, call.offset]), [
    ["benchmark_prices", id, "price_date", 0], ["benchmark_prices", id, "price_date", 1000]
  ]);
});
test("missing sp-500 history is empty without a fabricated fallback; read errors discard partial pages", async () => {
  const result = await historyHarness().readBenchmarkHistory("sp-500");
  assert.equal(result.error, null);
  assert.equal(result.data.length, 0);
  const failed = await historyHarness(1000).readBenchmarkHistory("dax");
  assert.ok(failed.error);
  assert.equal(failed.data.length, 0);
});
test("comparison starts both at 100 on the first benchmark at or after the visible start", () => {
  const result = normalizeBenchmarkComparison(portfolio, levels, range);
  assert.deepEqual(result[0], { date: "2024-01-05", portfolio: 100, benchmark: 100 });
  assert.deepEqual(result.at(-1), { date: "2024-01-19", portfolio: 120, benchmark: 110 });
  assert.equal(result.find((point) => point.date === "2024-01-10")?.benchmark, 100);
});
test("pan/zoom rebases again and never uses a future portfolio observation", () => {
  const result = normalizeBenchmarkComparison(portfolio, levels, { start: time("2024-01-06"), end: range.end });
  assert.deepEqual(result[0], { date: "2024-01-12", portfolio: 100, benchmark: 100 });
  assert.equal(result.at(-1)?.portfolio, 100 * 1320 / 1210);
});
test("partial overlap uses a common start and ends at the shorter history", () => {
  const result = normalizeBenchmarkComparison(portfolio.slice(2, 4), levels, range);
  assert.equal(result[0].date, "2024-01-12");
  assert.equal(result.at(-1)?.date, "2024-01-19");
  assert.deepEqual(normalizeBenchmarkComparison(portfolio, levels, { start: time("2025-01-01"), end: time("2025-12-31") }), []);
  assert.deepEqual(normalizeBenchmarkComparison(portfolio, [], range), []);
});
test("zero and incomplete bases are unavailable; incomplete interior valuations remain gaps", () => {
  assert.equal(normalizeBenchmarkComparison(portfolio.map((p) => ({ ...p, portfolioValue: 0 })), levels, range).length, 0);
  assert.equal(normalizeBenchmarkComparison(portfolio.map((p) => ({ ...p, hasCompletePricing: false })), levels, range).length, 0);
  const result = normalizeBenchmarkComparison(portfolio.map((p) => ({ ...p, hasCompletePricing: p.date !== "2024-01-10" })), levels, range);
  assert.equal(result.find((p) => p.date === "2024-01-10")?.portfolio, null);
  assert.equal(normalizeBenchmarkComparison(portfolio, levels.map((p) => ({ ...p, currency: "USD" })), range).length, 0);
});
test("benchmark step lines cannot extrapolate beyond the last observation", () => {
  const rows = [{ time: 5, value: 100 }, { time: 10, value: 110 }];
  assert.deepEqual(visibleSamples(rows, { start: 1, end: 20 }, true, false, false), rows);
  assert.deepEqual(visibleSamples(rows, { start: 11, end: 20 }, true, false, false), []);
});
test("annual returns use last observations in consecutive calendar years, including YTD", () => {
  const annual = annualPriceReturns([
    { date: "2022-12-30", value: 100 }, { date: "2023-06-01", value: 900 },
    { date: "2023-12-29", value: 120 }, { date: "2024-09-13", value: 90 },
    { date: "2026-09-18", value: 150 }
  ], 2026);
  assert.ok(Math.abs(annual[0].returnPercent! - 20) < 1e-10);
  assert.equal(annual[1].returnPercent, -25);
  assert.deepEqual(annual[2], { year: "2026 YTD", returnPercent: null });
});
test("annual difference is investment minus benchmark in percentage points", () => {
  const result = annualBenchmarkComparison([{ year: "2024", returnPercent: 12 }, { year: "2025", returnPercent: 3 }], [{ year: "2024", returnPercent: 8 }]);
  assert.equal(result[0].difference, 4);
  assert.equal(result[1].difference, null);
});

test("selector URLs load different histories and the chart renders that benchmark's series", async () => {
  type Series = { label: string; observations: { date: string; value: number | null }[]; axisFormat?: (value: number) => string };
  let renderedSeries: Series[] = [];
  const options = { benchmarkOptions, parseBenchmark, normalizeBenchmarkComparison };
  const { BenchmarkSelector } = loadModule<{ BenchmarkSelector: React.ComponentType<{ selected: BenchmarkId }> }>("components/benchmark-selector.tsx", {
    "next/navigation": { usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams("portfolio=account&from=2024-01-01&security=stock") },
    "next/link": { default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) },
    "@/lib/analytics/benchmarks": options, "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") }
  });
  const selector = renderToStaticMarkup(React.createElement(BenchmarkSelector, { selected: "msci-world" }));
  const hrefs = [...selector.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1].replaceAll("&amp;", "&"), "https://example.test"));
  assert.equal(hrefs.length, 3);
  const { PortfolioDevelopmentChart } = loadModule<{ PortfolioDevelopmentChart: React.ComponentType<Record<string, unknown>> }>("components/portfolio-development-chart.tsx", {
    react: React, "@/components/time-viewport": { useTimeViewport: () => ({ range }) },
    "@/components/time-series-chart": { TimeSeriesChart: ({ series }: { series: Series[] }) => { renderedSeries = series; return React.createElement("div"); } },
    "@/components/benchmark-comparison": { BenchmarkMethodology: ({ comparison }: { comparison: { error: string | null } }) => React.createElement("p", null, comparison.error) },
    "@/lib/analytics/benchmarks": options, "@/lib/analytics/benchmark-portfolio": { benchmarkCounterfactualLabel },
    "@/lib/formatters": { formatCurrency: String }
  });
  const endingValues = new Set<number | null>();
  for (const url of hrefs) {
    assert.equal(url.searchParams.get("portfolio"), "account");
    assert.equal(url.searchParams.get("from"), "2024-01-01");
    assert.equal(url.searchParams.get("security"), "stock");
    const id = parseBenchmark(url.searchParams.get("benchmark") ?? undefined);
    const reference = await historyHarness().readBenchmarkHistory(id);
    const comparison = buildBenchmarkComparison(sourceLots([transaction("buy", "2024-01-01", "buy", 10, 1000)], "fifo", "2024-01-31"), reference.data, id, "fifo");
    const timeline = calculateVirtualBenchmarkTimeline(comparison.virtualLots, reference.data, id, portfolio.map((point) => point.date));
    const markup = renderToStaticMarkup(React.createElement(PortfolioDevelopmentChart, { points: portfolio, comparison: benchmarkView(comparison), benchmarkTimeline: timeline }));
    assert.equal(renderedSeries[1].label, benchmarkCounterfactualLabel(benchmarkOptions.find((option) => option.id === id)!.label, comparison.dividendTreatment));
    assert.equal(renderedSeries[0].axisFormat, undefined);
    assert.equal(renderedSeries[2].label, "Current Deployed Capital");
    assert.equal(renderedSeries[1].observations.some((point) => point.value !== null), id !== "sp-500");
    if (id === "sp-500") assert.match(markup, /history is unavailable/);
    else endingValues.add(renderedSeries[1].observations.at(-1)!.value);
  }
  assert.equal(endingValues.size, 2);
  const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
  assert.match(page, /readBenchmarkHistory\(benchmark\)/);
  assert.match(page, /<DashboardPerformance history=\{history\} benchmark=\{benchmark\} benchmarkHistory=\{benchmarkHistory\}/);
});

test("purchase-lot comparison renders an auditable trace and stale-entry warning", () => {
  const { DecisionComparisonRows } = loadModule<{ DecisionComparisonRows: React.ComponentType<Record<string, unknown>> }>("components/benchmark-comparison.tsx", {
    "next/link": { default: ({ href, children }: { href: string; children: React.ReactNode }) => React.createElement("a", { href }, children) },
    "@/lib/formatters": { formatCurrency: (value: number | null) => value === null ? "-" : `EUR ${value}`,
      formatDate: String, formatNumber: String, formatPercent: (value: number | null) => value === null ? "-" : `${value}%` },
    "@/lib/utils": { cn: (...values: unknown[]) => values.filter(Boolean).join(" ") },
    "@/lib/analytics/benchmark-portfolio": { benchmarkDividendTreatmentLabel: (value: string) => value === "embedded" ? "Embedded in total-return index" : value }
  });
  const source = sourceLots([{ ...transaction("anonymous-buy", "2025-04-07", "buy", 4, 1000), unit_price: 248 }], "lifo", "2025-04-10");
  const weekly = [{ ...observation("2025-04-01", 100), frequency: "weekly" }, { ...observation("2025-04-10", 120), frequency: "weekly" }];
  const row = buildBenchmarkComparison(source, weekly, "msci-world", "lifo").lots[0];
  const markup = renderToStaticMarkup(React.createElement(DecisionComparisonRows, { rows: [row], label: "MSCI World" }));
  assert.match(markup, /Calculation trace/);
  assert.match(markup, /Benchmark observation 6 days before purchase/);
  assert.match(markup, /anonymous-buy/);
  assert.match(markup, /Virtual benchmark units purchased/);
  assert.match(markup, /Units = acquisition cost/);
});
