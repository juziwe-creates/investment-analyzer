import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BenchmarkId, BenchmarkObservation } from "@/lib/analytics/benchmarks";
import { readPages } from "@/lib/market-data/read-pages";

export type BenchmarkHistory = { data: BenchmarkObservation[]; error: string | null };

// Shared reference data is read through the authenticated session, never an admin key.
export const readBenchmarkHistory = cache(async (benchmark: BenchmarkId): Promise<BenchmarkHistory> => {
  const supabase = await createClient();
  try {
    const result = await readPages<BenchmarkObservation, { message: string }>((offset, count) => supabase.from("benchmark_prices")
      .select("benchmark_id,price_date,observation_date,close_price,currency,frequency,series_type,is_derived,is_partial_period", count ? { count: "exact" } : {})
      .eq("benchmark_id", benchmark).order("price_date").range(offset, offset + 999));
    return { data: result.data, error: result.error ? "Benchmark history could not be loaded. Please try again." : null };
  } catch {
    return { data: [], error: "Benchmark history could not be loaded. Please try again." };
  }
});
