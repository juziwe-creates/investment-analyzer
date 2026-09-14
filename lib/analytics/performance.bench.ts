import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { buildPortfolioTimeline, calculatePurchaseLots, type AnalyticsPrice, type AnalyticsTransaction } from "./engine";

const large = process.argv.includes("--large");
const securities = large ? 200 : 20;
const days = large ? 5000 : 1100;
const date = (day: number) => new Date(Date.UTC(2010, 0, 1 + day)).toISOString().slice(0, 10);
const transactions: AnalyticsTransaction[] = [];
const prices: AnalyticsPrice[] = [];
for (let security = 0; security < securities; security++) {
  const key = `TEST${security}`;
  for (let day = 0; day < days; day++) {
    if (day % 120 === 0 || day % 365 === 364) {
      const type = day % 120 === 0 ? "buy" : "dividend";
      transactions.push({ id: `${key}-${day}`, type, trade_date: date(day), security_name: key,
        isin: key, ticker: key, quantity: 10, unit_price: type === "buy" ? 100 : 1,
        gross_amount: type === "buy" ? 1000 : 10, net_amount: null, currency: "EUR", created_at: `${date(day)}T00:00:00Z` });
    }
    prices.push({ security_key: key, price_date: date(day), price: 100 + day / 10 + security, currency: "EUR" });
  }
}
const started = performance.now();
const timeline = buildPortfolioTimeline(transactions, prices);
const timelineMs = performance.now() - started;
const latestDate = date(days - 1);
const latestPrices = prices.filter((price) => price.price_date === latestDate);
const currentStart = performance.now();
const lots = calculatePurchaseLots(transactions, latestPrices);
console.log(JSON.stringify({ securities, days, transactions: transactions.length, prices: prices.length,
  timelineMs: Math.round(timelineMs), currentLotsMs: Math.round(performance.now() - currentStart), lots: lots.length,
  checksum: createHash("sha256").update(JSON.stringify(timeline)).digest("hex"), points: timeline.length,
  lastValue: timeline.at(-1)?.portfolioMarketValue }));
