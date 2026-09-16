import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolioTimeline, calculatePurchaseLots, type AnalyticsTransaction, type AnalyticsPrice } from "../analytics/engine";
import { advancePlayback, buildUniverseHistory, dateTime, dividendBatches, snapshotDates, snapshotIndex, snapshotModel } from "./history";
import { universeModel } from "./model";

const tx = (changes: Partial<AnalyticsTransaction> = {}): AnalyticsTransaction => ({
  id: "buy", type: "buy", trade_date: "2020-01-02", security_name: "Example", isin: "A", ticker: "A.DE",
  quantity: 10, unit_price: 10, gross_amount: 100, net_amount: null, currency: "EUR", created_at: "2020-01-01T00:00:00Z", ...changes
});
const price = (changes: Partial<AnalyticsPrice> = {}): AnalyticsPrice => ({ security_key: "A", price: 20, price_date: "2020-01-03", currency: "EUR", ...changes });
const current = universeModel({ holdings: [], account: "All accounts", asOfDate: "2020-03-01", currencyReady: true, inventoryComplete: true });
const transactions = [tx(), tx({ id: "more", trade_date: "2020-01-04", quantity: 5, gross_amount: 100 }),
  tx({ id: "dividend", type: "dividend", trade_date: "2020-01-05", gross_amount: 30, net_amount: 22 }),
  tx({ id: "partial", type: "sell", trade_date: "2020-01-06", quantity: 12, gross_amount: 300 }),
  tx({ id: "closed", type: "sell", trade_date: "2020-01-07", quantity: 3, gross_amount: 75 }),
  tx({ id: "reopen", trade_date: "2020-02-02", quantity: 2, gross_amount: 45 })];

