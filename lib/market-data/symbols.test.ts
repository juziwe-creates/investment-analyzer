import assert from "node:assert/strict";
import test from "node:test";
import { eodhdProviderSymbol, marketDataProviderSymbol } from "./symbols";

test("normalizes German EODHD symbols from common transaction tickers", () => {
  assert.equal(eodhdProviderSymbol("MUV2.DE", null), "MUV2.XETRA");
  assert.equal(eodhdProviderSymbol("MUV2.DEX", null), "MUV2.XETRA");
  assert.equal(eodhdProviderSymbol("MUV2", "XETRA"), "MUV2.XETRA");
});

test("keeps existing EODHD symbols and US suffixes stable", () => {
  assert.equal(eodhdProviderSymbol("MSFT.US", null), "MSFT.US");
  assert.equal(eodhdProviderSymbol("BRK.B", "US"), "BRK-B.US");
});

test("can prefer Xetra when securities are bought on German exchanges", () => {
  assert.equal(
    eodhdProviderSymbol("APD.NYSE", "NYSE", { preferredExchange: "XETRA" }),
    "APD.XETRA"
  );
  assert.equal(
    eodhdProviderSymbol("BRK.B", "US", { preferredExchange: "XETRA" }),
    "BRK-B.XETRA"
  );
});

test("uses known German EODHD symbols by ISIN before deriving a ticker", () => {
  assert.equal(
    marketDataProviderSymbol({
      providerId: "eodhd",
      isin: "US0091581068",
      ticker: "APD",
      exchange: "NYSE",
      preferGermanExchange: true
    }),
    "AP3.XETRA"
  );
  assert.equal(
    marketDataProviderSymbol({
      providerId: "eodhd",
      isin: "LU2611732475",
      ticker: "C005",
      exchange: "XETRA",
      preferGermanExchange: true
    }),
    "C005.XETRA"
  );
  assert.equal(
    marketDataProviderSymbol({
      providerId: "eodhd",
      isin: "US0231351067",
      ticker: "AMZN",
      exchange: "NASDAQ",
      preferGermanExchange: true
    }),
    "AMZ.XETRA"
  );
});
