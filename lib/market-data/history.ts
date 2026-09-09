import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Price = Database["public"]["Tables"]["market_prices"]["Row"];

export async function readMarketHistory(portfolioId?: string, securityKey?: string) {
  const supabase = await createClient();
  const rows: Price[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = supabase.from("market_prices").select("*").order("price_date").order("id").range(offset, offset + 999);
    if (portfolioId) query.eq("portfolio_id", portfolioId);
    if (securityKey) query.eq("security_key", securityKey);
    const { data, error } = await query;
    if (error) return { data: [] as Price[], error };
    rows.push(...data);
    if (data.length < 1000) return { data: rows, error: null };
  }
}
