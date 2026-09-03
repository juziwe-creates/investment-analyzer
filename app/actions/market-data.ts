"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  configuredMarketDataProviderId,
  createMarketDataProvider
} from "@/lib/market-data";
import { marketDataCurrency } from "@/lib/market-data/currency";
import {
  marketDataProviderSymbol,
  validateMarketDataProviderSymbol
} from "@/lib/market-data/symbols";
import type { MarketDataProvider } from "@/lib/market-data/types";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type UserSecurity = Database["public"]["Views"]["user_securities"]["Row"];
type SecurityProviderSymbol =
  Database["public"]["Tables"]["security_provider_symbols"]["Row"];
type LatestProviderMarketPrice =
  Database["public"]["Views"]["latest_provider_market_prices"]["Row"];
type MarketDataStatus = "completed" | "completed_with_errors" | "failed";
const defaultReturnPath = "/securities";
const allowedReturnPaths = new Set(["/securities", "/market-data"]);

function safeReturnPath(formData: FormData) {
  const returnTo = formData.get("return_to")?.toString().trim();

  return returnTo && allowedReturnPaths.has(returnTo) ? returnTo : defaultReturnPath;
}

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function requiredText(
  formData: FormData,
  key: string,
  label: string,
  returnTo = defaultReturnPath
) {
  const value = formData.get(key)?.toString().trim();

  if (!value) {
    redirectWithMessage(returnTo, `${label} is required`);
  }

  return value;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function requestDelayMs() {
  const configuredDelay = Number(process.env.MARKET_DATA_REQUEST_DELAY_MS);

  if (Number.isFinite(configuredDelay) && configuredDelay >= 1000) {
    return configuredDelay;
  }

  return 1200;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function providerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Market data sync failed";
}

function dateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const parsedDate = new Date(`${date}T00:00:00Z`);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);

  return dateOnly(parsedDate);
}

function isRefreshableAsset(assetType: string | null) {
  const normalized = assetType?.trim().toLowerCase();

  return normalized === "stock" || normalized === "etf" || normalized === "fund";
}

async function updateSyncRun(
  runId: string,
  values: {
    status: MarketDataStatus;
    prices_imported?: number;
    dividends_imported?: number;
    error_message?: string | null;
  }
) {
  const supabase = await createClient();
  await supabase
    .from("market_data_sync_runs")
    .update({
      ...values,
      finished_at: new Date().toISOString()
    })
    .eq("id", runId);
}

async function upsertMarketPrices(
  rows: Database["public"]["Tables"]["market_prices"]["Insert"][]
) {
  const supabase = await createClient();

  for (const priceChunk of chunk(rows, 500)) {
    const { error } = await supabase.from("market_prices").upsert(priceChunk, {
      onConflict: "user_id,portfolio_id,security_key,provider,price_date"
    });

    if (error) {
      throw error;
    }
  }
}

async function upsertMarketDividends(
  rows: Database["public"]["Tables"]["market_dividends"]["Insert"][]
) {
  const supabase = await createClient();

  for (const dividendChunk of chunk(rows, 500)) {
    const { error } = await supabase.from("market_dividends").upsert(dividendChunk, {
      onConflict:
        "user_id,portfolio_id,security_key,provider,ex_dividend_date,amount_per_share"
    });

    if (error) {
      throw error;
    }
  }
}

