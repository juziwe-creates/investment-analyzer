const eodhdGermanExchangeSuffixes = new Set(["XETRA", "F"]);

function providerExchange(providerSymbol: string) {
  const suffix = providerSymbol.trim().toUpperCase().split(".").at(-1);

  return suffix || null;
}

function normalizedCurrency(currency: string | null | undefined) {
  return currency?.trim().toUpperCase() || "EUR";
}

export function marketDataCurrency(input: {
  fallbackCurrency: string | null | undefined;
  providerId: string;
  providerSymbol: string | null | undefined;
}) {
  const providerSymbol = input.providerSymbol?.trim();

  if (input.providerId === "eodhd" && providerSymbol) {
    const exchange = providerExchange(providerSymbol);

    if (exchange && eodhdGermanExchangeSuffixes.has(exchange)) {
      return "EUR";
    }
  }

  return normalizedCurrency(input.fallbackCurrency);
}

export function hasCorrectedMarketDataCurrency(input: {
  fallbackCurrency: string | null | undefined;
  providerId: string;
  providerSymbol: string | null | undefined;
}) {
  return marketDataCurrency(input) !== normalizedCurrency(input.fallbackCurrency);
}
