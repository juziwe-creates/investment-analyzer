import assert from "node:assert/strict";
import test from "node:test";
import { buildInvestmentLedger, buildPortfolioTimeline, calculatePurchaseLots, type AnalyticsTransaction } from "./engine";
import { investmentHistory } from "./investment-history";
import { investmentDividendEvents } from "./dividends";
import { parseSplitRatio, splitPrice } from "./splits";
import { buildBenchmarkComparison } from "./benchmark-portfolio";
import type { LotProfitability } from "./profitability";
import { createEodhdProvider } from "../market-data/providers/eodhd";

const split = { securityKey: "ALPHABET", date: "2022-07-18", numerator: 20, denominator: 1 };
function row(id: string, type: AnalyticsTransaction["type"], date: string, quantity: number, amount: number): AnalyticsTransaction {
  return { id, type, trade_date: date, created_at: `${date}T12:00:00Z`, security_name: "Alphabet", isin: "ALPHABET", ticker: "ABEA.XETRA",
    quantity, unit_price: quantity ? amount / quantity : null, gross_amount: amount, net_amount: amount, currency: "EUR", splits: [split] };
}
const quote = (date: string, price: number) => ({ security_key: "ALPHABET", price_date: date, price, currency: "EUR" });

test("dated 20-for-1 split keeps value and total cost invariant without changing original purchases", () => {
  const rows = [row("buy", "buy", "2022-07-01", 10, 20000)];
  const original = structuredClone(rows);
  const points = buildPortfolioTimeline(rows, [quote("2022-07-15", 2000), quote("2022-07-18", 100)]);
  assert.equal(points.find((point) => point.date === "2022-07-15")?.portfolioMarketValue, 20000);
  assert.equal(points.find((point) => point.date === split.date)?.portfolioMarketValue, 20000);
  const lot = calculatePurchaseLots(rows, [quote("2022-07-18", 100)], split.date)[0];
  assert.equal(lot.originalQuantity, 10);
  assert.equal(lot.remainingQuantity, 200);
  assert.equal(lot.acquisitionCostPerShare, 100);
  assert.equal(lot.originalAcquisitionCost, 20000);
  assert.equal(lot.remainingAcquisitionCost, 20000);
  assert.equal(lot.status, "open");
  assert.equal(lot.totalGain, 0);
  assert.equal(lot.cashFlows.filter((flow) => flow.kind !== "terminal_value").length, 1);
  assert.deepEqual(rows, original);
});

test("split happens before same-day buys and sales, is deduplicated, and preserves FIFO/LIFO attribution", () => {
  const rows = [row("old", "buy", "2022-07-01", 10, 20000), row("new", "buy", split.date, 10, 1000), row("sale", "sell", split.date, 20, 2200)];
  const fifo = calculatePurchaseLots(rows, [quote(split.date, 110)], split.date, { lotMatchingMethod: "fifo" });
  assert.equal(fifo[0].remainingQuantity, 180);
  assert.equal(fifo[0].remainingAcquisitionCost, 18000);
  assert.equal(fifo[0].saleAllocations[0].acquisitionFraction, 0.1);
  assert.equal(fifo[0].status, "partial");
  assert.equal(fifo[1].remainingQuantity, 10);
  const lifo = calculatePurchaseLots(rows, [quote(split.date, 110)], split.date, { lotMatchingMethod: "lifo" });
  assert.equal(lifo[1].remainingQuantity, 0);
  assert.equal(lifo[0].remainingQuantity, 190);
});

test("dividend eligibility and charts use dated quantities; a prior raw quote is rebased at the split", () => {
  const rows = [row("buy", "buy", "2022-07-01", 10, 20000), row("div", "dividend", "2022-07-19", 200, 200)];
  assert.equal(investmentDividendEvents(rows)[0].eligibleShares, 200);
  assert.equal(investmentDividendEvents(rows)[0].perShare, 1);
  assert.equal(buildInvestmentLedger(rows).at(-1)?.activeShares, 200);
  const points = investmentHistory(rows, [quote("2022-07-15", 2000), quote("2022-07-19", 100)]);
  assert.equal(points.find((point) => point.date === split.date)?.positionValue, 20000);
  assert.equal(points.at(-1)?.economicValue, 20200);
});

