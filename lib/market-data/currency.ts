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

  // Alpha's configured provider feeds are requested for the user's EUR view.
  // Some instruments are returned with the listing/original currency label even
  // though the stored numeric quote is already EUR. The provider value is the
  // authority for this distinction; manual prices and transactions are not
  // changed by this helper.
  if (input.providerId === "eodhd" || input.providerId === "alpha_vantage") {
    return "EUR";
  }

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
