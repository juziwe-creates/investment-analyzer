import { calculateXirr, type LotCashFlow, type LotMatchingMethod } from "./engine";
import { benchmarkOptions, type BenchmarkId, type BenchmarkObservation } from "./benchmarks";
import type { LotProfitability } from "./profitability";

export type ComparisonMetrics = {
  deployed: number; remainingCapital: number; currentValue: number | null;
  referenceValue: number | null; gain: number | null; returnPercent: number | null;
  annualizedPercent: number | null;
};
export type BenchmarkExitTrace = {
  transactionId: string; actualSaleDate: string; fractionClosed: number;
  benchmarkObservationDate: string | null; benchmarkLevel: number | null;
  benchmarkUnitsClosed: number | null; benchmarkProceeds: number | null;
};
export type BenchmarkCalculationTrace = {
  sourceTransactionId: string; security: string; purchaseDate: string; quantity: number;
  actualPurchasePrice: number | null; acquisitionCost: number;
  benchmarkId: BenchmarkId; benchmarkSeriesType: string | null; benchmarkFrequency: string | null;
  benchmarkEntryObservationDate: string | null; benchmarkEntryLagDays: number | null;
  benchmarkEntryLevel: number | null; virtualBenchmarkUnitsPurchased: number | null;
  exits: BenchmarkExitTrace[]; valuationDate: string | null;
  benchmarkValuationObservationDate: string | null; benchmarkValuationLevel: number | null;
  remainingVirtualBenchmarkUnits: number | null; counterfactualReferenceValue: number | null;
  actualTotalReturnPercent: number | null; benchmarkTotalReturnPercent: number | null;
  returnDifferencePercentPoints: number | null; actualAnnualizedPercent: number | null;
  benchmarkAnnualizedPercent: number | null; annualizedDifferencePercentPoints: number | null;
};
export type DecisionComparison = {
  id: string; securityKey: string; name: string; buyDate: string; currency: string;
  actual: ComparisonMetrics; benchmark: ComparisonMetrics;
  difference: { value: number | null; currentValue: number | null; referenceValue: number | null; gain: number | null; returnPercent: number | null; annualizedPercent: number | null };
  reason: string | null; valuationDate: string | null; observationDate: string | null;
  trace: BenchmarkCalculationTrace;
};
export type VirtualBenchmarkLot = {
  sourceBuyTransactionId: string; sourceSecurityKey: string; buyDate: string;
  originalCapital: number; remainingCapital: number; benchmarkId: BenchmarkId;
  benchmarkEntryLevel: number | null; originalBenchmarkUnits: number | null; remainingBenchmarkUnits: number | null;
  closedBenchmarkValue: number | null; closeDate: string | null; cashFlows: LotCashFlow[];
  exits: { date: string; transactionId: string; observationDate: string | null; level: number | null; units: number | null; value: number | null; fraction: number }[];
};
export type BenchmarkTimelinePoint = { date: string; value: number | null; missingLots: number; observationDate: string | null };
export type BenchmarkComparison = {
  benchmarkId: BenchmarkId; label: string; description: string; matching: LotMatchingMethod;
  lots: DecisionComparison[]; holdings: Record<string, DecisionComparison>;
  virtualLots: VirtualBenchmarkLot[]; missingLots: number; error: string | null;
};
export type BenchmarkView = Omit<BenchmarkComparison, "virtualLots">;
export function benchmarkView(comparison: BenchmarkComparison): BenchmarkView {
  const { virtualLots: _virtualLots, ...view } = comparison;
  void _virtualLots;
  return view;
}

function prepareHistory(history: BenchmarkObservation[], id: BenchmarkId) {
  if (!benchmarkOptions.some((option) => option.id === id)) return [];
  const rows = history.filter((row) => row.benchmark_id === id);
  if (rows.some((row) => row.currency !== "EUR") || new Set(rows.map((row) => row.series_type)).size > 1) return [];
  return rows.filter((row) => Number.isFinite(Number(row.close_price)) && Number(row.close_price) > 0)
    .sort((a, b) => a.price_date.localeCompare(b.price_date));
}

