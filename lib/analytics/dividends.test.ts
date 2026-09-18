import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnnualPersonalDividendYield, calculateYieldOnCost, cumulativeDividendHistory, investmentDividendEvents, investmentYieldsOnCost } from "./dividends";
import { investmentHistory } from "./investment-history";
import { selectedTransactionRows } from "./selected-transactions";
import { acquisitionCost, buildInvestmentLedger, buildPortfolioTimeline, calculatePurchaseLots, dividendAmount, type AnalyticsTransaction } from "./engine";

const row = (id: string, type: AnalyticsTransaction["type"], date: string, quantity: number | null, gross: number | null): AnalyticsTransaction => ({ id, type, trade_date: date, quantity, gross_amount: gross, unit_price: null, net_amount: null, currency: "EUR", security_name: "Example", isin: "EX", ticker: null, created_at: `${date}T00:00:00Z` });
const annual = (transactions: AnalyticsTransaction[], date = "2024-12-31") => calculateAnnualPersonalDividendYield(transactions, date).at(-1)!;
test("unchanged EUR100 + EUR200 cost and EUR30 dividends is exactly 10 percent", () => {
  const result = annual([row("a", "buy", "2010-01-01", 10, 100), row("b", "buy", "2011-01-01", 10, 200), row("d", "dividend", "2024-05-01", 20, 30)]);
  assert.equal(result.averageCost, 300); assert.equal(result.yieldPercent, 10);
});
test("mid-year buy weights all calendar days, including leap-year days", () => {
  const result = annual([row("a", "buy", "2023-01-01", 10, 100), row("b", "buy", "2024-07-02", 10, 200), row("d", "dividend", "2024-08-01", 20, 30)]);
  assert.equal(result.averageCost, 200); assert.equal(result.yieldPercent, 15);
});
test("partial and full sales use shared lot costs, not sale proceeds", () => {
  for (const quantity of [5, 10]) {
    const result = annual([row("a", "buy", "2023-01-01", 10, 100), row("d", "dividend", "2024-03-01", 10, 10), row("s", "sell", "2024-07-02", quantity, 999)]);
    assert.equal(result.averageCost, quantity === 5 ? 75 : 50);
    assert.equal(result.yieldPercent, 10 / result.averageCost! * 100);
  }
});
test("multiple dividends aggregate; current YTD ends today inclusive and is not annualized", () => {
  const transactions = [row("a", "buy", "2023-01-01", 10, 100), row("d1", "dividend", "2024-02-01", 10, 10), row("d2", "dividend", "2024-06-01", 10, 5), row("future", "dividend", "2024-12-01", 10, 50)];
  const result = annual(transactions, "2024-06-30");
  assert.equal(result.ytd, true); assert.equal(result.date, "2024-06-30"); assert.equal(result.yieldPercent, 15);
  const prior = calculateAnnualPersonalDividendYield(transactions, "2025-01-01").find((row) => row.year === 2024)!;
  assert.equal(prior.ytd, false);
});
test("zero basis, incomplete history and missing gross withhold yield", () => {
  assert.equal(annual([row("a", "buy", "2023-01-01", 10, 0)]).yieldPercent, null);
  for (const transactions of [
    [row("d", "dividend", "2024-01-01", 10, 10)],
    [row("s", "sell", "2023-01-01", 20, 100), row("a", "buy", "2023-02-01", 10, 100)],
    [row("a", "buy", "2023-01-01", 10, 100), { ...row("d", "dividend", "2024-01-01", 10, null), net_amount: 7 }]
  ]) assert.equal(annual(transactions).yieldPercent, null);
});
test("eligibility respects same-day ordering, partial sales and later closure", () => {
  const transactions = [row("a", "buy", "2023-01-01", 10, 100), row("s", "sell", "2024-01-01", 5, 100), { ...row("d", "dividend", "2024-01-01", 5, 10), net_amount: 7, created_at: "2024-01-01T01:00:00Z" }, row("close", "sell", "2024-02-01", 5, 100)];
  const [event] = investmentDividendEvents(transactions, { lotMatchingMethod: "lifo" });
  assert.equal(event.eligibleShares, 5); assert.equal(event.perShare, 2); assert.equal(event.net, 7); assert.equal(event.cumulative, 10);
});
test("cash-only dividends can accumulate without inventing gross or share eligibility", () => {
  const transactions = [{ ...row("d", "dividend", "2024-01-01", null, null), net_amount: 7 }, row("d2", "dividend", "2024-02-01", null, 3)];
  const events = investmentDividendEvents(transactions);
  assert.equal(events[0].perShare, null); assert.equal(events[0].gross, null);
  assert.equal(events[1].cumulative, transactions.reduce((sum, row) => sum + dividendAmount(row), 0));
  assert.equal(events[1].cumulative, 10);
});
test("cost ledger agrees with purchase lots for both policies and does not mutate facts", () => {
  const transactions = [row("a", "buy", "2023-01-01", 10, 100), row("b", "buy", "2023-02-01", 10, 300), row("s", "sell", "2024-01-01", 12, 500)];
  const copy = structuredClone(transactions);
  for (const lotMatchingMethod of ["fifo", "lifo"] as const) {
    const ledger = buildInvestmentLedger(transactions, { lotMatchingMethod });
    const lots = calculatePurchaseLots(transactions, [], undefined, { lotMatchingMethod });
    assert.equal(ledger.at(-1)!.activeCost, lots.reduce((sum, lot) => sum + lot.remainingAcquisitionCost, 0));
  }
  assert.deepEqual(transactions, copy); assert.equal(acquisitionCost(transactions[0]), 100);
});
test("presentation scaling preserves yield and dividends per share", () => {
  const transactions = [row("a", "buy", "2023-01-01", 10, 100), row("d", "dividend", "2024-01-01", 10, 10)];
  const scaled = transactions.map((row) => ({ ...row, quantity: row.quantity! * 2, gross_amount: row.gross_amount! * 2 }));
  assert.equal(annual(transactions).yieldPercent, annual(scaled).yieldPercent);
  assert.equal(investmentDividendEvents(transactions)[0].perShare, investmentDividendEvents(scaled)[0].perShare);
});

