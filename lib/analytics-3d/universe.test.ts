import test from "node:test";
import assert from "node:assert/strict";
import { contextHref, resolveSector, universeModel, type Sector } from "./model";
import { layoutHoldings, sceneBounds, sphereRadius } from "./layout";

test("volume follows value, with explicit legibility clamps", () => {
  assert.ok(Math.abs(sphereRadius(800, 800) / sphereRadius(100, 800) - 2) < 1e-10);
  assert.equal(sphereRadius(0, 800), 0.45);
  assert.equal(sphereRadius(900, 800), 1.65);
  assert.equal(sphereRadius(null, 800), 0.65);
  assert.equal(sphereRadius(NaN, 800), 0.65);
  assert.equal(sphereRadius(5, 0), 0.45);
});
test("sector enrichment is explicit, with Other fallback", () => {
  assert.equal(resolveSector(" technology "), "Technology");
  assert.equal(resolveSector("unknown"), "Other");
  assert.equal(resolveSector(null), "Other");
});
test("layout is deterministic, input-order independent and separated for 100 holdings", () => {
  const holdings = Array.from({ length: 100 }, (_, i) => ({ key: `ISIN${i}`, sector: "Other" as Sector }));
  const layout = layoutHoldings(holdings);
  assert.deepEqual(layout, layoutHoldings([...holdings].reverse()));
  assert.equal(layout.size, 100);
  const points = [...layout.values()];
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    assert.ok(Math.hypot(...points[i].map((value, axis) => value - points[j][axis])) > 3.3);
  }
  assert.ok(Number.isFinite(sceneBounds(points).radius));
  assert.deepEqual(holdings[0], { key: "ISIN0", sector: "Other" });
});
const holding = { securityKey: "ISIN/A", securityName: "Example", quantity: 4, marketValue: 400, investedCapital: 300, investmentGain: 100, priceDate: "2026-09-01" };
const input = { holdings: [holding], asOfDate: "2026-09-16", account: "Account", currencyReady: true, inventoryComplete: true };
test("view model projects existing metrics and preserves account links", () => {
  const result = universeModel({ ...input, portfolio: "account&1" });
  assert.equal(result.value, 400);
  assert.equal(result.holdings[0].weight, 100);
  assert.equal(result.holdings[0].costBasis, 300);
  assert.equal(result.holdings[0].unrealizedGain, 100);
  assert.equal(result.holdings[0].href, "/portfolio/ISIN%2FA?portfolio=account%261");
  assert.equal(contextHref("/dashboard"), "/dashboard");
});
test("missing price remains null, priced subset is disclosed, weights withheld", () => {
  const result = universeModel({ ...input, holdings: [holding, { ...holding, securityKey: "missing", marketValue: null, investmentGain: null }] });
  assert.equal(result.value, 400);
  assert.equal(result.complete, false);
  assert.equal(result.holdings[1].value, null);
  assert.equal(result.holdings[0].weight, null);
  assert.equal(result.warnings.length, 1);
  assert.equal(universeModel({ ...input, holdings: [{ ...holding, marketValue: null }] }).value, null);
});
test("FX and incomplete inventory never produce a misleading aggregate", () => {
  for (const flags of [{ currencyReady: false }, { inventoryComplete: false }]) {
    const result = universeModel({ ...input, ...flags });
    assert.equal(result.value, null);
    assert.equal(result.holdings[0].costBasis, null);
    assert.equal(result.holdings[0].unrealizedGain, null);
    assert.equal(result.complete, false);
  }
});
test("closed holdings excluded, empty valid account is zero, source is unchanged", () => {
  const original = structuredClone(input);
  assert.equal(universeModel({ ...input, holdings: [{ ...holding, quantity: 0 }] }).holdings.length, 0);
  assert.equal(universeModel({ ...input, holdings: [] }).value, 0);
  universeModel(input);
  assert.deepEqual(input, original);
});
test("presentation scaling preserves weights and geometry ratios", () => {
  const scaled = universeModel({ ...input, holdings: [{ ...holding, marketValue: 800, investedCapital: 600, investmentGain: 200, quantity: 8 }] });
  assert.equal(scaled.holdings[0].weight, universeModel(input).holdings[0].weight);
  assert.equal(sphereRadius(400, 800), sphereRadius(800, 1600));
});
