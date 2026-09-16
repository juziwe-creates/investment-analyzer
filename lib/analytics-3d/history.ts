import { buildInvestmentLedger, buildPortfolioTimeline, securityKey, type AnalyticsPrice, type AnalyticsTransaction } from "../analytics/engine";
import { universeModel, type UniverseHolding, type UniverseModel } from "./model";

type Identity = Pick<UniverseHolding, "key" | "name" | "monogram" | "sector" | "href">;
// Identities are transmitted once. Only open holdings occupy snapshot rows.
export type HoldingState = [index: number, quantity: number, value: number | null, weight: number | null, cost: number | null, gain: number | null, priceDate: string | null];
export type UniverseSnapshot = { date: string; states: HoldingState[]; value: number | null; complete: boolean; warnings: string[] };
export type DividendEvent = { id: string; date: string; key: string; amount: number | null };
export type UniverseHistory = { catalog: Identity[]; snapshots: UniverseSnapshot[]; dividends: DividendEvent[]; maxValue: number };

export function snapshotDates(transactions: AnalyticsTransaction[], prices: AnalyticsPrice[], today: string) {
  const dates = new Set(transactions.map((row) => row.trade_date).filter((date) => date <= today));
  if (!dates.size) return dates;
  const start = [...dates].sort()[0];
  const months = new Map<string, string>();
  for (const price of prices) {
    const date = price.price_date;
    if (date < start || date > today) continue;
    const month = date.slice(0, 7);
    if (date > (months.get(month) ?? "")) months.set(month, date);
  }
  for (const date of months.values()) dates.add(date);
  dates.add(today);
  return dates;
}

export function buildUniverseHistory(input: {
  transactions: AnalyticsTransaction[]; prices: AnalyticsPrice[]; today: string;
  portfolio?: string; currencyReady: boolean;
}): UniverseHistory {
  const transactions = input.transactions.filter((row) => row.trade_date <= input.today);
  const keys = new Set(transactions.map(securityKey));
  const prices = input.prices.filter((row) => keys.has(row.security_key) && row.price_date <= input.today && Number.isFinite(row.price) && row.price >= 0);
  const dates = snapshotDates(transactions, prices, input.today);
  const metadata = new Map(transactions.map((row) => [securityKey(row), { ticker: row.ticker }]));
  const ledger = buildInvestmentLedger(transactions);
  let ledgerIndex = 0, inventoryComplete = true;
  const history: UniverseHistory = { catalog: [], snapshots: [], dividends: [], maxValue: 0 };
  const indexes = new Map<string, number>();
  buildPortfolioTimeline(transactions, prices, {}, { dates, emit(date, holdings) {
    while (ledgerIndex < ledger.length && ledger[ledgerIndex].transaction.trade_date <= date) {
      inventoryComplete = ledger[ledgerIndex++].complete;
    }
    const model = universeModel({ holdings, asOfDate: date, account: "", portfolio: input.portfolio,
      currencyReady: input.currencyReady, inventoryComplete, metadata });
    const states: HoldingState[] = model.holdings.map((holding) => {
      let index = indexes.get(holding.key);
      if (index === undefined) {
        index = history.catalog.length;
        indexes.set(holding.key, index);
        const { key, name, monogram, sector, href } = holding;
        history.catalog.push({ key, name, monogram, sector, href });
      }
      history.maxValue = Math.max(history.maxValue, holding.value ?? 0);
      return [index, holding.quantity, holding.value, holding.weight, holding.costBasis, holding.unrealizedGain, holding.priceDate];
    });
    history.snapshots.push({ date, states, value: model.value, complete: model.complete, warnings: model.warnings });
  } });
  // Canonical received transactions only, using the same gross/net fallback as the ledger.
  history.dividends = ledger.filter((row) => row.dividend !== null).map(({ transaction, dividend }) => ({
    id: transaction.id, date: transaction.trade_date, key: securityKey(transaction),
    amount: input.currencyReady ? dividend!.cash : null
  }));
  return history;
}

export function snapshotModel(current: UniverseModel, history: UniverseHistory, index: number): UniverseModel {
  const snapshot = history.snapshots[index];
  if (!snapshot) return current;
  return { ...current, asOfDate: snapshot.date, value: snapshot.value, complete: snapshot.complete, warnings: snapshot.warnings,
    holdings: snapshot.states.map(([i, quantity, value, weight, costBasis, unrealizedGain, priceDate]) => ({
      ...history.catalog[i], quantity, value, weight, costBasis, unrealizedGain, priceDate
    })) };
}

export function dateTime(date: string) { return Date.parse(`${date}T00:00:00Z`); }

export function snapshotIndex(snapshots: UniverseSnapshot[], time: number) {
  let low = 0, high = snapshots.length - 1, found = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (dateTime(snapshots[mid].date) <= time) { found = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return found;
}

export function advancePlayback(time: number, deltaMs: number, start: number, end: number, speed: number) {
  return Math.min(end, time + Math.max(0, Math.min(deltaMs, 250)) / 30_000 * (end - start) * speed);
}

export type DividendBatch = { key: string; amount: number | null; count: number };
export function dividendBatches(events: DividendEvent[], from: number, to: number): DividendBatch[] {
  if (to <= from) return [];
  const batches = new Map<string, DividendBatch>();
  for (const event of events) {
    const time = dateTime(event.date);
    if (time <= from || time > to) continue;
    const batch = batches.get(event.key) ?? { key: event.key, amount: 0, count: 0 };
    batch.count++;
    batch.amount = batch.amount === null || event.amount === null ? null : batch.amount + event.amount;
    batches.set(event.key, batch);
  }
  return [...batches.values()];
}
