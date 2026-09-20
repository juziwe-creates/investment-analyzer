import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { measureAnalytics } from "@/lib/performance";
import { deduplicateMarketHistory } from "@/lib/market-data/history-dedupe";
import type { MarketHistoryPrice } from "@/types/market-history";

export const readMarketHistory = cache(async (portfolioId?: string, securityKey?: string) => measureAnalytics("market-history.read", async () => {
  const supabase = await createClient();
  const rows: MarketHistoryPrice[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = supabase.from("market_prices")
      .select("id,security_key,price_date,close_price,adjusted_close_price,currency,provider,provider_symbol,updated_at")
      .order("price_date").order("updated_at").order("id").range(offset, offset + 999);
    if (portfolioId) query.eq("portfolio_id", portfolioId);
    if (securityKey) query.eq("security_key", securityKey);
    const { data, error } = await query;
    if (error) return { data: [] as MarketHistoryPrice[], error };
    rows.push(...data);
    if (data.length < 1000) return { data: deduplicateMarketHistory(rows), error: null };
  }
}));
