import assert from "node:assert/strict";
import test from "node:test";
import { presentationFactor, scaleTransaction } from "./presentation";
import { calculatePurchaseLots } from "./engine";
import type { Database } from "../../types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "buy", user_id: "user", portfolio_id: "portfolio", security_id: null,
    security_name: "Example", isin: "EX0000000001", wkn: null, ticker: null,
    exchange: null, security_currency: "EUR", asset_type: "stock", type: "buy",
    trade_date: "2020-01-01", settlement_date: null, quantity: 100, unit_price: 100,
    gross_amount: 10000, net_amount: 10010, currency: "EUR", external_id: "private",
    broker: "private", source_document_id: "document", import_run_id: "import",
    notes: "Actual purchase: 100 shares", created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-01T00:00:00Z", ...overrides
  };
}

test("presentation normalizes deployed capital and rejects undefined scales", () => {
  assert.equal(presentationFactor(500000), 2);
  assert.equal(presentationFactor(2000000), 0.5);
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => presentationFactor(value));
});

test("scaling copies source facts, preserves nulls and removes private text", () => {
  const source = transaction({ net_amount: null });
  const before = structuredClone(source);
  const scaled = scaleTransaction(source, 2);
  assert.equal(scaled.quantity, 200);
  assert.equal(scaled.gross_amount, 20000);
  assert.equal(scaled.unit_price, 100);
  assert.equal(scaled.net_amount, null);
  assert.equal(scaled.trade_date, source.trade_date);
  assert.equal(scaled.notes, null);
  assert.equal(scaled.external_id, null);
  assert.deepEqual(source, before);
});

test("multiple lots, dividends and partial/full sales retain economics at both scales", () => {
  const rows = [
    transaction({}),
    transaction({ id: "buy2", trade_date: "2021-01-01", quantity: 50, gross_amount: 5000, net_amount: 5005 }),
    transaction({ id: "dividend", type: "dividend", trade_date: "2022-01-01", quantity: 150, unit_price: 2, gross_amount: 300, net_amount: 214.725 }),
    transaction({ id: "sell", type: "sell", trade_date: "2023-01-01", quantity: 120, unit_price: 150, gross_amount: 18000, net_amount: 17990 })
  ];
  const prices = [{ security_key: "EX0000000001", price: 160, price_date: "2024-01-01", currency: "EUR" }];
  for (const lotMatchingMethod of ["fifo", "lifo"] as const) {
    const original = calculatePurchaseLots(rows, prices, "2024-01-01", { lotMatchingMethod });
    for (const factor of [2, 0.5]) {
      const scaled = calculatePurchaseLots(rows.map((row) => scaleTransaction(row, factor)), prices, "2024-01-01", { lotMatchingMethod });
      original.forEach((lot, index) => {
        const result = scaled[index];
        for (const key of ["originalQuantity", "remainingQuantity", "originalAcquisitionCost", "remainingAcquisitionCost", "attributedDividends", "currentRemainingValue"] as const) {
          assert.equal(result[key], lot[key] === null ? null : lot[key] * factor, key);
        }
        assert.equal(result.acquisitionCostPerShare, lot.acquisitionCostPerShare);
        assert.equal(result.totalReturnPercent, lot.totalReturnPercent);
        if (lot.annualizedReturnPercent !== null && result.annualizedReturnPercent !== null) {
          assert.ok(Math.abs(result.annualizedReturnPercent - lot.annualizedReturnPercent) < 0.000001);
        } else assert.equal(result.annualizedReturnPercent, lot.annualizedReturnPercent);
        assert.equal(result.status, lot.status);
      });
    }
  }
});
