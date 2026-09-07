import assert from "node:assert/strict";
import test from "node:test";
import { eurAggregationStatus } from "./currency";

test("allows aggregation when every known currency is EUR", () => {
  assert.deepEqual(eurAggregationStatus(["EUR", "eur", null]), { canAggregate: true, unsupportedCurrencies: [] });
});

test("withholds aggregation when unlike currencies are present", () => {
  assert.deepEqual(eurAggregationStatus(["EUR", "USD", "DKK", "USD"]), { canAggregate: false, unsupportedCurrencies: ["DKK", "USD"] });
});
