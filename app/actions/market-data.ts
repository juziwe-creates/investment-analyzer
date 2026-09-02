"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  configuredMarketDataProviderId,
  createMarketDataProvider
} from "@/lib/market-data";
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

  const currency = typedSecurity.security_currency ?? "EUR";
  let successMessage = "";

  try {
    const prices = await provider.fetchDailyPrices({ symbol: providerSymbol });
    const priceRows = prices.map((price) => ({
      user_id: user.id,
      portfolio_id: typedSecurity.portfolio_id,
      security_key: typedSecurity.security_key,
      security_name: typedSecurity.security_name,
      isin: typedSecurity.isin,
      ticker: typedSecurity.ticker,
      provider: provider.id,
      provider_symbol: providerSymbol,
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

    await sleep(requestDelayMs());

    try {
      const dividends = await provider.fetchDividends({ symbol: providerSymbol });
      dividendRows = dividends.map((dividend) => ({
        user_id: user.id,
        portfolio_id: typedSecurity.portfolio_id,
        security_key: typedSecurity.security_key,
        security_name: typedSecurity.security_name,
        isin: typedSecurity.isin,
        ticker: typedSecurity.ticker,
        provider: provider.id,
        provider_symbol: providerSymbol,
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

    await updateSyncRun(syncRunId, {
      status: warningMessage ? "completed_with_errors" : "completed",
      prices_imported: priceRows.length,
      dividends_imported: dividendRows.length,
      error_message: warningMessage
    });

    successMessage =
      `Synced ${priceRows.length} prices and ${dividendRows.length} dividends for ${typedSecurity.security_name} via ${providerSymbol}` +
      (warningMessage ? `. ${warningMessage}` : "");
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