async function fetchAndStoreSecurityMarketData(input: {
  includeDividends: boolean;
  provider: MarketDataProvider;
  providerSymbol: string;
  security: UserSecurity;
  userId: string;
  fromDate?: string;
  toDate?: string;
}) {
  const currency = marketDataCurrency({
    fallbackCurrency: input.security.security_currency,
    providerId: input.provider.id,
    providerSymbol: input.providerSymbol
  });
  const prices = await input.provider.fetchDailyPrices({
    symbol: input.providerSymbol,
    fromDate: input.fromDate,
    toDate: input.toDate
  });
  const priceRows = prices.map((price) => ({
    user_id: input.userId,
    portfolio_id: input.security.portfolio_id,
    security_key: input.security.security_key,
    security_name: input.security.security_name,
    isin: input.security.isin,
    ticker: input.security.ticker,
    provider: input.provider.id,
    provider_symbol: input.providerSymbol,
    price_date: price.priceDate,
    open_price: price.openPrice,
    high_price: price.highPrice,
    low_price: price.lowPrice,
    close_price: price.closePrice,
    adjusted_close_price: price.adjustedClosePrice,
    volume: price.volume,
    currency
  }));

  await upsertMarketPrices(priceRows);

  let dividendRows: Database["public"]["Tables"]["market_dividends"]["Insert"][] = [];
  let warningMessage: string | null = null;

  if (!input.includeDividends) {
    return {
      priceCount: priceRows.length,
      dividendCount: 0,
      warningMessage
    };
  }

  await sleep(requestDelayMs());

  try {
    const dividends = await input.provider.fetchDividends({
      symbol: input.providerSymbol,
      fromDate: input.fromDate,
      toDate: input.toDate
    });
    dividendRows = dividends.map((dividend) => ({
      user_id: input.userId,
      portfolio_id: input.security.portfolio_id,
      security_key: input.security.security_key,
      security_name: input.security.security_name,
      isin: input.security.isin,
      ticker: input.security.ticker,
      provider: input.provider.id,
      provider_symbol: input.providerSymbol,
      ex_dividend_date: dividend.exDividendDate,
      declaration_date: dividend.declarationDate,
      record_date: dividend.recordDate,
      payment_date: dividend.paymentDate,
      amount_per_share: dividend.amountPerShare,
      currency
    }));

    await upsertMarketDividends(dividendRows);
  } catch (error) {
    warningMessage = `Prices were synced, but dividend sync failed: ${providerErrorMessage(error)}`;
  }

  return {
    priceCount: priceRows.length,
    dividendCount: dividendRows.length,
    warningMessage
  };
}

