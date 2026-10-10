import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { uniqueSplits, type SecuritySplit } from "@/lib/analytics/splits";

export const readSecuritySplits = cache(async (portfolioId?: string) => {
  const supabase = await createClient();
  const rows: { portfolio_id: string; security_key: string; split_date: string; numerator: number; denominator: number }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = supabase.from("market_splits").select("portfolio_id,security_key,split_date,numerator,denominator")
      .order("split_date").order("id").range(offset, offset + 999);
    if (portfolioId) query.eq("portfolio_id", portfolioId);
    const { data, error } = await query;
    if (error) throw new Error("Stock split history could not be loaded. Apply the stock split migration first.");
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const byPortfolio = new Map<string, SecuritySplit[]>();
  for (const row of rows) {
    const group = byPortfolio.get(row.portfolio_id) ?? [];
    group.push({ securityKey: row.security_key, date: row.split_date, numerator: Number(row.numerator), denominator: Number(row.denominator) });
    byPortfolio.set(row.portfolio_id, group);
  }
  return new Map([...byPortfolio].map(([id, splits]) => [id, uniqueSplits(splits)]));
});