test("cumulative history starts at zero and retains the last total for same-day events", () => {
  const events = investmentDividendEvents([row("a", "buy", "2020-01-01", 10, 100), row("d1", "dividend", "2024-01-01", 10, 10), row("d2", "dividend", "2024-01-01", 10, 5)]);
  assert.deepEqual(cumulativeDividendHistory(events, "2020-01-01"), [{ date: "2020-01-01", value: 0 }, { date: "2024-01-01", value: 15 }]);
});

test("selected rows reuse lot metrics and do not invent sale/dividend returns", () => {
  const transactions = [row("b", "buy", "2020-01-01", 10, 100), row("s", "sell", "2021-01-01", 10, 140), row("d", "dividend", "2020-05-01", 10, 5), row("fee", "fee", "2020-05-01", null, 2)];
  const source = { id: "b", costBasis: 103, remainingQuantity: 0, currentValue: null, attributedSaleProceeds: 138, totalReturnPercent: 38.2, annualizedReturnPercent: 12.3 };
  const rows = selectedTransactionRows(transactions, [source]);
  const buy = rows.find((row) => row.type === "buy")!;
  assert.equal(rows.length, 3); assert.equal(buy.reference, source.attributedSaleProceeds); assert.equal(buy.amount, source.costBasis);
  assert.equal(buy.returnPercent, source.totalReturnPercent); assert.equal(buy.xirr, source.annualizedReturnPercent);
  assert.ok(rows.filter((row) => row.type !== "buy").every((row) => row.returnPercent === null && row.xirr === null));
  assert.equal(selectedTransactionRows(transactions, [{ ...source, remainingQuantity: 2, currentValue: 99 }]).find((row) => row.type === "buy")!.reference, 99);
});

test("mixed currencies withhold new aggregates without relabeling or converting cash", () => {
  const transactions = [row("b", "buy", "2020-01-01", 10, 100), { ...row("d", "dividend", "2024-01-01", 10, 10), currency: "USD" }];
  const result = annual(transactions);
  assert.equal(result.yieldPercent, null); assert.equal(result.averageCost, null); assert.equal(result.grossDividends, null);
  const [event] = investmentDividendEvents(transactions);
  assert.equal(event.perShare, null); assert.equal(event.cumulative, null); assert.equal(event.gross, 10); assert.equal(event.currency, "USD");
});

test("payment-date yield resets annually and uses active LIFO cost after buys and sales", () => {
  const rows = [row("b1", "buy", "2024-01-01", 10, 1500), row("d0", "dividend", "2024-05-01", 10, 100),
    row("d1", "dividend", "2025-03-01", 10, 30), row("b2", "buy", "2025-04-01", 5, 500), row("d2", "dividend", "2025-06-01", 15, 45),
    row("s", "sell", "2025-07-01", 5, 900), row("d3", "dividend", "2025-09-01", 10, 15)];
  const events = investmentDividendEvents(rows, { lotMatchingMethod: "lifo" });
  assert.equal(events[1].yearToDateCash, 30); assert.equal(events[1].yieldPercent, 2);
  assert.equal(events[2].activeCost, 2000); assert.equal(events[2].yieldPercent, 3.75);
  assert.equal(events[3].activeCost, 1500); assert.equal(events[3].yieldPercent, 6);
  assert.deepEqual(events.map((event) => event.id), ["d0", "d1", "d2", "d3"]);
});