export async function syncSecurityMarketData(formData: FormData) {
  const returnTo = safeReturnPath(formData);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const portfolioId = requiredText(formData, "portfolio_id", "Portfolio", returnTo);
  const securityKey = requiredText(formData, "security_key", "Security key", returnTo);

  const { data: securities, error: securityError } = await supabase
    .from("user_securities")
    .select(
      "user_id,portfolio_id,security_key,security_name,isin,wkn,ticker,exchange,security_currency,asset_type,transaction_count,first_trade_date,last_trade_date"
    )
    .eq("user_id", user.id)
    .eq("portfolio_id", portfolioId)
    .eq("security_key", securityKey)
    .limit(1);

  if (securityError) {
    redirectWithMessage(returnTo, securityError.message);
  }

  if (!securities || securities.length === 0) {
    redirectWithMessage(returnTo, "Security was not found");
  }

  const typedSecurity = securities.at(0) as UserSecurity | undefined;

  if (!typedSecurity) {
    redirectWithMessage(returnTo, "Security was not found");
  }

  let provider: MarketDataProvider;

  try {
    provider = createMarketDataProvider();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market data provider is not configured";
    redirectWithMessage(returnTo, message);
  }

  const { data: storedSymbols, error: storedSymbolError } = await supabase
    .from("security_provider_symbols")
    .select(
      "id,user_id,portfolio_id,security_key,provider,provider_symbol,source,notes,resolved_at,created_at,updated_at"
    )
    .eq("user_id", user.id)
    .eq("portfolio_id", typedSecurity.portfolio_id)
    .eq("security_key", typedSecurity.security_key)
    .eq("provider", provider.id)
    .limit(1);

  if (storedSymbolError) {
    redirectWithMessage(returnTo, storedSymbolError.message);
  }

  const storedProviderSymbol =
    (storedSymbols?.[0] as SecurityProviderSymbol | undefined)?.provider_symbol.trim() ??
    null;

  if (!storedProviderSymbol && !typedSecurity.ticker) {
    redirectWithMessage(
      returnTo,
      "Add a provider symbol or transaction ticker before syncing market data"
    );
  }

  const providerSymbol =
    storedProviderSymbol ??
    marketDataProviderSymbol({
      providerId: provider.id,
      isin: typedSecurity.isin,
      ticker: typedSecurity.ticker ?? "",
      exchange: typedSecurity.exchange,
      preferGermanExchange: typedSecurity.security_currency === "EUR"
    });
  const providerSymbolError = validateMarketDataProviderSymbol({
    providerId: provider.id,
    providerSymbol
  });

  if (providerSymbolError) {
    redirectWithMessage(returnTo, providerSymbolError);
  }

  const syncRunId = crypto.randomUUID();
  const { error: syncRunError } = await supabase
    .from("market_data_sync_runs")
    .insert({
      id: syncRunId,
      user_id: user.id,
      portfolio_id: typedSecurity.portfolio_id,
      security_key: typedSecurity.security_key,
      provider: provider.id,
      provider_symbol: providerSymbol,
      status: "processing"
    });

  if (syncRunError) {
    redirectWithMessage(returnTo, syncRunError.message);
  }

  let successMessage = "";

  try {
    const result = await fetchAndStoreSecurityMarketData({
      includeDividends: true,
      provider,
      providerSymbol,
      security: typedSecurity,
      userId: user.id
    });

    await updateSyncRun(syncRunId, {
      status: result.warningMessage ? "completed_with_errors" : "completed",
      prices_imported: result.priceCount,
      dividends_imported: result.dividendCount,
      error_message: result.warningMessage
    });

    successMessage =
      `Synced ${result.priceCount} prices and ${result.dividendCount} dividends for ${typedSecurity.security_name} via ${providerSymbol}` +
      (result.warningMessage ? `. ${result.warningMessage}` : "");
  } catch (error) {
    const message = providerErrorMessage(error);

    await updateSyncRun(syncRunId, {
      status: "failed",
      error_message: message
    });

    redirectWithMessage(returnTo, message);
  }

  revalidatePath("/market-data");
  revalidatePath("/securities");
  revalidatePath("/transactions");
  redirectWithMessage(returnTo, successMessage);
}

