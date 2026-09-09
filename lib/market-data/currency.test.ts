import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCorrectedMarketDataCurrency,
  marketDataCurrency
} from "./currency";

test("treats EODHD German exchange prices as EUR", () => {
  assert.equal(
    marketDataCurrency({
      fallbackCurrency: "DKK",
      providerId: "eodhd",
      providerSymbol: "NOV.XETRA"
    }),
    "EUR"
  );
  assert.equal(
    marketDataCurrency({
      fallbackCurrency: "USD",
      providerId: "eodhd",
      providerSymbol: "AAPL.F"
    }),
    "EUR"
  );
});

test("keeps non-German market data currency unchanged", () => {
  assert.equal(
    marketDataCurrency({
      fallbackCurrency: "USD",
      providerId: "other-provider",
      providerSymbol: "AAPL.US"
    }),
    "USD"
  );
});

test("treats configured provider labels as EUR even for non-German symbols", () => {
  assert.equal(
    marketDataCurrency({
      fallbackCurrency: "USD",
      providerId: "eodhd",
      providerSymbol: "AAPL.US"
    }),
    "EUR"
  );
  assert.equal(
    marketDataCurrency({
      fallbackCurrency: "DKK",
      providerId: "alpha_vantage",
      providerSymbol: "NOV"
    }),
    "EUR"
  );
});

test("reports when market data currency was corrected", () => {
  assert.equal(
    hasCorrectedMarketDataCurrency({
      fallbackCurrency: "DKK",
      providerId: "eodhd",
      providerSymbol: "NOV.XETRA"
    }),
    true
  );
});
