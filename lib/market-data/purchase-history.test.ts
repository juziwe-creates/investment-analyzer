import assert from "node:assert/strict";
import test from "node:test";
import { firstSecurityPurchase } from "./purchase-history";
function query(date: string | null = "2022-05-31") {
  const operations: unknown[][] = [];
  const result = {
    eq(column: string, value: string) { operations.push(["eq", column, value]); return result; },
    is(column: string, value: null) { operations.push(["is", column, value]); return result; },
    order(column: string, options: { ascending: boolean }) { operations.push(["order", column, options]); return result; },
    async limit(count: number) { operations.push(["limit", count]); return { data: date ? [{ trade_date: date }] : [], error: null }; }
  };
  return { result, operations };
}
test("history starts at the first owner/portfolio-scoped purchase, independent of dividends and securities-view dates", async () => {
  const q = query();
  assert.equal(await firstSecurityPurchase(q.result, "owner", "portfolio", { security_key: "US02079K3059", isin: "US02079K3059", ticker: "ABEA.XETRA" }), "2022-05-31");
  assert.deepEqual(q.operations, [["eq", "user_id", "owner"], ["eq", "portfolio_id", "portfolio"], ["eq", "type", "buy"], ["eq", "isin", "US02079K3059"], ["order", "trade_date", { ascending: true }], ["limit", 1]]);
});
test("fallback identities exclude rows with a stronger identifier and missing buys do not silently use a dividend date", async () => {
  const q = query();
  await firstSecurityPurchase(q.result, "owner", "portfolio", { security_key: "ABEA.XETRA", isin: null, ticker: "ABEA.XETRA" });
  assert.ok(q.operations.some((operation) => JSON.stringify(operation) === JSON.stringify(["is", "isin", null])));
  assert.ok(q.operations.some((operation) => JSON.stringify(operation) === JSON.stringify(["eq", "ticker", "ABEA.XETRA"])));
  await assert.rejects(firstSecurityPurchase(query(null).result, "owner", "portfolio", { security_key: "Alphabet", isin: null, ticker: null }), /No purchase/);
});
