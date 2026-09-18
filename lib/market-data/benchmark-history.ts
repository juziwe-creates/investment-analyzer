import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BenchmarkId, BenchmarkObservation } from "@/lib/analytics/benchmarks";

export type BenchmarkHistory = { data: BenchmarkObservation[]; error: string | null };

// Shared reference data is read through the authenticated session, never an admin key.
export const readBenchmarkHistory = cache(async (benchmark: BenchmarkId): Promise<BenchmarkHistory> => {
  const supabase = await createClient();
  const rows: BenchmarkObservation[] = [];
  try {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("benchmark_prices")
        .select("benchmark_id,price_date,observation_date,close_price,currency,series_type,is_derived,is_partial_period")
        .eq("benchmark_id", benchmark).order("price_date").range(offset, offset + 999);
      if (error) return { data: [], error: "Benchmark history could not be loaded. Please try again." };
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) return { data: rows, error: null };
    }
  } catch {
    return { data: [], error: "Benchmark history could not be loaded. Please try again." };
  }
});
