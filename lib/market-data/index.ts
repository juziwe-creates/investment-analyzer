import { createAlphaVantageProvider } from "@/lib/market-data/providers/alpha-vantage";
import type { MarketDataProvider } from "@/lib/market-data/types";

function marketDataOutputSize() {
  return process.env.MARKET_DATA_OUTPUT_SIZE === "full" ? "full" : "compact";
}

export function createMarketDataProvider(): MarketDataProvider {
  const provider = process.env.MARKET_DATA_PROVIDER ?? "alpha_vantage";
  const apiKey = process.env.MARKET_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("MARKET_DATA_API_KEY is not configured");
  }

  if (provider === "alpha_vantage") {
    return createAlphaVantageProvider(apiKey, marketDataOutputSize());
  }

  throw new Error(`Unsupported market data provider: ${provider}`);
}