export async function refreshSyncedMarketData(formData: FormData) {
  const returnTo = safeReturnPath(formData);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let provider: MarketDataProvider;

  try {
    provider = createMarketDataProvider();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market data provider is not configured";
    redirectWithMessage(returnTo, message);
  }

  const securitiesQuery = supabase
    .from("user_securities")
    .select(
      "user_id,portfolio_id,security_key,security_name,isin,wkn,ticker,exchange,security_currency,asset_type,transaction_count,first_trade_date,last_trade_date"
    )
    .eq("user_id", user.id);
  const storedSymbolsQuery = supabase
    .from("security_provider_symbols")
    .select(
      "id,user_id,portfolio_id,security_key,provider,provider_symbol,source,notes,resolved_at,created_at,updated_at"
    )
    .eq("user_id", user.id)
    .eq("provider", provider.id);
  const latestPricesQuery = supabase
    .from("latest_provider_market_prices")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", provider.id);
  const [
    { data: securities, error: securitiesError },
    { data: storedSymbols, error: storedSymbolsError },
    { data: latestPrices, error: latestPricesError }
  ] = await Promise.all([
    securitiesQuery,
    storedSymbolsQuery,
    latestPricesQuery
  ]);

  const firstError = securitiesError ?? storedSymbolsError ?? latestPricesError;

  if (firstError) {
    redirectWithMessage(returnTo, firstError.message);
  }

  const storedSymbolsBySecurity = new Map(
    (storedSymbols ?? []).map((symbol) => [symbol.security_key, symbol])
  );
  const latestPricesBySecurity = new Map(
    (latestPrices ?? []).map((price) => [price.security_key, price])
  );
  const today = dateOnly();
  let refreshed = 0;
  let skipped = 0;
  let failed = 0;
  let pricesImported = 0;
  const errors: string[] = [];

  for (const security of (securities ?? []) as UserSecurity[]) {
    if (!isRefreshableAsset(security.asset_type)) {
      skipped += 1;
      continue;
    }

    const latestPrice = latestPricesBySecurity.get(
      security.security_key
    ) as LatestProviderMarketPrice | undefined;

    if (!latestPrice) {
      skipped += 1;
      continue;
    }

    const storedSymbol = storedSymbolsBySecurity.get(
      security.security_key
    ) as SecurityProviderSymbol | undefined;
    const providerSymbol =
      storedSymbol?.provider_symbol.trim() || latestPrice.provider_symbol.trim();
    const fromDate = addDays(latestPrice.price_date, 1);

    if (fromDate > today) {
      skipped += 1;
      continue;
    }

    const syncRunId = crypto.randomUUID();
    const { error: syncRunError } = await supabase
      .from("market_data_sync_runs")
      .insert({
        id: syncRunId,
        user_id: user.id,
        portfolio_id: security.portfolio_id,
        security_key: security.security_key,
        provider: provider.id,
        provider_symbol: providerSymbol,
        status: "processing"
      });

    if (syncRunError) {
      failed += 1;
      errors.push(`${security.security_name}: ${syncRunError.message}`);
      continue;
    }

    try {
      const result = await fetchAndStoreSecurityMarketData({
        includeDividends: false,
        provider,
        providerSymbol,
        security,
        userId: user.id,
        fromDate,
        toDate: today
      });

      await updateSyncRun(syncRunId, {
        status: "completed",
        prices_imported: result.priceCount,
        dividends_imported: 0,
        error_message: null
      });

      refreshed += 1;
      pricesImported += result.priceCount;
      await sleep(requestDelayMs());
    } catch (error) {
      const message = providerErrorMessage(error);

      await updateSyncRun(syncRunId, {
        status: "failed",
        error_message: message
      });

      failed += 1;
      errors.push(`${security.security_name}: ${message}`);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/market-data");
  revalidatePath("/portfolio");
  revalidatePath("/securities");
  revalidatePath("/stock-analytics");
  revalidatePath("/transaction-analytics");

  const errorSummary = errors.length > 0 ? ` First issue: ${errors[0]}` : "";
  redirectWithMessage(
    returnTo,
    `Refreshed ${refreshed} securities with ${pricesImported} new price rows. Skipped ${skipped}. Failed ${failed}.${errorSummary}`
  );
}

export async function saveSecurityProviderSymbol(formData: FormData) {
  const returnTo = safeReturnPath(formData);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const portfolioId = requiredText(formData, "portfolio_id", "Portfolio", returnTo);
  const securityKey = requiredText(formData, "security_key", "Security key", returnTo);
  const provider = (
    formData.get("provider")?.toString().trim().toLowerCase().replace("-", "_") ??
    configuredMarketDataProviderId()
  );
  const providerSymbol = requiredText(
    formData,
    "provider_symbol",
    "Provider symbol",
    returnTo
  ).toUpperCase();
  const notes = formData.get("notes")?.toString().trim() || null;
  const providerSymbolError = validateMarketDataProviderSymbol({
    providerId: provider,
    providerSymbol
  });

  if (providerSymbolError) {
    redirectWithMessage(returnTo, providerSymbolError);
  }

  const { error } = await supabase.from("security_provider_symbols").upsert(
    {
      user_id: user.id,
      portfolio_id: portfolioId,
      security_key: securityKey,
      provider,
      provider_symbol: providerSymbol,
      source: "manual",
      notes,
      resolved_at: new Date().toISOString()
    },
    {
      onConflict: "user_id,portfolio_id,security_key,provider"
    }
  );

  if (error) {
    redirectWithMessage(returnTo, error.message);
  }

  revalidatePath("/market-data");
  revalidatePath("/securities");
  redirectWithMessage(returnTo, `Saved ${provider} symbol ${providerSymbol}`);
}
