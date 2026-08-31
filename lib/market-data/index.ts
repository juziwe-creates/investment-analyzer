import { createAlphaVantageProvider } from "@/lib/market-data/providers/alpha-vantage";
import { createEodhdProvider } from "@/lib/market-data/providers/eodhd";
import type { MarketDataProvider } from "@/lib/market-data/types";

function marketDataOutputSize() {
  return process.env.MARKET_DATA_OUTPUT_SIZE === "full" ? "full" : "compact";
}

function providerApiKey(provider: string) {
  if (provider === "eodhd") {
    return process.env.EODHD_API_TOKEN ?? process.env.MARKET_DATA_API_KEY;
  }

  if (provider === "alpha_vantage") {
    return process.env.ALPHA_VANTAGE_API_KEY ?? process.env.MARKET_DATA_API_KEY;
  }

  return process.env.MARKET_DATA_API_KEY;
}

function configuredProvider() {
  const provider = process.env.MARKET_DATA_PROVIDER?.trim().toLowerCase();

  if (provider) {
    return provider.replace("-", "_");
  }

  if (process.env.EODHD_API_TOKEN) {
    return "eodhd";
  }

  return "alpha_vantage";
}

export function createMarketDataProvider(): MarketDataProvider {
  const provider = configuredProvider();
  const apiKey = providerApiKey(provider);

  if (!apiKey) {
    throw new Error(
      provider === "eodhd"
        ? "EODHD_API_TOKEN or MARKET_DATA_API_KEY is not configured"
        : "ALPHA_VANTAGE_API_KEY or MARKET_DATA_API_KEY is not configured"
    );
  }

  if (provider === "eodhd") {
    return createEodhdProvider(apiKey);
  }

  if (provider === "alpha_vantage") {
    return createAlphaVantageProvider(apiKey, marketDataOutputSize());
  }

  throw new Error(`Unsupported market data provider: ${provider}`);
}
