import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { validatePrices, validateCoverage, parseSplits, benchmarkRows, canonicalSecurities, resolveBackfillSymbol } from "./market-backfill.mjs";

test("replacement rejects empty, invalid, duplicate and out-of-window history before deletes", () => {
  for (const rows of [[], [{ date: "2022-01-01", close: -1 }], [{ date: "2022-13-01", close: 100 }], [{ date: "2021-01-01", close: 100 }], [{ date: "2022-01-01", close: 1 }, { date: "2022-01-01", close: 2 }]]) {
    assert.throws(() => validatePrices(rows, "2022-01-01", "2022-12-31"));
  }
});
test("split payload preserves forward and reverse ratios, flags spin-off adjustments", () => {
  assert.deepEqual(parseSplits([{ date: "2022-07-18", split: "20.000000/1.000000" }], "2022-01-01", "2022-12-31"), [{ split_date: "2022-07-18", numerator: 20, denominator: 1 }]);
  assert.throws(() => parseSplits([{ date: "2022-07-18", split: "1281/1000" }], "2022-01-01", "2022-12-31"), /review/);
});
test("truncated history and price jumps without matching corporate actions cannot replace existing rows", () => {
  const prices = [{ date: "2022-07-15", close: 2000 }, { date: "2022-07-18", close: 100 }];
  assert.throws(() => validateCoverage(prices, [], "2022-07-15", "2022-07-18"), /review/);
  assert.throws(() => validateCoverage(prices, [], "2010-01-01", "2022-07-18"), /cover/);
  assert.doesNotThrow(() => validateCoverage(prices, [{ split_date: "2022-07-18", numerator: 20, denominator: 1 }], "2022-07-15", "2022-07-18"));
});
test("benchmark conversion uses dated FX without future rates or assumed dividend reinvestment", () => {
  const config = { id: "sp-500", symbol: "CONFIRMED.INDX", confirmed: true, sourceCurrency: "USD", seriesType: "price_index" };
  const rows = benchmarkRows(config, [{ date: "2022-01-03", close: 120 }], [{ date: "2021-12-31", close: 1.2 }, { date: "2022-01-04", close: 2 }]);
  assert.equal(rows[0].close_price, 100);
  assert.equal(rows[0].currency, "EUR");
  assert.equal(rows[0].series_type, "price_index");
  assert.equal(rows[0].is_derived, true);
  assert.throws(() => benchmarkRows(config, [{ date: "2022-01-03", close: 120 }], [{ date: "2022-01-04", close: 2 }]));
  assert.throws(() => benchmarkRows({ ...config, confirmed: false }, []));
});
test("replacement RPCs are owner scoped, atomic, admin only and preserve transactions", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261011000000_stock_splits_and_history_reload.sql", import.meta.url), "utf8");
  assert.match(sql, /Portfolio owner mismatch/);
  assert.match(sql, /create table if not exists public\.market_splits/);
  assert.match(sql, /drop policy if exists "Users can manage their stock splits"/);
  assert.match(sql, /create index if not exists market_splits_owner_date_idx/);
  assert.match(sql, /create or replace function public\.replace_security_market_history/);
  assert.match(sql, /create or replace function public\.replace_benchmark_history/);
  assert.match(sql, /i\.indisunique and i\.indisvalid/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /revoke all.*from public, anon, authenticated/);
  assert.match(sql, /Benchmark return methodology must match existing history/);
  assert.doesNotMatch(sql, /delete from public\.(transactions|transaction_components|benchmark_prices_import)/);
  assert.doesNotMatch(sql, /create table.*benchmark_prices/);
});

test("plan has one identity per security despite changing names and keeps original identities intact", () => {
  const source = [{ trade_date: "2022-01-01", created_at: "1", isin: "ISIN", security_name: "Old name", ticker: "OLD" },
    { trade_date: "2024-01-01", created_at: "2", isin: "ISIN", security_name: "New name", ticker: null }];
  const result = canonicalSecurities(source);
  assert.equal(result.length, 1);
  assert.equal(result[0].security_name, "New name");
  assert.equal(result[0].ticker, "OLD");
  assert.equal(source[0].security_name, "Old name");
});
test("mapping uses exact ISIN/currency catalogue matches and never treats US quotes as EUR", () => {
  const security = { isin: "US-ISIN" };
  const catalogue = [{ Code: "GERMAN", Exchange: "XETRA", Currency: "EUR", Isin: "US-ISIN", Type: "Common Stock" }];
  assert.equal(resolveBackfillSymbol(security, "INCORRECT.US", "INCORRECT.US", catalogue), "GERMAN.XETRA");
  assert.equal(resolveBackfillSymbol(security, null, "INCORRECT.US", []), null);
  assert.equal(resolveBackfillSymbol(security, null, "PRIOR.XETRA", []), "PRIOR.XETRA");
  assert.equal(resolveBackfillSymbol(security, null, "PRIOR.XETRA", [{ Code: "PRIOR", Exchange: "XETRA", Currency: "EUR", Isin: null }]), "PRIOR.XETRA");
  assert.equal(resolveBackfillSymbol(security, null, null, [...catalogue, { ...catalogue[0], Code: "AMBIGUOUS" }]), null);
  assert.equal(resolveBackfillSymbol(security, null, null, [{ ...catalogue[0], Exchange: "F" }]), "GERMAN.F");
  assert.equal(resolveBackfillSymbol(security, null, null, [...catalogue, { ...catalogue[0], Exchange: "F" }]), "GERMAN.XETRA");
});