// A period-end level is usable only after both its period and source dates.
export function benchmarkLevelAtDate(history: BenchmarkObservation[], date: string): BenchmarkObservation | null {
  let low = 0, high = history.length;
  while (low < high) { const mid = (low + high) >>> 1; if (history[mid].price_date <= date) low = mid + 1; else high = mid; }
  for (let i = low - 1; i >= 0; i--) if (history[i].observation_date <= date) return history[i];
  return null;
}

function subtract(actual: number | null, benchmark: number | null) {
  return actual === null || benchmark === null ? null : actual - benchmark;
}
function differences(actual: ComparisonMetrics, benchmark: ComparisonMetrics, holding = false) {
  return { value: subtract(holding ? actual.currentValue : actual.referenceValue, holding ? benchmark.currentValue : benchmark.referenceValue),
    currentValue: subtract(actual.currentValue, benchmark.currentValue), referenceValue: subtract(actual.referenceValue, benchmark.referenceValue), gain: subtract(actual.gain, benchmark.gain),
    returnPercent: subtract(actual.returnPercent, benchmark.returnPercent), annualizedPercent: subtract(actual.annualizedPercent, benchmark.annualizedPercent) };
}
function metrics(deployed: number, remainingCapital: number, currentValue: number | null, proceeds: number | null, flows: LotCashFlow[], dividends = 0): ComparisonMetrics {
  const referenceValue = currentValue === null || proceeds === null ? null : currentValue + proceeds;
  const gain = referenceValue === null ? null : referenceValue + dividends - deployed;
  return { deployed, remainingCapital, currentValue, referenceValue, gain,
    returnPercent: gain === null || deployed <= 0 ? null : gain / deployed * 100,
    annualizedPercent: referenceValue === null ? null : calculateXirr(flows).value };
}
function total(values: (number | null)[]) { return values.some((value) => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0); }
function calendarDaysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function buildBenchmarkComparison(
  source: LotProfitability[], history: BenchmarkObservation[], id: BenchmarkId, matching: LotMatchingMethod
): BenchmarkComparison {
  const levels = prepareHistory(history, id);
  const label = benchmarkOptions.find((option) => option.id === id)?.label ?? "Benchmark";
  const kind = levels[0]?.series_type;
  const description = kind === "net_total_return" ? "Net total return; dividends included"
    : kind === "performance_index" || kind === "total_return" || kind === "gross_total_return" ? "Total return; dividends included"
    : kind === "price_index" || kind === "price" ? "Price index; dividends excluded" : kind ? `Series type: ${kind}` : "History unavailable";
  const virtualLots: VirtualBenchmarkLot[] = [];
  const lots = source.map((lot): DecisionComparison => {
    const entry = benchmarkLevelAtDate(levels, lot.tradeDate);
    const lastExit = lot.saleAllocations.at(-1)?.date ?? null;
    const valuationDate = lot.remainingQuantity > 0 ? lot.priceDate : lastExit;
    let reason = lot.currency !== "EUR" ? "EUR valuation required."
      : !entry ? "No benchmark observation on or before purchase."
      : !(lot.quantity > 0 && lot.costBasis > 0) ? "Positive purchase quantity and cost required."
      : !valuationDate || valuationDate < lot.tradeDate || (lastExit && valuationDate < lastExit) ? "A valuation date on or after the latest decision is required." : null;
    const units = entry && lot.currency === "EUR" && lot.quantity > 0 && lot.costBasis > 0 ? lot.costBasis / Number(entry.close_price) : null;
    const exits = lot.saleAllocations.map((sale) => {
      const level = benchmarkLevelAtDate(levels, sale.date);
      const fraction = sale.quantity / lot.quantity;
      const closedUnits = units === null ? null : units * fraction;
      return { date: sale.date, transactionId: sale.transactionId, observationDate: level?.observation_date ?? null,
        level: level ? Number(level.close_price) : null, units: closedUnits, fraction,
        value: closedUnits === null || !level ? null : closedUnits * Number(level.close_price) };
    });
    const remainingUnits = units === null ? null : units * lot.remainingQuantity / lot.quantity;
    const current = valuationDate ? benchmarkLevelAtDate(levels, valuationDate) : null;
    const currentValue = lot.remainingQuantity <= 0 ? 0 : remainingUnits === null || !current ? null : remainingUnits * Number(current.close_price);
    const proceeds = total(exits.map((sale) => sale.value));
    if (!reason && (currentValue === null || proceeds === null)) reason = "Benchmark valuation history is incomplete.";
    const flows: LotCashFlow[] = [{ date: lot.tradeDate, amount: -lot.costBasis, kind: "buy", transactionId: lot.id },
      ...exits.flatMap((sale, index) => sale.value === null ? [] : [{ date: sale.date, amount: sale.value, kind: "sell" as const, transactionId: lot.saleAllocations[index].transactionId }]),
      ...(lot.remainingQuantity > 0 && currentValue !== null && valuationDate ? [{ date: valuationDate, amount: currentValue, kind: "terminal_value" as const }] : [])];
    virtualLots.push({ sourceBuyTransactionId: lot.id, sourceSecurityKey: lot.securityKey, buyDate: lot.tradeDate,
      originalCapital: lot.costBasis, remainingCapital: lot.remainingCostBasis, benchmarkId: id, benchmarkEntryLevel: entry ? Number(entry.close_price) : null,
      originalBenchmarkUnits: units, remainingBenchmarkUnits: remainingUnits, closedBenchmarkValue: proceeds,
      closeDate: lot.remainingQuantity <= 0 ? lastExit : null, cashFlows: flows, exits });
    const actual: ComparisonMetrics = { deployed: lot.costBasis, remainingCapital: lot.remainingCostBasis, currentValue: lot.currentValue,
      referenceValue: lot.currentValue === null ? null : lot.currentValue + lot.attributedSaleProceeds,
      gain: lot.totalProfitability, returnPercent: lot.totalReturnPercent,
      annualizedPercent: lot.currentValue === null && lot.remainingQuantity > 0 ? null : lot.annualizedReturnPercent };
    const benchmark = metrics(lot.costBasis, lot.remainingCostBasis, reason ? null : currentValue, reason ? null : proceeds, flows);
    const difference = differences(actual, benchmark);
    const trace: BenchmarkCalculationTrace = {
      sourceTransactionId: lot.id, security: lot.securityName, purchaseDate: lot.tradeDate, quantity: lot.quantity,
      actualPurchasePrice: lot.actualPurchasePrice, acquisitionCost: lot.costBasis, benchmarkId: id,
      benchmarkSeriesType: entry?.series_type ?? kind ?? null, benchmarkFrequency: entry?.frequency ?? levels[0]?.frequency ?? null,
      benchmarkEntryObservationDate: entry?.observation_date ?? null,
      benchmarkEntryLagDays: entry ? calendarDaysBetween(entry.observation_date, lot.tradeDate) : null,
      benchmarkEntryLevel: entry ? Number(entry.close_price) : null, virtualBenchmarkUnitsPurchased: units,
      exits: exits.map((sale) => ({ transactionId: sale.transactionId, actualSaleDate: sale.date,
        fractionClosed: sale.fraction, benchmarkObservationDate: sale.observationDate,
        benchmarkLevel: sale.level, benchmarkUnitsClosed: sale.units, benchmarkProceeds: sale.value })),
      valuationDate, benchmarkValuationObservationDate: current?.observation_date ?? null,
      benchmarkValuationLevel: current ? Number(current.close_price) : null,
      remainingVirtualBenchmarkUnits: remainingUnits, counterfactualReferenceValue: benchmark.referenceValue,
      actualTotalReturnPercent: actual.returnPercent, benchmarkTotalReturnPercent: benchmark.returnPercent,
      returnDifferencePercentPoints: difference.returnPercent, actualAnnualizedPercent: actual.annualizedPercent,
      benchmarkAnnualizedPercent: benchmark.annualizedPercent,
      annualizedDifferencePercentPoints: difference.annualizedPercent
    };
    return { id: lot.id, securityKey: lot.securityKey, name: lot.securityName, buyDate: lot.tradeDate, currency: lot.currency,
      actual, benchmark, difference, reason, valuationDate, observationDate: current?.observation_date ?? null, trace };
  });
  const groups = new Map<string, number[]>();
  source.forEach((lot, index) => { const group = groups.get(lot.securityKey); if (group) group.push(index); else groups.set(lot.securityKey, [index]); });
  const holdings: Record<string, DecisionComparison> = {};
  for (const [key, indices] of groups) {
    if (!indices.some((index) => source[index].remainingQuantity > 0)) continue;
    const actualLots = indices.map((index) => source[index]), compared = indices.map((index) => lots[index]);
    const deployed = actualLots.reduce((sum, lot) => sum + lot.costBasis, 0);
    const remaining = actualLots.reduce((sum, lot) => sum + lot.remainingCostBasis, 0);
    const actual = metrics(deployed, remaining, total(compared.map((row) => row.actual.currentValue)), actualLots.reduce((sum, lot) => sum + lot.attributedSaleProceeds, 0),
      actualLots.flatMap((lot) => lot.cashFlows), actualLots.reduce((sum, lot) => sum + lot.accumulatedDividends, 0));
    const benchmark = metrics(deployed, remaining, total(compared.map((row) => row.benchmark.currentValue)),
      compared.some((row) => row.reason) ? null : total(indices.map((index) => virtualLots[index].closedBenchmarkValue)), indices.flatMap((index) => virtualLots[index].cashFlows));
    holdings[key] = { ...compared[0], id: key, currency: actualLots.every((lot) => lot.currency === "EUR") ? "EUR" : "non-EUR", actual, benchmark, difference: differences(actual, benchmark, true),
      reason: compared.some((row) => row.reason) ? `${compared.filter((row) => row.reason).length} purchase lot(s) have incomplete benchmark coverage. Valid lots remain available in Purchase Lots.` : null,
      valuationDate: compared.map((row) => row.valuationDate).filter((date): date is string => !!date).sort().at(-1) ?? null,
      observationDate: compared.map((row) => row.observationDate).filter((date): date is string => !!date).sort().at(-1) ?? null };
  }
  return { benchmarkId: id, label, description: description + (levels.some((row) => row.is_derived) ? "; derived EUR series" : ""),
    matching, lots, holdings, virtualLots, missingLots: lots.filter((lot) => lot.reason).length, error: levels.length ? null : `${label} EUR history is unavailable.` };
}

