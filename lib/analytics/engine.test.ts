import assert from "node:assert/strict";
import test from "node:test";
import {
  acquisitionCost,
  buildPortfolioTimeline,
  calculateLifetimeDeployedCapital,
  calculatePurchaseLots,
  saleProceeds,
  type AnalyticsPrice,
  type AnalyticsTransaction
} from "./engine";

const baseTransaction: Omit<AnalyticsTransaction, "id" | "type" | "trade_date"> = {
  security_name: "Example AG",
  isin: "EX0000000001",
  wkn: "EX001",
  ticker: "EXA",
  quantity: null,
  unit_price: null,
  gross_amount: null,
  net_amount: null,
  currency: "EUR",
  created_at: "2020-01-01T00:00:00.000Z"
};

function transaction(
  overrides: Partial<AnalyticsTransaction> &
    Pick<AnalyticsTransaction, "id" | "type" | "trade_date">
): AnalyticsTransaction {
  return {
    ...baseTransaction,
    ...overrides,
    created_at: overrides.created_at ?? `${overrides.trade_date}T00:00:00.000Z`
  };
}

function price(overrides: Partial<AnalyticsPrice> = {}): AnalyticsPrice {
  return {
    security_key: "EX0000000001",
    price: 150,
    price_date: "2024-01-01",
    currency: "EUR",
    source: "market",
    ...overrides
  };
}

function assertClose(actual: number | null, expected: number, message?: string) {
  assert.notEqual(actual, null, message);
  assert.ok(Math.abs((actual ?? 0) - expected) < 0.000001, message);
}

test("calculates open-lot value, dividends, and total return", () => {
  const lots = calculatePurchaseLots(
    [
      transaction({
        id: "buy-1",
        type: "buy",
        trade_date: "2020-01-01",
        quantity: 10,
        unit_price: 100,
        gross_amount: 1000
      }),
      transaction({
        id: "dividend-1",
        type: "dividend",
        trade_date: "2021-01-01",
        gross_amount: 180
      })
    ],
    [price()]
  );

  assert.equal(lots.length, 1);
  assert.equal(lots[0].remainingQuantity, 10);
  assert.equal(lots[0].remainingAcquisitionCost, 1000);
  assert.equal(lots[0].currentRemainingValue, 1500);
  assert.equal(lots[0].attributedDividends, 180);
  assert.equal(lots[0].totalGain, 680);
  assert.equal(lots[0].totalReturnPercent, 68);
  assert.equal(lots[0].annualizedReturnStatus, "valid");
});

test("allocates partial sell proceeds to the oldest open lot using FIFO", () => {
  const lots = calculatePurchaseLots(
    [
      transaction({
        id: "buy-1",
        type: "buy",
        trade_date: "2020-01-01",
        quantity: 10,
        gross_amount: 1000
      }),
      transaction({
        id: "buy-2",
        type: "buy",
        trade_date: "2020-02-01",
        quantity: 10,
        gross_amount: 2000
      }),
      transaction({
        id: "sell-1",
        type: "sell",
        trade_date: "2021-01-01",
        quantity: 12,
        gross_amount: 1800
      })
    ],
    [price({ price: 120 })]
  );

  assert.equal(lots[0].remainingQuantity, 0);
  assert.equal(lots[0].status, "closed");
  assert.equal(lots[0].attributedSaleProceeds, 1500);
  assert.equal(lots[1].remainingQuantity, 8);
  assert.equal(lots[1].status, "partial");
  assert.equal(lots[1].attributedSaleProceeds, 300);
  assert.equal(lots[1].remainingAcquisitionCost, 1600);
  assert.equal(lots[1].currentRemainingValue, 960);
});

test("computes closed-lot profitability without requiring a current price", () => {
  const lots = calculatePurchaseLots([
    transaction({
      id: "buy-1",
      type: "buy",
      trade_date: "2020-01-01",
      quantity: 10,
      gross_amount: 1000
    }),
    transaction({
      id: "dividend-1",
      type: "dividend",
      trade_date: "2020-06-01",
      gross_amount: 100
    }),
    transaction({
      id: "sell-1",
      type: "sell",
      trade_date: "2021-01-01",
      quantity: 10,
      gross_amount: 1300
    })
  ]);

  assert.equal(lots[0].status, "closed");
  assert.equal(lots[0].currentRemainingValue, 0);
  assert.equal(lots[0].totalGain, 400);
  assert.equal(lots[0].totalReturnPercent, 40);
  assert.equal(lots[0].annualizedReturnStatus, "valid");
});

