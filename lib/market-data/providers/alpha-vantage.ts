import type {
  DailyMarketPrice,
  FetchMarketDataInput,
  MarketDataProvider,
  MarketDividend
} from "@/lib/market-data/types";

const baseUrl = "https://www.alphavantage.co/query";

type AlphaVantageDailyResponse = {
  "Time Series (Daily)"?: Record<
    string,
    {
      "1. open"?: string;
      "2. high"?: string;
      "3. low"?: string;
      "4. close"?: string;
      "5. volume"?: string;
    }
  >;
  "Error Message"?: string;
  Note?: string;
  Information?: string;
};

type AlphaVantageDividendsResponse = {
  data?: {
    ex_dividend_date?: string;
    declaration_date?: string;
    record_date?: string;
    payment_date?: string;
    amount?: string;
  }[];
  "Error Message"?: string;
  Note?: string;
  Information?: string;
};

function parseNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireNumber(value: string | undefined, label: string) {
  const parsed = parseNumber(value);

  if (parsed === null) {
    throw new Error(`Alpha Vantage returned an invalid ${label}`);
  }

  return parsed;
}

function parseDate(value: string | undefined) {
  return value && value !== "None" ? value : null;
}

function assertProviderSuccess(
  payload: AlphaVantageDailyResponse | AlphaVantageDividendsResponse
) {
  if (payload["Error Message"]) {
    throw new Error(payload["Error Message"]);
  }

  if (payload.Note) {
    throw new Error(payload.Note);
  }

  if (payload.Information) {
    throw new Error(payload.Information);
  }
}

async function fetchAlphaVantage<T>(
  apiKey: string,
  params: Record<string, string>
) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    next: {
      revalidate: 0
    }
  });

  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

type AlphaVantageOutputSize = "compact" | "full";

export function createAlphaVantageProvider(
  apiKey: string,
  outputSize: AlphaVantageOutputSize
): MarketDataProvider {
  return {
    id: "alpha_vantage",

    async fetchDailyPrices(input: FetchMarketDataInput): Promise<DailyMarketPrice[]> {
      const payload = await fetchAlphaVantage<AlphaVantageDailyResponse>(apiKey, {
        function: "TIME_SERIES_DAILY",
        symbol: input.symbol,
        outputsize: outputSize
      });

      assertProviderSuccess(payload);

      const series = payload["Time Series (Daily)"];

      if (!series) {
        throw new Error("Alpha Vantage did not return daily price data");
      }

      return Object.entries(series).map(([priceDate, values]) => ({
        priceDate,
        openPrice: parseNumber(values["1. open"]),
        highPrice: parseNumber(values["2. high"]),
        lowPrice: parseNumber(values["3. low"]),
        closePrice: requireNumber(values["4. close"], "close price"),
        adjustedClosePrice: null,
        volume: parseNumber(values["5. volume"])
      }));
    },

    async fetchDividends(input: FetchMarketDataInput): Promise<MarketDividend[]> {
      const payload = await fetchAlphaVantage<AlphaVantageDividendsResponse>(apiKey, {
        function: "DIVIDENDS",
        symbol: input.symbol
      });

      assertProviderSuccess(payload);

      return (payload.data ?? [])
        .map((dividend) => ({
          exDividendDate: parseDate(dividend.ex_dividend_date) ?? "",
          declarationDate: parseDate(dividend.declaration_date),
          recordDate: parseDate(dividend.record_date),
          paymentDate: parseDate(dividend.payment_date),
          amountPerShare: requireNumber(dividend.amount, "dividend amount")
        }))
        .filter((dividend) => dividend.exDividendDate && dividend.amountPerShare > 0);
    }
  };
}
