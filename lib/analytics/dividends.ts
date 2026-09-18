import { buildInvestmentLedger, securityKey, type AnalyticsTransaction, type LotCalculationOptions } from "./engine";

const DAY = 86_400_000;
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);
export type AnnualPersonalDividendYield = { date: string; year: number; ytd: boolean; grossDividends: number | null; averageCost: number | null; yieldPercent: number | null; reason: string | null; currency: string };
export type PersonalDividendEvent = { id: string; date: string; currency: string; gross: number | null; net: number | null; cash: number | null; eligibleShares: number | null; perShare: number | null; cumulative: number | null; yearToDateCash: number | null; activeCost: number | null; yieldPercent: number | null };

export function cumulativeDividendHistory(events: PersonalDividendEvent[], startDate?: string) {
  const byDate = new Map<string, number | null>();
  if (startDate && events.length && startDate < events[0].date) byDate.set(startDate, 0);
  for (const event of events) byDate.set(event.date, event.cumulative);
  return [...byDate].map(([date, value]) => ({ date, value }));
}

export function investmentDividendEvents(transactions: AnalyticsTransaction[], options: LotCalculationOptions = {}): PersonalDividendEvent[] {
  const sameCurrency = new Set(transactions.map((row) => row.currency)).size <= 1;
  let cumulative: number | null = 0;
  let year = "", yearToDateCash: number | null = 0;
  return buildInvestmentLedger(transactions, options).flatMap(({ transaction, dividend, activeCost, complete }) => {
    if (!dividend) return [];
    if (year !== transaction.trade_date.slice(0, 4)) { year = transaction.trade_date.slice(0, 4); yearToDateCash = 0; }
    yearToDateCash = yearToDateCash === null || dividend.cash === null ? null : yearToDateCash + dividend.cash;
    cumulative = cumulative === null || dividend.cash === null ? null : cumulative + dividend.cash;
    return [{ id: transaction.id, date: transaction.trade_date, currency: transaction.currency, ...dividend,
      perShare: sameCurrency && dividend.gross !== null && dividend.eligibleShares !== null && dividend.eligibleShares > 0 ? dividend.gross / dividend.eligibleShares : null,
      cumulative: sameCurrency ? cumulative : null,
      yearToDateCash: sameCurrency ? yearToDateCash : null,
      activeCost: sameCurrency && complete ? activeCost : null,
      yieldPercent: sameCurrency && complete && activeCost > 0 && yearToDateCash !== null ? yearToDateCash / activeCost * 100 : null }];
  });
}

export type YieldOnCost = { year: number; dividendCash: number | null; activeCost: number | null; finalDividendDate: string | null; yieldPercent: number | null; reason: string | null };

// Investment-level metric only. Never average these percentages across investments.
export function calculateYieldOnCost(transactions: AnalyticsTransaction[], asOf: string, options: LotCalculationOptions = { lotMatchingMethod: "lifo" }): YieldOnCost {
  const year = Number(asOf.slice(0, 4)) - 1;
  const rows = transactions.filter((row) => row.trade_date <= `${year}-12-31`);
  const events = investmentDividendEvents(rows, options).filter((event) => event.date.startsWith(String(year)));
  const final = events.at(-1);
  const ledgerEnd = final ? null : buildInvestmentLedger(rows, options).at(-1);
  const activeCost = final ? final.activeCost : ledgerEnd?.complete ? ledgerEnd.activeCost : null;
  const cash = final ? final.yearToDateCash : 0;
  const mixed = new Set(rows.map((row) => row.currency)).size > 1;
  const multiple = new Set(rows.map(securityKey)).size > 1;
  const reason = multiple ? "Investment-level metric only" : mixed ? "Mixed currencies" : activeCost === null ? "Incomplete buy history" : activeCost <= 0 ? "No active acquisition cost" : cash === null ? "Dividend cash unavailable" : null;
  return { year, dividendCash: mixed ? null : cash, activeCost: mixed ? null : activeCost, finalDividendDate: final?.date ?? null,
    yieldPercent: reason ? null : cash! / activeCost! * 100, reason };
}

export function investmentYieldsOnCost(transactions: AnalyticsTransaction[], asOf: string): Record<string, YieldOnCost> {
  const grouped = new Map<string, AnalyticsTransaction[]>();
  for (const row of transactions) { const key = securityKey(row); const group = grouped.get(key) ?? []; group.push(row); grouped.set(key, group); }
  return Object.fromEntries([...grouped].map(([key, rows]) => [key, calculateYieldOnCost(rows, asOf)]));
}

export function calculateAnnualPersonalDividendYield(transactions: AnalyticsTransaction[], asOf: string, options: LotCalculationOptions = {}): AnnualPersonalDividendYield[] {
  const ledger = buildInvestmentLedger(transactions.filter((row) => row.trade_date <= asOf), options);
  if (!ledger.length) return [];
  const finalYear = Number(asOf.slice(0, 4));
  const result: AnnualPersonalDividendYield[] = [];
  const currencies = new Set(transactions.filter((row) => row.trade_date <= asOf).map((row) => row.currency));
  let index = 0, basis = 0, complete = true;
  for (let year = Number(ledger[0].transaction.trade_date.slice(0, 4)); year <= finalYear; year++) {
    const start = Date.UTC(year, 0, 1), end = year === finalYear ? time(asOf) + DAY : Date.UTC(year + 1, 0, 1);
    let cursor = start, weighted = 0, gross = 0, hasGross = true, hasHistory = complete;
    while (index < ledger.length && time(ledger[index].transaction.trade_date) < end) {
      const row = ledger[index++], eventTime = time(row.transaction.trade_date);
      weighted += basis * (eventTime - cursor) / DAY;
      cursor = eventTime;
      basis = row.activeCost;
      complete = row.complete;
      hasHistory = hasHistory && complete;
      if (row.dividend) {
        if (row.dividend.gross === null) hasGross = false;
        else gross += row.dividend.gross;
      }
    }
    weighted += basis * (end - cursor) / DAY;
    const average = weighted / ((end - start) / DAY);
    const reason = currencies.size > 1 ? "Mixed currencies" : !hasHistory ? "Incomplete buy history" : !hasGross ? "Gross dividends unavailable" : average <= 0 ? "No active acquisition cost" : null;
    result.push({ date: new Date(end - DAY).toISOString().slice(0, 10), year, ytd: year === finalYear,
      grossDividends: hasGross && currencies.size === 1 ? gross : null, averageCost: hasHistory && currencies.size === 1 ? average : null,
      yieldPercent: reason ? null : gross / average * 100, reason, currency: ledger[0].transaction.currency });
  }
  return result;
}
