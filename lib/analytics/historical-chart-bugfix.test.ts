import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as engine from "./engine";
import { investmentHistory } from "./investment-history";
import { deduplicateMarketHistory } from "../market-data/history-dedupe";
import * as currency from "../market-data/currency";
import type { AnalyticsPrice, AnalyticsTransaction } from "./engine";
import type { MarketHistoryPrice } from "../../types/market-history";

type PortfolioPoint = {
  date: string;
  investedCapital: number;
  investmentGain: number | null;
  portfolioValue: number | null;
  pricedPortfolioValue: number | null;
  hasCompletePricing: boolean;
  saleProceedsReceived: number;
  economicValue: number | null;
  economicValueReason: string | null;
  cumulativePurchaseCosts: number;
  profitGenerated: number | null;
  missingPriceSecurities: string[];
};

const requireModule = createRequire(__filename);
const compiledPortfolio = ts.transpileModule(readFileSync("lib/analytics/portfolio.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const portfolioExports = {};
runInNewContext(compiledPortfolio, {
  exports: portfolioExports,
  require: (name: string) => ({
    "@/lib/analytics/engine": engine,
    "@/lib/analytics/profitability": {},
    "@/lib/market-data/currency": currency
  } as Record<string, unknown>)[name] ?? requireModule(name)
});
const { calculatePortfolioDevelopment } = portfolioExports as {
  calculatePortfolioDevelopment: (transactions: Record<string, unknown>[], prices: MarketHistoryPrice[], interval: "daily") => PortfolioPoint[];
};

function portfolioBuy(id: string, isin: string, quantity: number, grossAmount: number) {
  return {
    id,
    user_id: "user",
    portfolio_id: "portfolio",
    security_id: null,
    security_name: isin,
    isin,
    wkn: null,
    ticker: null,
    exchange: null,
    security_currency: "EUR",
    asset_type: "stock",
    type: "buy",
    trade_date: "2020-01-01",
    settlement_date: null,
    quantity,
    unit_price: grossAmount / quantity,
    gross_amount: grossAmount,
    net_amount: grossAmount,
    currency: "EUR",
    external_id: null,
    broker: null,
    source_document_id: null,
    import_run_id: null,
    notes: null,
    created_at: `2020-01-01T00:00:0${id}.000Z`,
    updated_at: "2020-01-01T00:00:00.000Z",
    components: []
  };
}

function marketPrice(id: string, securityKey: string, date: string, price: number, updatedAt = `${date}T00:00:00.000Z`): MarketHistoryPrice {
  return {
    id,
    security_key: securityKey,
    price_date: date,
    close_price: price,
    adjusted_close_price: null,
    currency: "EUR",
    provider: "test",
    provider_symbol: securityKey,
    updated_at: updatedAt
  };
}

test("portfolio development hides partial market value until every open holding is priced", () => {
  const transactions = [
    portfolioBuy("1", "SEC-A", 10, 1000),
    portfolioBuy("2", "SEC-B", 5, 500)
  ];
  const entirelyUnpriced = calculatePortfolioDevelopment(transactions, [], "daily");
  const points = calculatePortfolioDevelopment(transactions, [
    marketPrice("a-1", "SEC-A", "2020-01-01", 100),
    marketPrice("a-2", "SEC-A", "2020-02-01", 110),
    marketPrice("b-1", "SEC-B", "2020-02-01", 120)
  ], "daily");

  assert.equal(entirelyUnpriced[0].pricedPortfolioValue, null);
  assert.equal(points[0].hasCompletePricing, false);
  assert.equal(points[0].investedCapital, 1500);
  assert.equal(points[0].portfolioValue, null);
  assert.equal(points[0].investmentGain, null);
  assert.equal(points[0].pricedPortfolioValue, 1000);
  assert.notEqual(points[0].portfolioValue, 0);

  assert.equal(points[1].hasCompletePricing, true);
  assert.equal(points[1].portfolioValue, 1700);
  assert.equal(points[1].pricedPortfolioValue, 1700);
  assert.equal(points[1].investmentGain, 200);
});

test("investment detail uses deterministic shared history while preserving portfolio scoping elsewhere", () => {
  const history = deduplicateMarketHistory([
    marketPrice("older", "SEC-A", "2020-01-01", 100, "2020-01-02T00:00:00.000Z"),
    marketPrice("newer", "SEC-A", "2020-01-01", 101, "2020-01-03T00:00:00.000Z"),
    marketPrice("last", "SEC-A", "2020-02-01", 110, "2020-02-02T00:00:00.000Z")
  ]);
  const transaction: AnalyticsTransaction = {
    id: "buy",
    type: "buy",
    trade_date: "2020-01-01",
    security_name: "Security A",
    isin: "SEC-A",
    wkn: null,
    ticker: null,
    quantity: 2,
    unit_price: 100,
    gross_amount: 200,
    net_amount: 200,
    currency: "EUR",
    created_at: "2020-01-01T00:00:00.000Z"
  };
  const prices: AnalyticsPrice[] = history.map((row) => ({
    security_key: row.security_key,
    price_date: row.price_date,
    price: row.adjusted_close_price ?? row.close_price,
    currency: row.currency,
    source: "market",
    id: row.id
  }));
  const chart = investmentHistory([transaction], prices);

  assert.deepEqual(history.map((row) => [row.price_date, row.close_price]), [
    ["2020-01-01", 101],
    ["2020-02-01", 110]
  ]);
  assert.deepEqual([chart[0].date, chart[0].price, chart[0].positionValue], ["2020-01-01", 101, 202]);
  assert.deepEqual([chart.at(-1)?.date, chart.at(-1)?.price, chart.at(-1)?.positionValue], ["2020-02-01", 110, 220]);

  const page = readFileSync("app/(app)/portfolio/[securityKey]/page.tsx", "utf8");
  assert.match(page, /presentationTransactions\(portfolioId\)/);
  assert.match(page, /readMarketHistory\(undefined, securityKey\)/);
  assert.match(page, /if \(portfolioId\) \{ latestPricesQuery\.eq\("portfolio_id", portfolioId\); manualPricesQuery\.eq\("portfolio_id", portfolioId\); \}/);
});
test("investment history never backfills an open position before its first eligible price", () => {
  const transaction: AnalyticsTransaction = {
    id: "allianz-buy", type: "buy", trade_date: "2010-08-25", security_name: "Allianz",
    isin: "DE0008404005", wkn: "840400", ticker: null, quantity: 40,
    unit_price: 80, gross_amount: 3200, net_amount: 3200, currency: "EUR",
    created_at: "2010-08-25T00:00:00.000Z"
  };
  const history = investmentHistory([transaction], [
    { security_key: "DE0008404005", price_date: "2024-01-31", price: 250, currency: "EUR" }
  ]);
  assert.equal(history[0].positionValue, null);
  assert.equal(history[0].economicValue, null);
  assert.equal(history[1].positionValue, 10000);
  const withEarlierPrice = investmentHistory([transaction], [
    { security_key: "DE0008404005", price_date: "2010-08-25", price: 81, currency: "EUR" },
    { security_key: "DE0008404005", price_date: "2024-01-31", price: 250, currency: "EUR" }
  ]);
  assert.equal(withEarlierPrice[0].positionValue, 3240);
});

test("investment Economic Value adds dated dividends and exits without changing market value or deployed cost", () => {
  const transactions: AnalyticsTransaction[] = [
    { id: "buy", type: "buy", trade_date: "2020-01-01", security_name: "A", isin: "SEC-A", wkn: null, ticker: null, quantity: 10, unit_price: 100, gross_amount: 1000, net_amount: 1000, currency: "EUR", created_at: "2020-01-01T00:00:00.000Z" },
    { id: "dividend", type: "dividend", trade_date: "2020-02-01", security_name: "A", isin: "SEC-A", wkn: null, ticker: null, quantity: 10, unit_price: null, gross_amount: 100, net_amount: 100, currency: "EUR", created_at: "2020-02-01T00:00:00.000Z" },
    { id: "sell", type: "sell", trade_date: "2020-03-01", security_name: "A", isin: "SEC-A", wkn: null, ticker: null, quantity: 4, unit_price: 150, gross_amount: 600, net_amount: 600, currency: "EUR", created_at: "2020-03-01T00:00:00.000Z" }
  ];
  const chart = investmentHistory(transactions, [
    { security_key: "SEC-A", price_date: "2020-01-01", price: 100, currency: "EUR" },
    { security_key: "SEC-A", price_date: "2020-03-01", price: 120, currency: "EUR" }
  ]);
  const final = chart.at(-1)!;
  assert.equal(final.shares, 6);
  assert.equal(final.positionValue, 720);
  assert.equal(final.deployedCapital, 600);
  assert.equal(final.dividendsReceived, 100);
  assert.equal(final.saleProceedsReceived, 600);
  assert.equal(final.economicValue, 1420);
});

test("fully sold investments retain received dividends without accruing provider dividends", () => {
  const buy: AnalyticsTransaction = { id: "buy", type: "buy", trade_date: "2020-01-01", security_name: "A", isin: "SEC-A", wkn: null, ticker: null, quantity: 10, unit_price: 100, gross_amount: 1000, net_amount: 1000, currency: "EUR", created_at: "2020-01-01T00:00:00.000Z" };
  const chart = investmentHistory([
    buy,
    { ...buy, id: "dividend", type: "dividend", trade_date: "2020-02-01", gross_amount: 20, net_amount: 20 },
    { ...buy, id: "sell", type: "sell", trade_date: "2020-03-01", gross_amount: 1200, net_amount: 1200 },
  ], [
    { security_key: "SEC-A", price_date: "2020-01-01", price: 100, currency: "EUR" },
    { security_key: "SEC-A", price_date: "2020-03-01", price: 120, currency: "EUR" },
    { security_key: "SEC-A", price_date: "2021-03-01", price: 150, currency: "EUR" },
  ]);
  const closed = chart.filter((point) => point.date >= "2020-03-01");
  assert.ok(closed.every((point) => point.shares === 0 && point.positionValue === 0));
  assert.ok(closed.every((point) => point.dividendsReceived === 20 && point.economicValue === 1220));
});

test("portfolio Economic Value is withheld when realized cash may fund a later purchase", () => {
  const first = portfolioBuy("1", "SEC-A", 10, 1000);
  const sale = { ...portfolioBuy("2", "SEC-A", 10, 1200), type: "sell", trade_date: "2020-02-01", created_at: "2020-02-01T00:00:00.000Z" };
  const laterBuy = { ...portfolioBuy("3", "SEC-B", 5, 500), trade_date: "2020-03-01", created_at: "2020-03-01T00:00:00.000Z" };
  const blocked = calculatePortfolioDevelopment([first, sale, laterBuy], [marketPrice("b", "SEC-B", "2020-03-01", 100)], "daily");
  assert.ok(blocked.every((point) => point.economicValue === null));
  assert.match(blocked.at(-1)!.economicValueReason!, /funded later purchases/);

  const safe = calculatePortfolioDevelopment([first, sale], [marketPrice("a", "SEC-A", "2020-01-01", 100)], "daily");
  assert.equal(safe.at(-1)!.saleProceedsReceived, 1200);
  assert.equal(safe.at(-1)!.economicValue, 1200);
  assert.equal(safe.at(-1)!.economicValueReason, null);
});

test("profit generated counts reinvestment purchases once and is available despite funding ambiguity", () => {
  const first = portfolioBuy("1", "SEC-A", 20, 2000);
  const dividend = { ...first, id: "2", type: "dividend", trade_date: "2020-02-01", gross_amount: 120, net_amount: 120 };
  const reinvest = { ...portfolioBuy("3", "SEC-A", 360 / 110, 360), trade_date: "2020-03-01" };
  const rows = [first, dividend, reinvest];
  const prices = [marketPrice("a", "SEC-A", "2020-01-01", 100), marketPrice("b", "SEC-A", "2020-03-01", 110)];
  const final = calculatePortfolioDevelopment(rows, prices, "daily").at(-1)!;
  assert.equal(final.economicValue, null);
  assert.equal(final.cumulativePurchaseCosts, 2360);
  assert.equal(final.portfolioValue, 2560);
  assert.equal(final.profitGenerated, 320);
  const investment = investmentHistory(rows as unknown as AnalyticsTransaction[], prices.map((p) => ({ security_key: p.security_key, price_date: p.price_date, price: p.close_price, currency: p.currency }))).at(-1)!;
  assert.equal(investment.profitGenerated, final.profitGenerated);
});

test("profit generated retains closed-position profit, losses and complete historical purchase costs", () => {
  const buy = portfolioBuy("1", "SEC-A", 10, 1000);
  const dividend = { ...buy, id: "2", type: "dividend", trade_date: "2020-02-01", gross_amount: 20 };
  const partial = { ...buy, id: "3", type: "sell", trade_date: "2020-03-01", quantity: 4, gross_amount: 600 };
  const prices = [marketPrice("a", "SEC-A", "2020-01-01", 100), marketPrice("b", "SEC-A", "2020-03-01", 120)];
  const chart = calculatePortfolioDevelopment([buy, dividend, partial], prices, "daily");
  assert.equal(chart.at(-1)?.profitGenerated, 340);
  assert.equal(chart.at(-1)?.cumulativePurchaseCosts, 1000);
  const close = { ...partial, id: "4", trade_date: "2020-04-01", quantity: 6, gross_amount: 300 };
  const closed = calculatePortfolioDevelopment([buy, dividend, partial, close], prices, "daily").at(-1)!;
  assert.equal(closed.portfolioValue, 0);
  assert.equal(closed.profitGenerated, -80);
  assert.equal(calculatePortfolioDevelopment([buy], [], "daily")[0].profitGenerated, null);
});

test("an unpriced acquisition interrupts profit until its price arrives and names the missing holding", () => {
  const first = { ...portfolioBuy("1", "SEC-A", 10, 1000), trade_date: "2011-01-01" };
  const missing = { ...portfolioBuy("2", "SEC-B", 25, 2000), security_name: "Historical Linde", trade_date: "2011-08-10" };
  const points = calculatePortfolioDevelopment([first, missing], [
    marketPrice("a", "SEC-A", "2011-01-01", 100),
    marketPrice("b", "SEC-B", "2011-09-01", 80),
  ], "daily");
  const gap = points.find((point) => !point.hasCompletePricing)!;
  assert.equal(gap.date, "2011-08-10");
  assert.equal(gap.profitGenerated, null);
  assert.equal(gap.missingPriceSecurities.join(", "), "Historical Linde (SEC-B)");
  assert.equal(points[0].profitGenerated, 0);
  assert.equal(points.at(-1)?.profitGenerated, 0);
});