test("attributes dividends across eligible open lots by held quantity", () => {
  const lots = calculatePurchaseLots([
    transaction({
      id: "buy-1",
      type: "buy",
      trade_date: "2020-01-01",
      quantity: 10,
      gross_amount: 1000
    }),
    transaction({
      id: "buy-2",
      type: "buy",
      trade_date: "2020-02-01",
      quantity: 30,
      gross_amount: 3000
    }),
    transaction({
      id: "dividend-1",
      type: "dividend",
      trade_date: "2020-03-01",
      gross_amount: 80
    })
  ]);

  assert.equal(lots[0].attributedDividends, 20);
  assert.equal(lots[1].attributedDividends, 60);
});

test("does not attribute dividends to lots closed before the dividend date", () => {
  const lots = calculatePurchaseLots([
    transaction({
      id: "buy-1",
      type: "buy",
      trade_date: "2020-01-01",
      quantity: 10,
      gross_amount: 1000
    }),
    transaction({
      id: "sell-1",
      type: "sell",
      trade_date: "2020-02-01",
      quantity: 10,
      gross_amount: 1000
    }),
    transaction({
      id: "dividend-1",
      type: "dividend",
      trade_date: "2020-03-01",
      gross_amount: 50
    })
  ]);

  assert.equal(lots[0].attributedDividends, 0);
});

test("does not carry prices backward before their first observation", () => {
  const lots = calculatePurchaseLots(
    [
      transaction({
        id: "buy-1",
        type: "buy",
        trade_date: "2020-01-01",
        quantity: 10,
        gross_amount: 1000
      })
    ],
    [price({ price_date: "2021-01-01", price: 120 })],
    "2020-06-01"
  );

  assert.equal(lots[0].currentRemainingValue, null);
  assert.equal(lots[0].currentMarketPrice, null);
});

test("shows missing historical prices without turning unpriced holdings into losses", () => {
  const timeline = buildPortfolioTimeline(
    [
      transaction({
        id: "buy-1",
        type: "buy",
        trade_date: "2020-01-01",
        quantity: 10,
        gross_amount: 1000
      })
    ],
    [price({ price_date: "2021-01-01", price: 120 })]
  );

  assert.equal(timeline[0].date, "2020-01-01");
  assert.equal(timeline[0].currentDeployedCapital, 1000);
  assert.equal(timeline[0].pricedCurrentDeployedCapital, 0);
  assert.equal(timeline[0].portfolioMarketValue, 0);
  assert.equal(timeline[0].unrealizedGain, 0);
  assert.equal(timeline[0].hasCompletePricing, false);
  assert.deepEqual(timeline[0].missingPriceSecurityKeys, ["EX0000000001"]);
  assert.equal(timeline[1].date, "2021-01-01");
  assert.equal(timeline[1].hasCompletePricing, true);
  assert.equal(timeline[1].portfolioMarketValue, 1200);
  assert.equal(timeline[1].unrealizedGain, 200);
});

test("includes buy and sell fees in acquisition cost and sale proceeds", () => {
  const buy = transaction({
    id: "buy-1",
    type: "buy",
    trade_date: "2020-01-01",
    quantity: 10,
    gross_amount: 1000,
    components: [{ component_type: "fee", amount: 10, currency: "EUR" }]
  });
  const sell = transaction({
    id: "sell-1",
    type: "sell",
    trade_date: "2020-02-01",
    quantity: 5,
    gross_amount: 500,
    components: [{ component_type: "broker_fee", amount: 5, currency: "EUR" }]
  });

  assert.equal(acquisitionCost(buy), 1010);
  assert.equal(saleProceeds(sell), 495);
});

test("keeps lifetime deployed capital independent from sells", () => {
  const transactions = [
    transaction({
      id: "buy-1",
      type: "buy",
      trade_date: "2020-01-01",
      quantity: 10,
      gross_amount: 1000
    }),
    transaction({
      id: "sell-1",
      type: "sell",
      trade_date: "2020-02-01",
      quantity: 10,
      gross_amount: 1100
    })
  ];

  assertClose(calculateLifetimeDeployedCapital(transactions), 1000);
});
