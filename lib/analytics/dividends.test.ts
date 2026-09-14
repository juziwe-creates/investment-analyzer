import test from "node:test";
import assert from "node:assert/strict";
import { calculateAnnualPersonalDividendYield, cumulativeDividendHistory, investmentDividendEvents } from "./dividends";
import { selectedTransactionRows } from "./selected-transactions";
import { acquisitionCost, buildInvestmentLedger, calculatePurchaseLots, dividendAmount, type AnalyticsTransaction } from "./engine";

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
