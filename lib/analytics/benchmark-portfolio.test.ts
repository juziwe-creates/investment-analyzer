import test from "node:test";
import assert from "node:assert/strict";
import { calculateXirr } from "./engine";
import { benchmarkCounterfactualLabel, benchmarkDividendTreatment, benchmarkLevelAtDate, buildBenchmarkComparison, calculateVirtualBenchmarkTimeline } from "./benchmark-portfolio";
import { investmentDetailHref } from "./benchmark-navigation";
import type { BenchmarkId } from "./benchmarks";
import { visibleSamples } from "../charts/series";

import { quote, history, sourceLots, transaction } from "./benchmark-test-fixtures";

const buy = transaction("buy", "2020-01-01", "buy", 10, 1000);
const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test("one open lot mirrors acquisition cost and uses a prior entry observation", () => {
  const sources = sourceLots([buy]), before = structuredClone(sources);
  const result = buildBenchmarkComparison(sources, history, "msci-world", "fifo");
  assert.deepEqual(sources, before);
  near(result.virtualLots[0].originalBenchmarkUnits, 10);
  near(result.lots[0].benchmark.currentValue, 1500);
  near(result.lots[0].benchmark.returnPercent, 50);
  near(result.lots[0].difference.returnPercent, 50);
  assert.equal(result.lots[0].observationDate, "2021-12-31");
  assert.equal(result.virtualLots[0].sourceBuyTransactionId, "buy");
});
test("partial exit follows quantity, not actual sale proceeds; reference includes the exit", () => {
  const sources = sourceLots([buy, transaction("sale", "2021-01-01", "sell", 3, 450)]);
  const result = buildBenchmarkComparison(sources, history, "msci-world", "fifo");
  near(result.virtualLots[0].exits[0].units, 3);
  near(result.lots[0].benchmark.currentValue, 1050);
  near(result.lots[0].benchmark.economicReferenceValue, 1410);
  near(result.lots[0].benchmark.gain, 410);
  near(result.lots[0].actual.economicReferenceValue, 1850);
  const changedSale = sourceLots([buy, transaction("sale", "2021-01-01", "sell", 3, 9000)]);
  near(buildBenchmarkComparison(changedSale, history, "msci-world", "fifo").lots[0].benchmark.economicReferenceValue, 1410);
});
test("multiple exits and fully closed lots use actual exit dates for benchmark XIRR", () => {
  const result = buildBenchmarkComparison(sourceLots([buy,
    transaction("s1", "2021-01-01", "sell", 3, 450), transaction("s2", "2022-01-01", "sell", 7, 1400)
  ]), history, "msci-world", "fifo");
  near(result.lots[0].benchmark.economicReferenceValue, 1410);
  assert.equal(result.virtualLots[0].closeDate, "2022-01-01");
  assert.equal(result.virtualLots[0].cashFlows.some((flow) => flow.kind === "terminal_value"), false);
  near(result.lots[0].benchmark.annualizedPercent, calculateXirr([
    { date: buy.trade_date, amount: -1000, kind: "buy" },
    { date: "2021-01-01", amount: 360, kind: "sell" },
    { date: "2022-01-01", amount: 1050, kind: "sell" }
  ]).value!);
});
test("FIFO and LIFO allocations remain linked to the exact source buys", () => {
  const transactions = [buy, transaction("b2", "2021-01-01", "buy", 10, 1200), transaction("sale", "2021-06-01", "sell", 5, 900)];
  const fifo = buildBenchmarkComparison(sourceLots(transactions, "fifo"), history, "msci-world", "fifo");
  const lifo = buildBenchmarkComparison(sourceLots(transactions, "lifo"), history, "msci-world", "lifo");
  near(fifo.virtualLots[0].remainingBenchmarkUnits, 5);
  near(lifo.virtualLots[0].remainingBenchmarkUnits, 10);
  assert.equal(fifo.virtualLots[0].exits.length, 1);
  assert.equal(lifo.virtualLots[1].exits.length, 1);
});
test("holding aggregates all linked lots, including past exits and recorded dividends", () => {
  const transactions = [buy, transaction("d", "2020-06-01", "dividend", 10, 100),
    transaction("closed", "2021-01-01", "sell", 10, 1500), transaction("b2", "2021-01-02", "buy", 10, 1200)];
  const source = sourceLots(transactions), result = buildBenchmarkComparison(source, history, "msci-world", "fifo");
  const holding = result.holdings.A;
  near(holding.actual.currentValue, 2000);
  near(holding.actual.gain, 1400);
  near(holding.benchmark.currentValue, 1500);
  near(holding.benchmark.economicReferenceValue, 2700);
  near(holding.benchmark.gain, 500);
  near(holding.actual.economicReferenceValue, 3600);
  near(holding.difference.value, 900);
  near(holding.actual.annualizedPercent, calculateXirr(source.flatMap((lot) => lot.cashFlows)).value!);
  assert.equal(result.virtualLots.some((lot) => lot.cashFlows.some((flow) => flow.kind === "dividend")), false);
});
test("weekly levels never look ahead and zoom between observations still has a stepped value", () => {
  const levels = [quote("2020-01-03", 100), quote("2020-01-10", 110)];
  assert.equal(benchmarkLevelAtDate(levels, "2020-01-08")?.close_price, 100);
  assert.equal(benchmarkLevelAtDate(levels, "2020-01-02"), null);
  const result = buildBenchmarkComparison(sourceLots([transaction("b", "2020-01-04", "buy", 10, 1000)], "fifo", "2020-01-15"), levels, "msci-world", "fifo");
  const timeline = calculateVirtualBenchmarkTimeline(result.virtualLots, levels, "msci-world", ["2020-01-04", "2020-01-15"]);
  const time = (date: string) => Date.parse(date + "T00:00:00Z");
  const samples = visibleSamples(timeline.map((point) => ({ time: time(point.date), value: point.value })), { start: time("2020-01-06"), end: time("2020-01-08") }, true);
  assert.ok(samples.length > 0);
  assert.ok(samples.every((point) => point.value === 1000));
  near(timeline.at(-1)!.value, 1100);
});
test("daily history uses an exact trading-day entry and a weekend uses the last prior observation", () => {
  const daily = [
    { ...quote("2025-04-04", 100), frequency: "daily" },
    { ...quote("2025-04-07", 125), frequency: "daily" },
    { ...quote("2025-04-08", 130), frequency: "daily" }
  ];
  const monday = buildBenchmarkComparison(sourceLots([
    { ...transaction("monday", "2025-04-07", "buy", 10, 1000), unit_price: 98 }
  ], "fifo", "2025-04-08"), daily, "msci-world", "fifo").lots[0];
  assert.equal(monday.trace.benchmarkEntryObservationDate, "2025-04-07");
  assert.equal(monday.trace.benchmarkEntryLagDays, 0);
  near(monday.trace.virtualBenchmarkUnitsPurchased, 8);
  assert.equal(monday.trace.actualPurchasePrice, 98);
  const weekend = buildBenchmarkComparison(sourceLots([
    transaction("weekend", "2025-04-06", "buy", 10, 1000)
  ], "fifo", "2025-04-08"), daily, "msci-world", "fifo").lots[0];
  assert.equal(weekend.trace.benchmarkEntryObservationDate, "2025-04-04");
  assert.equal(weekend.trace.benchmarkEntryLagDays, 2);
  near(weekend.trace.virtualBenchmarkUnitsPurchased, 10);
});
test("daily precision changes volatile Friday-to-Monday entry without changing prior-only matching", () => {
  const weekly = [{ ...quote("2025-04-04", 100), frequency: "weekly" }, { ...quote("2025-04-11", 140), frequency: "weekly" }];
  const daily = [...weekly, { ...quote("2025-04-07", 125), frequency: "daily" }].sort((a, b) => a.price_date.localeCompare(b.price_date));
  const source = sourceLots([transaction("decision", "2025-04-07", "buy", 10, 1000)], "fifo", "2025-04-11");
  const weeklyResult = buildBenchmarkComparison(source, weekly, "msci-world", "fifo").lots[0];
  const dailyResult = buildBenchmarkComparison(source, daily, "msci-world", "fifo").lots[0];
  near(weeklyResult.trace.virtualBenchmarkUnitsPurchased, 10);
  near(dailyResult.trace.virtualBenchmarkUnitsPurchased, 8);
  assert.equal(benchmarkLevelAtDate(daily, "2025-04-06")?.price_date, "2025-04-04");
  assert.equal(benchmarkLevelAtDate([{ ...quote("2025-04-07", 125), frequency: "daily" }], "2025-04-06"), null);
});
test("calculation trace reconciles Berkshire-style multi-purchase lots without live data", () => {
  const levels = [
    { ...quote("2025-04-04", 100), frequency: "daily" },
    { ...quote("2025-04-07", 125), frequency: "daily" },
    { ...quote("2025-04-08", 150), frequency: "daily" },
    { ...quote("2025-04-09", 160), frequency: "daily" }
  ];
  const source = sourceLots([
    { ...transaction("lot-a", "2025-04-07", "buy", 4, 1000), unit_price: 248 },
    { ...transaction("lot-b", "2025-04-08", "buy", 5, 1500), unit_price: 298 }
  ], "lifo", "2025-04-09");
  const result = buildBenchmarkComparison(source, levels, "msci-world", "lifo");
  assert.equal(result.lots.length, 2);
  for (const row of result.lots) {
    const trace = row.trace;
    near(trace.virtualBenchmarkUnitsPurchased, trace.acquisitionCost / trace.benchmarkEntryLevel!);
    near(row.benchmark.currentValue, trace.remainingVirtualBenchmarkUnits! * trace.benchmarkValuationLevel!);
    assert.equal(trace.exits.length, 0);
    assert.equal(trace.sourceTransactionId, row.id);
    assert.equal(trace.benchmarkFrequency, "daily");
  }
});
test("portfolio timeline follows buys and exits; investment timeline contains only that security", () => {
  const source = sourceLots([buy, transaction("b2", "2021-01-01", "buy", 10, 2400, "B"),
    transaction("sale", "2022-01-01", "sell", 10, 2000)]);
  const portfolio = buildBenchmarkComparison(source, history, "msci-world", "fifo");
  const dates = ["2020-01-01", "2021-01-01", "2022-01-01"];
  const all = calculateVirtualBenchmarkTimeline(portfolio.virtualLots, history, "msci-world", dates);
  const onlyA = calculateVirtualBenchmarkTimeline(portfolio.virtualLots.filter((lot) => lot.sourceSecurityKey === "A"), history, "msci-world", dates);
  near(all[0].value, 1000);
  near(all.at(-1)!.value, 3000);
  near(onlyA.at(-1)!.value, 0);
  assert.equal(onlyA[0].date, buy.trade_date);
});
test("missing entry remains missing while covered lots stay valid; incomplete totals are not zeros", () => {
  const result = buildBenchmarkComparison(sourceLots([transaction("old", "2000-01-01", "buy", 10, 1000), buy]), history, "msci-world", "fifo");
  assert.equal(result.lots[0].benchmark.currentValue, null);
  near(result.lots[1].benchmark.currentValue, 1500);
  assert.equal(result.holdings.A.benchmark.currentValue, null);
  assert.equal(result.missingLots, 1);
  const timeline = calculateVirtualBenchmarkTimeline(result.virtualLots, history, "msci-world", ["2022-01-01"]);
  assert.equal(timeline.at(-1)!.value, null);
});
test("missing S&P, unsupported IDs, missing valuation dates and non-EUR history fail gracefully", () => {
  const source = sourceLots([buy]);
  for (const id of ["sp-500", "unsupported"] as BenchmarkId[]) {
    const result = buildBenchmarkComparison(source, history, id, "fifo");
    assert.ok(result.error);
    assert.equal(result.lots[0].benchmark.returnPercent, null);
    near(result.lots[0].actual.returnPercent, 100);
  }
  assert.equal(buildBenchmarkComparison(source.map((lot) => ({ ...lot, priceDate: null })), history, "msci-world", "fifo").lots[0].benchmark.currentValue, null);
  assert.ok(buildBenchmarkComparison(source, history.map((point) => ({ ...point, currency: "USD" })), "msci-world", "fifo").error);
});
test("source observation after the decision date is never used", () => {
  assert.equal(benchmarkLevelAtDate([{ ...quote("2020-01-03", 100), observation_date: "2020-01-10" }], "2020-01-05"), null);
});
test("DAX changes values and returns; price-index metadata does not add dividends", () => {
  const source = sourceLots([buy]);
  const dax = history.map((row, i) => ({ ...row, benchmark_id: "dax", close_price: 100 + i * 40, series_type: "price_index" }));
  const result = buildBenchmarkComparison(source, [...history, ...dax], "dax", "fifo");
  near(result.lots[0].benchmark.currentValue, 1800);
  assert.match(result.description, /Price index; dividends excluded/);
  assert.equal(result.virtualLots[0].cashFlows.length, 2);
  assert.equal(result.dividendTreatment, "excluded");
});
test("actual dividends create economic value without changing market value or acquisition cost", () => {
  const transactions = [
    transaction("buy-dividend", "2020-01-01", "buy", 10, 10000),
    transaction("dividend", "2021-06-01", "dividend", 10, 2000)
  ];
  const levels = [quote("2019-12-31", 100), quote("2022-01-03", 130)];
  const result = buildBenchmarkComparison(sourceLots(transactions, "fifo", "2022-01-03", 1100), levels, "msci-world", "fifo");
  const row = result.lots[0];

  near(row.actual.deployed, 10000);
  near(row.actual.remainingCapital, 10000);
  near(row.actual.currentValue, 11000);
  near(row.actual.dividends, 2000);
  near(row.actual.economicReferenceValue, 13000);
  near(row.actual.gain, 3000);
  near(row.actual.returnPercent, 30);
  near(row.benchmark.currentValue, 13000);
  near(row.benchmark.economicReferenceValue, 13000);
  near(row.benchmark.returnPercent, 30);
  assert.equal(row.benchmark.dividends, null);
  near(row.difference.returnPercent, 0);
  assert.equal(result.dividendTreatment, "embedded");
  assert.equal(result.virtualLots[0].cashFlows.some((flow) => flow.kind === "dividend"), false);
  assert.deepEqual(row.actual.dividends, row.trace.actualDividends);
});
test("closed and partially sold lots retain dividends in economic value without reducing cost", () => {
  const levels = [quote("2019-12-31", 100), quote("2022-01-03", 130)];
  const closed = buildBenchmarkComparison(sourceLots([
    transaction("closed-buy", "2020-01-01", "buy", 10, 10000),
    transaction("closed-dividend", "2021-01-01", "dividend", 10, 500),
    transaction("closed-sale", "2022-01-03", "sell", 10, 12000)
  ], "fifo", "2022-01-03", 1100), levels, "msci-world", "fifo").lots[0];
  near(closed.actual.currentValue, 0);
  near(closed.actual.saleProceeds, 12000);
  near(closed.actual.dividends, 500);
  near(closed.actual.economicReferenceValue, 12500);
  near(closed.actual.gain, 2500);
  near(closed.actual.returnPercent, 25);

  const partial = buildBenchmarkComparison(sourceLots([
    transaction("partial-buy", "2020-01-01", "buy", 10, 10000),
    transaction("partial-sale", "2021-01-01", "sell", 4, 4800),
    transaction("partial-dividend", "2021-06-01", "dividend", 6, 600)
  ], "fifo", "2022-01-03", 1100), levels, "msci-world", "fifo").lots[0];
  near(partial.actual.deployed, 10000);
  near(partial.actual.remainingCapital, 6000);
  near(partial.actual.currentValue, 6600);
  near(partial.actual.saleProceeds, 4800);
  near(partial.actual.dividends, 600);
  near(partial.actual.economicReferenceValue, 12000);
});
test("benchmark series types explicitly disclose dividend treatment", () => {
  for (const type of ["net_total_return", "gross_total_return", "total_return", "performance_index"]) {
    assert.equal(benchmarkDividendTreatment(type), "embedded");
    assert.match(benchmarkCounterfactualLabel("Index", benchmarkDividendTreatment(type)), /Total-Return Counterfactual/);
  }
  for (const type of ["price", "price_index"]) assert.equal(benchmarkDividendTreatment(type), "excluded");
  assert.equal(benchmarkDividendTreatment("custom"), "unknown");
});
test("presentation scaling scales both sides, leaves returns invariant, and makes no mutations", () => {
  const transactions = [buy, transaction("sale", "2021-01-01", "sell", 3, 450)];
  const base = buildBenchmarkComparison(sourceLots(transactions), history, "msci-world", "fifo");
  const scaled = buildBenchmarkComparison(sourceLots(transactions.map((row) => ({ ...row, quantity: row.quantity! * 2, gross_amount: row.gross_amount! * 2 }))), history, "msci-world", "fifo");
  near(scaled.lots[0].benchmark.economicReferenceValue, base.lots[0].benchmark.economicReferenceValue! * 2);
  near(scaled.lots[0].benchmark.returnPercent, base.lots[0].benchmark.returnPercent!);
  near(scaled.lots[0].benchmark.annualizedPercent, base.lots[0].benchmark.annualizedPercent!);
});
test("navigation retains benchmark, account and encoded security identity", () => {
  const url = new URL(investmentDetailHref("ISIN/A B", "account", "dax"), "https://example.test");
  assert.equal(url.pathname, "/portfolio/ISIN%2FA%20B");
  assert.equal(url.searchParams.get("benchmark"), "dax");
  assert.equal(url.searchParams.get("portfolio"), "account");
});
