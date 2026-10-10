import assert from "node:assert/strict";
import test from "node:test";
import { priceHistoryCoverage } from "./coverage";
const price = (priceDate: string) => ({ priceDate, closePrice: 100, openPrice: null, highPrice: null, lowPrice: null, adjustedClosePrice: null, volume: null });
test("Alphabet prices starting in 2024 cannot claim coverage of its 2022 purchase", () => {
  const result = priceHistoryCoverage([price("2026-10-09"), price("2024-06-10")], "2022-05-31");
  assert.equal(result.first, "2024-06-10");
  assert.equal(result.last, "2026-10-09");
  assert.match(result.warning!, /2024-06-10.*2022-05-31/);
});
test("full price coverage is independent of when dividends begin", () => {
  assert.equal(priceHistoryCoverage([price("2022-05-30"), price("2026-10-09")], "2022-05-31").warning, null);
  assert.throws(() => priceHistoryCoverage([], "2022-05-31"), /no prices/);
  assert.throws(() => priceHistoryCoverage([{ ...price("2022-05-30"), closePrice: Number.NaN }], "2022-05-31"), /invalid/);
});