test("Yield on Cost locks last full year to its final payment, ignoring later buys and current year", () => {
  const rows = [row("b1", "buy", "2020-01-01", 10, 1000), row("b2", "buy", "2023-01-01", 5, 500),
    row("d1", "dividend", "2025-03-01", 15, 30), row("b3", "buy", "2025-06-01", 5, 500), row("d2", "dividend", "2025-06-15", 20, 40),
    row("d3", "dividend", "2025-09-01", 20, 50), row("late", "buy", "2025-12-01", 10, 1000), row("future", "dividend", "2026-01-01", 30, 999)];
  const result = calculateYieldOnCost(rows, "2026-06-01");
  assert.equal(result.year, 2025); assert.equal(result.dividendCash, 120); assert.equal(result.activeCost, 2000);
  assert.equal(result.finalDividendDate, "2025-09-01"); assert.equal(result.yieldPercent, 6);
  assert.equal(calculateYieldOnCost(rows, "2026-01-01").yieldPercent, 6);
  const scaled = rows.map((row) => ({ ...row, quantity: row.quantity! * 2, gross_amount: row.gross_amount! * 2 }));
  assert.equal(calculateYieldOnCost(scaled, "2026-06-01").yieldPercent, 6);
});

test("Yield on Cost uses remaining cost, handles no dividends, zero denominator and missing history", () => {
  const buy = row("b", "buy", "2020-01-01", 20, 2000);
  const sale = row("s", "sell", "2025-01-01", 10, 3000);
  const dividend = row("d", "dividend", "2025-05-01", 10, 100);
  assert.equal(calculateYieldOnCost([buy, sale, dividend], "2026-09-01").yieldPercent, 10);
  assert.equal(calculateYieldOnCost([buy], "2026-09-01").yieldPercent, 0);
  assert.equal(calculateYieldOnCost([{ ...buy, gross_amount: 0 }], "2026-09-01").yieldPercent, null);
  assert.equal(calculateYieldOnCost([dividend], "2026-09-01").yieldPercent, null);
  assert.equal(calculateYieldOnCost([buy, { ...sale, quantity: 21 }], "2026-09-01").yieldPercent, null);
  assert.equal(calculateYieldOnCost([buy, { ...dividend, currency: "USD" }], "2026-09-01").yieldPercent, null);
  assert.equal(calculateYieldOnCost([buy, { ...dividend, gross_amount: null, net_amount: null }], "2026-09-01").yieldPercent, null);
});

test("cash fallback is factual; unknown cash invalidates YTD only until next calendar year", () => {
  const rows = [row("b", "buy", "2020-01-01", 10, 1000), { ...row("d", "dividend", "2025-05-01", 10, null), net_amount: 70 }];
  assert.ok(Math.abs(calculateYieldOnCost(rows, "2026-06-01").yieldPercent! - 7) < 1e-10);
  assert.equal(investmentDividendEvents(rows)[0].perShare, null);
  rows.push(row("missing", "dividend", "2025-06-01", null, null), row("later", "dividend", "2025-07-01", 10, 30), row("next", "dividend", "2026-01-01", 10, 20));
  const events = investmentDividendEvents(rows);
  assert.equal(events[2].yieldPercent, null); assert.equal(events[3].yieldPercent, 2);
});

test("investment yields do not mix securities and exact same-day order fixes final payment basis", () => {
  const rows = [row("b", "buy", "2020-01-01", 10, 1000), row("d", "dividend", "2025-05-01", 10, 100),
    { ...row("later", "buy", "2025-05-01", 10, 1000), created_at: "2025-05-01T12:00:00Z" }];
  assert.equal(calculateYieldOnCost(rows, "2026-01-01").yieldPercent, 10);
  const other = { ...row("other", "buy", "2020-01-01", 10, 2000), isin: "OTHER" };
  const yields = investmentYieldsOnCost([...rows, other], "2026-01-01");
  assert.equal(yields.EX.yieldPercent, 10); assert.equal(yields.OTHER.yieldPercent, 0);
  assert.equal(calculateYieldOnCost([...rows, other], "2026-01-01").yieldPercent, null);
});

test("investment history includes transaction dates between quotes and final sale with no dividend", () => {
  const rows = [row("b", "buy", "2025-01-03", 10, 100), row("b2", "buy", "2025-01-06", 10, 200), row("s", "sell", "2025-01-08", 20, 400)];
  const prices = [{ security_key: "EX", price_date: "2025-01-01", price: 10, currency: "EUR" }, { security_key: "EX", price_date: "2025-01-10", price: 25, currency: "EUR" }];
  const history = investmentHistory(rows, prices);
  assert.deepEqual(history.map((point) => point.date), ["2025-01-03", "2025-01-06", "2025-01-08", "2025-01-10"]);
  assert.deepEqual(history.map((point) => point.deployedCapital), [100, 300, 0, 0]);
  assert.equal(history[1].price, 10); assert.equal(history[1].positionValue, 200);
  assert.equal(history[2].positionValue, 0);
  assert.equal(investmentHistory(rows, prices.slice(1))[0].price, null);
  assert.equal(investmentHistory(rows, prices.slice(1))[0].positionValue, null);
  const timeline = buildPortfolioTimeline(rows, prices);
  assert.equal(timeline.find((point) => point.date === "2025-01-08")?.currentDeployedCapital, 0);
  assert.equal(timeline.find((point) => point.date === "2025-01-10")?.portfolioMarketValue, 0);
});
