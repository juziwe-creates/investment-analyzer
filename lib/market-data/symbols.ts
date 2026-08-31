const eodhdExchangeAliases = new Map<string, string>([
  ["DE", "XETRA"],
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
  exchange: string | null | undefined
) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const exchangeCode = normalizedExchange(exchange);
  const parts = normalizedTicker.split(".");

  if (parts.length === 1) {
    return exchangeCode ? `${normalizeTickerBase(normalizedTicker)}.${exchangeCode}` : normalizedTicker;
  }

  const suffix = parts.at(-1) ?? "";
  const tickerWithoutSuffix = parts.slice(0, -1).join(".");
  const suffixExchange = eodhdExchangeAliases.get(suffix) ?? suffix;

  if (exchangeCode && !commonEodhdExchangeCodes.has(suffixExchange)) {
    return `${normalizeTickerBase(normalizedTicker)}.${exchangeCode}`;
  }

  return `${normalizeTickerBase(tickerWithoutSuffix)}.${suffixExchange}`;
}

export function marketDataProviderSymbol(input: {
  providerId: string;
  ticker: string;
  exchange: string | null | undefined;
}) {
  if (input.providerId === "eodhd") {
    return eodhdProviderSymbol(input.ticker, input.exchange);
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
