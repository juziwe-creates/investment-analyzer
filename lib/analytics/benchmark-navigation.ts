import type { BenchmarkId } from "./benchmarks";

export function investmentDetailHref(securityKey: string, portfolio: string | null, benchmark: BenchmarkId) {
  const params = new URLSearchParams({ benchmark });
  if (portfolio) params.set("portfolio", portfolio);
  return `/portfolio/${encodeURIComponent(securityKey)}?${params}`;
}