// Process exact buy/exit events once. Viewport changes reuse this full timeline.
export function calculateVirtualBenchmarkTimeline(
  virtualLots: VirtualBenchmarkLot[], history: BenchmarkObservation[], id: BenchmarkId, chartDates: string[]
): BenchmarkTimelinePoint[] {
  const levels = prepareHistory(history, id);
  if (!virtualLots.length || !chartDates.length) return [];
  const start = virtualLots.map((lot) => lot.buyDate).sort()[0], end = [...chartDates].sort().at(-1)!;
  const events = virtualLots.flatMap((lot) => [
    { date: lot.buyDate, units: lot.originalBenchmarkUnits ?? 0, missing: lot.originalBenchmarkUnits === null ? 1 : 0 },
    ...lot.exits.map((sale, index) => ({ date: sale.date, units: -(sale.units ?? 0),
      missing: lot.originalBenchmarkUnits === null && lot.closeDate && index === lot.exits.length - 1 ? -1 : 0 }))
  ]).sort((a, b) => a.date.localeCompare(b.date));
  const dates = [...new Set([...chartDates, ...events.map((event) => event.date), ...levels.map((row) => row.price_date)])].filter((date) => date >= start && date <= end).sort();
  let eventIndex = 0, units = 0, missing = 0;
  return dates.map((date) => {
    while (eventIndex < events.length && events[eventIndex].date <= date) {
      const event = events[eventIndex++]; units += event.units; missing += event.missing;
    }
    if (Math.abs(units) < 1e-10) units = 0;
    const level = benchmarkLevelAtDate(levels, date);
    return { date, value: missing > 0 || (units > 0 && !level) ? null : units * Number(level?.close_price ?? 0),
      missingLots: missing, observationDate: level?.price_date ?? null };
  });
}
