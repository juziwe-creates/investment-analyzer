export const benchmarkOptions = [
  { id: "msci-world", label: "MSCI World" },
  { id: "sp-500", label: "S&P 500" },
  { id: "dax", label: "DAX" }
] as const;

export type BenchmarkId = (typeof benchmarkOptions)[number]["id"];

export function parseBenchmark(value: string | undefined): BenchmarkId {
  return benchmarkOptions.some((option) => option.id === value)
    ? (value as BenchmarkId)
    : "msci-world";
}