test("reverse splits, multiple splits and explicit historical cutoffs do not change cost or invent gains", () => {
  const rows = [row("buy", "buy", "2022-07-01", 10, 20000)];
  rows[0].splits = [split, { ...split, date: "2022-08-01", numerator: 1, denominator: 10 }];
  const before = calculatePurchaseLots(rows, [quote("2022-07-15", 2000)], "2022-07-15")[0];
  assert.equal(before.remainingQuantity, 10);
  const after = calculatePurchaseLots(rows, [quote("2022-08-01", 1000)], "2022-08-01")[0];
  assert.equal(after.remainingQuantity, 20);
  assert.equal(after.remainingAcquisitionCost, 20000);
  assert.equal(after.totalGain, 0);
  assert.equal(splitPrice(2000, "ALPHABET", "2022-07-15", "2022-08-01", rows[0].splits), 1000);
  assert.deepEqual(parseSplitRatio("20.000000/1.000000"), { numerator: 20, denominator: 1 });
  assert.throws(() => parseSplitRatio("1/0"));
  assert.throws(() => parseSplitRatio("1281/1000"), /review/);
});

test("a split before a purchase neither multiplies that buy nor extends its investment chart into unowned history", () => {
  const rows = [row("buy", "buy", "2022-07-19", 10, 1000)];
  const lot = calculatePurchaseLots(rows, [quote("2022-07-20", 100)], "2022-07-20")[0];
  assert.equal(lot.remainingQuantity, 10);
  assert.equal(investmentHistory(rows, [quote("2022-07-20", 100)])[0].date, "2022-07-19");
});

test("dividends before a split retain their cash and yield while their comparison per-share units are rebased", () => {
  const rows = [row("buy", "buy", "2022-07-01", 10, 20000), row("div", "dividend", "2022-07-10", 10, 200)];
  const lot = calculatePurchaseLots(rows, [quote("2022-07-20", 100)], "2022-07-20")[0];
  assert.equal(lot.attributedDividends, 200);
  assert.equal(lot.latestDividendPerShare, 1);
  assert.equal(lot.currentDividendProfitabilityPercent, 1);
  assert.equal(investmentDividendEvents(rows)[0].perShare, 20);
});

test("benchmark virtual exits use cost fractions after a split rather than original share counts", () => {
  const rows = [row("buy", "buy", "2022-07-01", 10, 20000), row("sale", "sell", "2022-07-19", 100, 11000)];
  const lot = calculatePurchaseLots(rows, [quote("2022-07-20", 110)], "2022-07-20")[0];
  const source = { id: lot.buyTransactionId, securityKey: lot.securityKey, securityName: lot.securityName, tradeDate: lot.buyDate,
    quantity: lot.originalQuantity, remainingQuantity: lot.remainingQuantity, costBasis: lot.originalAcquisitionCost,
    remainingCostBasis: lot.remainingAcquisitionCost, priceDate: lot.currentPriceDate, currency: "EUR", saleAllocations: lot.saleAllocations,
    cashFlows: lot.cashFlows, accumulatedDividends: lot.attributedDividends, currentValue: lot.currentRemainingValue,
    totalEconomicValue: lot.totalEconomicValue, attributedSaleProceeds: lot.attributedSaleProceeds } as LotProfitability;
  const history = ["2022-07-01", "2022-07-19", "2022-07-20"].map((date) => ({ benchmark_id: "dax", price_date: date, observation_date: date,
    close_price: 100, currency: "EUR", frequency: "daily", series_type: "performance_index", is_derived: false, is_partial_period: false }));
  const result = buildBenchmarkComparison([source], history, "dax", "fifo");
  assert.equal(result.virtualLots[0].exits[0].fraction, 0.5);
  assert.equal(result.virtualLots[0].remainingBenchmarkUnits, 100);
  assert.equal(result.lots[0].benchmark.economicReferenceValue, 20000);
});

test("EODHD adapter fetches dated splits and preserves raw close separately from dividend-adjusted close", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    paths.push(path);
    return new Response(JSON.stringify(path.includes("/splits/") ? [{ date: split.date, split: "20.000000/1.000000" }]
      : path.includes("/div/") ? [{ date: "2022-07-19", value: 0.5, unadjustedValue: 10, currency: "USD" }]
      : [{ date: "2022-07-15", close: 2000, adjusted_close: 90 }]), { status: 200 });
  };
  try {
    const provider = createEodhdProvider("test-token");
    const input = { symbol: "ABEA.XETRA", fromDate: "2022-07-01", toDate: "2022-07-31" };
    assert.deepEqual(await provider.fetchSplits!(input), [{ splitDate: split.date, numerator: 20, denominator: 1 }]);
    const prices = await provider.fetchDailyPrices(input);
    assert.equal(prices[0].closePrice, 2000);
    assert.equal(prices[0].adjustedClosePrice, 90);
    const dividend = (await provider.fetchDividends(input))[0];
    assert.equal(dividend.amountPerShare, 10);
    assert.equal(dividend.currency, "USD");
    assert.deepEqual(paths, ["/api/splits/ABEA.XETRA", "/api/eod/ABEA.XETRA", "/api/div/ABEA.XETRA"]);
  } finally { globalThis.fetch = originalFetch; }
});