test("snapshot dates retain every event, compact routine prices, exclude future data", () => {
  const prices = Array.from({ length: 29 }, (_, i) => price({ price_date: `2020-01-${String(i + 1).padStart(2, "0")}` }));
  const dates = snapshotDates(transactions, [...prices, price({ price_date: "2030-01-01" })], "2020-03-01");
  assert.deepEqual([...dates].sort(), ["2020-01-02", "2020-01-04", "2020-01-05", "2020-01-06", "2020-01-07", "2020-01-29", "2020-02-02", "2020-03-01"]);
});
test("history reuses FIFO inventory, carries only past prices, and represents full sales and reopening", () => {
  const prices = [price(), price({ price_date: "2020-02-20", price: 30 })];
  const history = buildUniverseHistory({ transactions: [...transactions].reverse(), prices, today: "2020-03-01", currencyReady: true, portfolio: "account&1" });
  for (let i = 0; i < history.snapshots.length; i++) {
    const snapshot = history.snapshots[i];
    const model = snapshotModel(current, history, i);
    const lots = calculatePurchaseLots(transactions.filter((row) => row.trade_date <= snapshot.date), prices, snapshot.date).filter((lot) => lot.remainingQuantity > 0);
    assert.equal(model.holdings[0]?.quantity ?? 0, lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0));
    assert.equal(model.holdings[0]?.costBasis ?? 0, lots.reduce((sum, lot) => sum + lot.remainingAcquisitionCost, 0));
    if (model.holdings.length) {
      assert.equal(model.holdings[0].value, lots.some((lot) => lot.currentRemainingValue === null) ? null : lots.reduce((sum, lot) => sum + lot.currentRemainingValue!, 0));
      assert.ok(!model.holdings[0].priceDate || model.holdings[0].priceDate <= snapshot.date);
      assert.equal(model.holdings[0].href, "/portfolio/A?portfolio=account%261");
    }
  }
  assert.equal(history.catalog.length, 1);
  assert.deepEqual(history.snapshots.find((row) => row.date === "2020-01-07")?.states, []);
  assert.equal(history.snapshots[0].states[0][2], null);
  assert.equal(history.snapshots[0].value, null);
  assert.equal(history.snapshots.at(-1)?.value, 60);
  assert.deepEqual(history.dividends, [{ id: "dividend", date: "2020-01-05", key: "A", amount: 30 }]);
});
test("optional snapshot output leaves existing timeline results unchanged, including lot matching", () => {
  for (const lotMatchingMethod of ["fifo", "lifo"] as const) {
    const prices = [price()];
    const expected = buildPortfolioTimeline(transactions, prices, { lotMatchingMethod });
    const actual = buildPortfolioTimeline(transactions, prices, { lotMatchingMethod }, { dates: new Set(transactions.map((row) => row.trade_date)), emit(date, holdings) {
      const lots = calculatePurchaseLots(transactions.filter((row) => row.trade_date <= date), prices, date, { lotMatchingMethod }).filter((lot) => lot.remainingQuantity > 0);
      assert.equal(holdings.reduce((sum, row) => sum + row.investedCapital, 0), lots.reduce((sum, row) => sum + row.remainingAcquisitionCost, 0));
    } });
    assert.deepEqual(actual, expected);
  }
});
test("currency, missing quotes and incomplete history remain explicit, not zero valuations", () => {
  const rows = [tx(), tx({ id: "B", isin: "B" }), tx({ id: "oversell", type: "sell", trade_date: "2020-01-06", quantity: 50 })];
  const history = buildUniverseHistory({ transactions: rows, prices: [price()], today: "2020-03-01", currencyReady: true });
  const first = snapshotModel(current, history, 0);
  assert.equal(first.value, null);
  assert.ok(first.holdings.every((row) => row.value === null));
  assert.equal(history.snapshots.at(-1)?.value, null);
  assert.ok(history.snapshots.at(-1)?.warnings.some((warning) => warning.includes("Buy history")));
  const fx = buildUniverseHistory({ transactions, prices: [price()], today: "2020-03-01", currencyReady: false });
  assert.ok(fx.snapshots.every((snapshot) => snapshot.value === null));
  assert.equal(fx.dividends[0].amount, null);
});
test("future transactions/quotes are excluded and presentation-scaled inputs stay scaled", () => {
  const base = buildUniverseHistory({ transactions, prices: [price()], today: "2020-03-01", currencyReady: true });
  const scaled = buildUniverseHistory({ transactions: transactions.map((row) => ({ ...row, quantity: row.quantity! * 2, gross_amount: row.gross_amount! * 2, net_amount: row.net_amount === null ? null : row.net_amount * 2 })), prices: [price()], today: "2020-03-01", currencyReady: true });
  assert.equal(scaled.snapshots.at(-1)?.value, base.snapshots.at(-1)!.value! * 2);
  assert.equal(scaled.snapshots.at(-1)?.states[0][1], base.snapshots.at(-1)!.states[0][1] * 2);
  assert.equal(scaled.dividends[0].amount, 60);
  const future = buildUniverseHistory({ transactions: [...transactions, tx({ trade_date: "2030-01-01" })], prices: [price(), price({ price_date: "2030-01-01", price: 1000 })], today: "2020-03-01", currencyReady: true });
  assert.deepEqual(future, base);
});
test("playback lookup never looks ahead, clamps at end and limits suspended-frame jumps", () => {
  const history = buildUniverseHistory({ transactions, prices: [], today: "2020-03-01", currencyReady: true });
  assert.equal(snapshotIndex(history.snapshots, dateTime("2020-01-01")), -1);
  assert.equal(snapshotIndex(history.snapshots, dateTime("2020-01-03")), 0);
  assert.equal(snapshotIndex(history.snapshots, dateTime("2020-01-04")), 1);
  assert.equal(advancePlayback(999, 250, 0, 1000, 1), 1000);
  assert.equal(advancePlayback(0, 10000, 0, 30000, 2), 500);
  assert.equal(advancePlayback(0, 100, 0, 30000, 0.5), 50);
});
test("dividend batches preserve every crossed payment, unknown cash, and exclude scrubs backwards", () => {
  const events = [{ id: "1", key: "A", date: "2020-01-05", amount: 10 }, { id: "2", key: "A", date: "2020-01-05", amount: 20 }, { id: "3", key: "B", date: "2020-01-06", amount: null }];
  const start = dateTime("2020-01-04"), end = dateTime("2020-01-06");
  assert.deepEqual(dividendBatches(events, start, end), [{ key: "A", amount: 30, count: 2 }, { key: "B", amount: null, count: 1 }]);
  assert.deepEqual(dividendBatches(events, end, end), []);
  assert.deepEqual(dividendBatches(events, end, start), []);
  assert.deepEqual(dividendBatches(events, dateTime("2020-01-05"), end), [{ key: "B", amount: null, count: 1 }]);
});
