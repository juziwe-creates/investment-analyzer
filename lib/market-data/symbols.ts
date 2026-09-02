const eodhdExchangeAliases = new Map<string, string>([
  ["DE", "XETRA"],
  ["DEX", "XETRA"],
  ["ETR", "XETRA"],
  ["XETRA", "XETRA"],
  ["FWB", "F"],
  ["FRA", "F"],
  ["FRANKFURT", "F"],
  ["NASDAQ", "US"],
  ["NYSE", "US"],
  ["NYSE ARCA", "US"],
  ["US", "US"],
  ["LSE", "LSE"]
]);

const commonEodhdExchangeCodes = new Set([
  "AS",
  "BE",
  "CO",
  "F",
  "HK",
  "LSE",
  "MI",
  "PA",
  "ST",
  "SW",
  "TO",
  "US",
  "V",
  "VI",
  "XETRA"
]);

const knownGermanEodhdSymbolsByIsin = new Map<string, string>([
  ["LU2611732475", "C005.XETRA"],
  ["US0091581068", "AP3.XETRA"],
  ["US0231351067", "AMZ.XETRA"],
  ["US5949181045", "MSF.XETRA"]
]);

type EodhdSymbolOptions = {
  preferredExchange?: string | null;
};

function normalizedExchange(exchange: string | null | undefined) {
  if (!exchange) {
    return null;
  }

  const normalized = exchange.trim().toUpperCase();
  return eodhdExchangeAliases.get(normalized) ?? normalized;
}

function normalizeTickerBase(ticker: string) {
  return ticker.trim().toUpperCase().replaceAll(".", "-");
}

export function eodhdProviderSymbol(
  ticker: string,
  exchange: string | null | undefined,
  options: EodhdSymbolOptions = {}
) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const preferredExchangeCode = normalizedExchange(options.preferredExchange);
  const exchangeCode = preferredExchangeCode ?? normalizedExchange(exchange);
  const parts = normalizedTicker.split(".");

  if (parts.length === 1) {
    return exchangeCode ? `${normalizeTickerBase(normalizedTicker)}.${exchangeCode}` : normalizedTicker;
  }

  const suffix = parts.at(-1) ?? "";
  const tickerWithoutSuffix = parts.slice(0, -1).join(".");
  const suffixExchange = eodhdExchangeAliases.get(suffix) ?? suffix;
  const suffixIsExchange =
    eodhdExchangeAliases.has(suffix) || commonEodhdExchangeCodes.has(suffixExchange);

  if (preferredExchangeCode) {
    const tickerBase = suffixIsExchange ? tickerWithoutSuffix : normalizedTicker;

    return `${normalizeTickerBase(tickerBase)}.${preferredExchangeCode}`;
  }

  if (exchangeCode && !commonEodhdExchangeCodes.has(suffixExchange)) {
    return `${normalizeTickerBase(normalizedTicker)}.${exchangeCode}`;
  }

  return `${normalizeTickerBase(tickerWithoutSuffix)}.${suffixExchange}`;
}

export function marketDataProviderSymbol(input: {
  providerId: string;
  isin?: string | null;
  ticker: string;
  exchange: string | null | undefined;
  preferGermanExchange?: boolean;
}) {
  if (input.providerId === "eodhd") {
    const knownGermanSymbol = input.isin
      ? knownGermanEodhdSymbolsByIsin.get(input.isin.toUpperCase())
      : null;

    if (knownGermanSymbol) {
      return knownGermanSymbol;
    }

    return eodhdProviderSymbol(input.ticker, input.exchange, {
      preferredExchange: input.preferGermanExchange ? "XETRA" : null
    });
  }

  return input.ticker.trim();
}

export function validateMarketDataProviderSymbol(input: {
  providerId: string;
  providerSymbol: string;
}) {
  if (input.providerId !== "eodhd") {
    return null;
  }

  if (!input.providerSymbol.includes(".")) {
    return "EODHD needs an exchange-qualified ticker such as MUV2.XETRA or MSFT.US.";
  }

  return null;
}
