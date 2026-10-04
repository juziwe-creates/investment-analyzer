import assert from "node:assert/strict";
import test from "node:test";
import { performanceLayout, portfolioLayout, sectorLayout, type LayoutInput } from "./layout";
import { buildPortfolioMapModel } from "./model";
import type { PortfolioHolding } from "../analytics/portfolio";
import type { LotProfitability } from "../analytics/profitability";
import type { BenchmarkView } from "../analytics/benchmark-portfolio";

test("portfolio layout is deterministic and does not overlap for 100 holdings", () => {
  const holdings: LayoutInput[] = Array.from({ length: 100 }, (_, index) => ({
    key: `security-${index}`, weight: 100 / 100, sector: "Unclassified", relativeReturn: index - 50
  }));
  const first = portfolioLayout(holdings);
  assert.equal(first.length, holdings.length);
  assert.deepEqual(first, portfolioLayout([...holdings].reverse()));
  for (let i = 0; i < first.length; i++) for (let j = i + 1; j < first.length; j++) {
    assert.ok(Math.hypot(first[i].x - first[j].x, first[i].y - first[j].y) >= first[i].radius + first[j].radius + 8);
  }
  assert.equal(sectorLayout(holdings).positions.length, holdings.length);
  assert.equal(performanceLayout(holdings).positions.length, holdings.length);
});

test("map projection reuses supplied financial results and withholds incomplete weights", () => {
  const holding = { securityKey: "DE0008404005", securityName: "Allianz", quantity: 2, investedCapital: 200,
    latestPrice: 120, priceDate: "2026-09-18", marketValue: 240, investmentGain: 40,
    dividendsReceived: 10, totalProfitability: 50, totalReturnPercent: 25,
    annualizedReturnPercent: 7, currency: "EUR" } satisfies PortfolioHolding;
  const lot = { id: "purchase-1", securityKey: holding.securityKey, securityName: holding.securityName,
    tradeDate: "2020-01-01", costBasis: 200, quantity: 2, remainingQuantity: 2,
    currentValue: 240, totalEconomicValue: 250, totalReturnPercent: 25, currency: "EUR" } as LotProfitability;
  const lotComparison = { id: lot.id, actual: { economicReferenceValue: 250 }, benchmark: { economicReferenceValue: 230, returnPercent: 15 },
    difference: { returnPercent: 10 }, reason: null } as BenchmarkView["lots"][number];
  const comparison = { label: "MSCI World", error: null, lots: [lotComparison],
    holdings: { [holding.securityKey]: { difference: { returnPercent: 8 }, reason: null } } } as unknown as BenchmarkView;
  const model = buildPortfolioMapModel({ holdings: [holding], lots: [lot], comparison, benchmarkId: "msci-world",
    tickerByKey: new Map([[holding.securityKey, "ALV.XETRA"]]) });
  assert.equal(model.totalValue, 240);
  assert.equal(model.holdings[0].weight, 100);
  assert.equal(model.holdings[0].relativeReturn, 8);
  assert.equal(model.holdings[0].lots[0].actualEconomicValue, 250);
  assert.equal(model.holdings[0].lots[0].benchmarkValue, 230);
  assert.equal(model.holdings[0].lots[0].returnDifference, 10);
  assert.equal(model.holdings[0].sector, "Unclassified");
  assert.equal(model.holdings[0].monogram, "ALV");

  const unpriced = buildPortfolioMapModel({ holdings: [holding, { ...holding, securityKey: "OTHER", marketValue: null }],
    lots: [lot], comparison, benchmarkId: "msci-world" });
  assert.equal(unpriced.totalValue, null);
  assert.ok(unpriced.holdings.every((row) => row.weight === null));
});
