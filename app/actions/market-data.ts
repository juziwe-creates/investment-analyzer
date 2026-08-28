"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createMarketDataProvider } from "@/lib/market-data";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type UserSecurity = Database["public"]["Views"]["user_securities"]["Row"];

function requiredText(formData: FormData, key: string, label: string) {
  const value = formData.get(key)?.toString().trim();

  if (!value) {
    redirect(`/securities?message=${encodeURIComponent(`${label} is required`)}`);
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

async function updateSyncRun(
  runId: string,
  values: {
    status: "completed" | "completed_with_errors" | "failed";
    prices_imported?: number;
    dividends_imported?: number;
    error_message?: string;
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

export async function syncSecurityMarketData(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const portfolioId = requiredText(formData, "portfolio_id", "Portfolio");
  const securityKey = requiredText(formData, "security_key", "Security key");

  const { data: security, error: securityError } = await supabase
    .from("user_securities")
    .select(
      "user_id,portfolio_id,security_key,security_name,isin,wkn,ticker,exchange,security_currency,asset_type,transaction_count,first_trade_date,last_trade_date"
    )
    .eq("portfolio_id", portfolioId)
    .eq("security_key", securityKey)
    .maybeSingle();

  if (securityError) {
    redirect(`/securities?message=${encodeURIComponent(securityError.message)}`);
  }

  if (!security) {
    redirect("/securities?message=Security was not found");
  }

  const typedSecurity = security as UserSecurity;
  const providerSymbol = typedSecurity.ticker;

  if (!providerSymbol) {
    redirect("/securities?message=Add a ticker before syncing market data");
  }

  let provider;

  try {
    provider = createMarketDataProvider();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market data provider is not configured";
    redirect(`/securities?message=${encodeURIComponent(message)}`);
  }

  const { data: syncRun, error: syncRunError } = await supabase
    .from("market_data_sync_runs")
    .insert({
      user_id: user.id,
      portfolio_id: typedSecurity.portfolio_id,
      security_key: typedSecurity.security_key,
      provider: provider.id,
      provider_symbol: providerSymbol,
      status: "processing"
    })
    .select("id")
    .single();

  if (syncRunError) {
    redirect(`/securities?message=${encodeURIComponent(syncRunError.message)}`);
  }

  const currency = typedSecurity.security_currency ?? "EUR";
  let successMessage = "";

  try {
    const [prices, dividends] = await Promise.all([
      provider.fetchDailyPrices({ symbol: providerSymbol }),
      provider.fetchDividends({ symbol: providerSymbol })
    ]);

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

    const dividendRows = dividends.map((dividend) => ({
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

    for (const priceChunk of chunk(priceRows, 500)) {
      const { error } = await supabase.from("market_prices").upsert(priceChunk, {
        onConflict: "user_id,portfolio_id,security_key,provider,price_date"
      });

      if (error) {
        throw error;
      }
    }

    for (const dividendChunk of chunk(dividendRows, 500)) {
      const { error } = await supabase.from("market_dividends").upsert(dividendChunk, {
        onConflict:
          "user_id,portfolio_id,security_key,provider,ex_dividend_date,amount_per_share"
      });

      if (error) {
        throw error;
      }
    }

    await updateSyncRun(syncRun.id, {
      status: "completed",
      prices_imported: priceRows.length,
      dividends_imported: dividendRows.length
    });

    successMessage = `Synced ${priceRows.length} prices and ${dividendRows.length} dividends for ${typedSecurity.security_name}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market data sync failed";

    await updateSyncRun(syncRun.id, {
      status: "failed",
      error_message: message
    });

    redirect(`/securities?message=${encodeURIComponent(message)}`);
  }

  revalidatePath("/securities");
  revalidatePath("/transactions");
  redirect(`/securities?message=${encodeURIComponent(successMessage)}`);
}
