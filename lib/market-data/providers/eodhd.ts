import type {
  DailyMarketPrice,
  FetchMarketDataInput,
  MarketDataProvider,
  MarketDividend
} from "@/lib/market-data/types";

const baseUrl = "https://eodhd.com/api";

type EodhdPrice = {
  date?: string;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
  adjusted_close?: number | string | null;
  volume?: number | string | null;
};

type EodhdDividend = {
  date?: string;
  exDate?: string;
  ex_dividend_date?: string;
  declarationDate?: string | null;
  recordDate?: string | null;
  paymentDate?: string | null;
  value?: number | string | null;
  amount?: number | string | null;
  dividend?: number | string | null;
};

type EodhdError = {
  code?: string | number;
  message?: string;
  error?: string;
};

function parseNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireNumber(
  value: number | string | null | undefined,
  label: string
) {
  const parsed = parseNumber(value);

  if (parsed === null) {
    throw new Error(`EODHD returned an invalid ${label}`);
  }

  return parsed;
}

function parseDate(value: string | null | undefined) {
  return value && value !== "0000-00-00" ? value : null;
}

function assertEodhdArray<T>(payload: unknown, label: string): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  const providerError = payload as EodhdError;
  const message = providerError.message ?? providerError.error;

  if (message) {
    throw new Error(message);
  }

  throw new Error(`EODHD did not return ${label}`);
}

async function fetchEodhd<T>(
  apiToken: string,
  path: string,
  params: Record<string, string> = {}
) {
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("api_token", apiToken);
  url.searchParams.set("fmt", "json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    next: {
      revalidate: 0
    }
  });

  const responseText = await response.text();
  let payload: unknown;

  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    throw new Error(
      response.ok
        ? "EODHD returned a non-JSON response"
        : `EODHD request failed with status ${response.status}`
    );
  }

  if (!response.ok) {
    const providerError = payload as EodhdError;
    const message = providerError.message ?? providerError.error;
    throw new Error(
      message ?? `EODHD request failed with status ${response.status}`
    );
  }

  return payload as T;
}

function encodeTicker(symbol: string) {
  return encodeURIComponent(symbol.trim());
}

function providerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown EODHD error";
}

export function createEodhdProvider(apiToken: string): MarketDataProvider {
  return {
    id: "eodhd",

    async fetchDailyPrices(input: FetchMarketDataInput): Promise<DailyMarketPrice[]> {
      let payload: unknown;

      try {
        payload = await fetchEodhd<unknown>(
          apiToken,
          `/eod/${encodeTicker(input.symbol)}`,
          {
            period: "d",
            order: "a"
          }
        );
      } catch (error) {
        throw new Error(
          `EODHD price request failed for ${input.symbol}: ${providerErrorMessage(error)}`
        );
      }

      const prices = assertEodhdArray<EodhdPrice>(payload, "daily price data");

      return prices
        .map((price) => ({
          priceDate: parseDate(price.date) ?? "",
          openPrice: parseNumber(price.open),
          highPrice: parseNumber(price.high),
          lowPrice: parseNumber(price.low),
          closePrice: requireNumber(price.close, "close price"),
          adjustedClosePrice: parseNumber(price.adjusted_close),
          volume: parseNumber(price.volume)
        }))
        .filter((price) => price.priceDate);
    },

    async fetchDividends(input: FetchMarketDataInput): Promise<MarketDividend[]> {
      let payload: unknown;

      try {
        payload = await fetchEodhd<unknown>(
          apiToken,
          `/div/${encodeTicker(input.symbol)}`,
          {
            order: "a"
          }
        );
      } catch (error) {
        throw new Error(
          `EODHD dividend request failed for ${input.symbol}: ${providerErrorMessage(error)}`
        );
      }

      const dividends = assertEodhdArray<EodhdDividend>(
        payload,
        "dividend data"
      );

      return dividends
        .map((dividend) => ({
          exDividendDate:
            parseDate(dividend.date) ??
            parseDate(dividend.exDate) ??
            parseDate(dividend.ex_dividend_date) ??
            "",
          declarationDate: parseDate(dividend.declarationDate),
          recordDate: parseDate(dividend.recordDate),
          paymentDate: parseDate(dividend.paymentDate),
          amountPerShare: requireNumber(
            dividend.value ?? dividend.amount ?? dividend.dividend,
            "dividend amount"
          )
        }))
        .filter((dividend) => dividend.exDividendDate && dividend.amountPerShare > 0);
    }
  };
}
