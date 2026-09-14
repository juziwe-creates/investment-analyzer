import "server-only";

export async function measureAnalytics<T>(stage: string, work: () => T | PromiseLike<T>): Promise<T> {
  if (process.env.ANALYTICS_PERF_LOGS !== "1") return await work();
  const started = performance.now();
  let succeeded = false;
  let rows: number | undefined;
  try {
    const result = await work();
    const data = result && typeof result === "object" && "data" in result ? result.data : result;
    if (Array.isArray(data)) rows = data.length;
    succeeded = !(result && typeof result === "object" && "error" in result && result.error);
    return result;
  } finally {
    console.info("[analytics-performance]", JSON.stringify({ stage, durationMs: Math.round(performance.now() - started), rows, succeeded }));
  }
}
