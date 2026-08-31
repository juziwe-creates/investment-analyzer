import assert from "node:assert/strict";
import test from "node:test";
import { eodhdProviderSymbol } from "./symbols";

test("normalizes German EODHD symbols from common transaction tickers", () => {
  assert.equal(eodhdProviderSymbol("MUV2.DE", null), "MUV2.XETRA");
  assert.equal(eodhdProviderSymbol("MUV2.DEX", null), "MUV2.XETRA");
  assert.equal(eodhdProviderSymbol("MUV2", "XETRA"), "MUV2.XETRA");
});

test("keeps existing EODHD symbols and US suffixes stable", () => {
  assert.equal(eodhdProviderSymbol("MSFT.US", null), "MSFT.US");
  assert.equal(eodhdProviderSymbol("BRK.B", "US"), "BRK-B.US");
});
