export function eurAggregationStatus(currencies: Array<string | null | undefined>) {
  const unsupportedCurrencies = [...new Set(currencies.map((currency) => currency?.trim().toUpperCase()).filter((currency): currency is string => Boolean(currency) && currency !== "EUR"))].sort();
  return { canAggregate: unsupportedCurrencies.length === 0, unsupportedCurrencies };
}
