import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildCurrentAnalytics } from "@/lib/analytics/portfolio";
import { presentationFactor, scaleTransaction } from "@/lib/analytics/presentation";
import { measureAnalytics } from "@/lib/performance";
import type { Database } from "@/types/database";
import type { AnalyticsTransactionComponent } from "@/lib/analytics/engine";

export const presentationCookie = "alpha-presentation";
export const presentationEnabled = cache(async () => (await cookies()).get(presentationCookie)?.value === "1");
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionWithComponents = Transaction & { components?: AnalyticsTransactionComponent[] };

// React cache deduplicates within one server render, never across users or requests.
const sourceTransactions = cache(async (portfolioId?: string) => measureAnalytics("transactions.read", async () => {
  const supabase = await createClient();
  const rows: TransactionWithComponents[] = [];
  for (let offset = 0; ; offset += 1000) {
    const query = supabase.from("transactions").select("*,components:transaction_components(component_type,amount,currency)")
      .order("trade_date").order("created_at").order("id").range(offset, offset + 999);
    if (portfolioId) query.eq("portfolio_id", portfolioId);
    const { data, error } = await query;
    if (error) throw new Error("Unable to load complete transaction history.");
    rows.push(...((data ?? []) as unknown as TransactionWithComponents[]));
    if (!data || data.length < 1000) return rows;
  }
}));

const scaleFactor = cache(async () => {
  const rows = await sourceTransactions();
  if (rows.some((row) => row.currency !== "EUR")) {
    throw new Error("Presentation mode requires EUR transactions.");
  }
  const { summary } = buildCurrentAnalytics(rows, [], []);
  return presentationFactor(summary.investedCapital);
});

export async function validatePresentation() { await scaleFactor(); }

export async function requireActualDataMode() {
  if (await presentationEnabled()) {
    throw new Error("Leave presentation mode before changing data.");
  }
}

export async function presentationTransactions(portfolioId?: string, options: { type?: string; page?: number; pageSize?: number } = {}) {
  const enabled = await presentationEnabled();
  const factor = enabled ? await scaleFactor() : 1;
  let rows = (await sourceTransactions(enabled ? undefined : portfolioId)).filter((row) =>
    (!portfolioId || row.portfolio_id === portfolioId) && (!options.type || row.type === options.type));
  const count = rows.length;
  if (options.page) {
    const size = options.pageSize ?? 50;
    rows = rows.toReversed().slice((options.page - 1) * size, options.page * size);
  } else if (options.type === "dividend") rows = rows.toReversed();
  return { data: enabled ? rows.map((row) => scaleTransaction(row, factor)) : rows, error: null, count };
}
