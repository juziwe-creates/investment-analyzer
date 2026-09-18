import { PortfolioDevelopmentChart } from "@/components/portfolio-development-chart";
import { CapitalDeploymentChart } from "@/components/capital-deployment-chart";
import { TimeViewportData } from "@/components/time-viewport";
import type { loadDashboardHistory } from "@/lib/analytics/dashboard-history";
import { AlphaProgress } from "@/components/alpha-progress";
import type { readBenchmarkHistory } from "@/lib/market-data/benchmark-history";
import type { BenchmarkId } from "@/lib/analytics/benchmarks";

type Props = { history: ReturnType<typeof loadDashboardHistory> };

export function HistoryLoading({ label }: { label: string }) {
  return <div className="flex h-[440px] items-center justify-center rounded-md bg-muted/40"><AlphaProgress size="large" status={`Loading ${label}`} /></div>;
}

export async function DashboardPerformance({ history, benchmark, benchmarkHistory }: Props & { benchmark: BenchmarkId; benchmarkHistory: ReturnType<typeof readBenchmarkHistory> }) {
  const [{ development, deployment, annual, error }, reference] = await Promise.all([history, benchmarkHistory]);
  return <><TimeViewportData dates={[...development, ...deployment, ...annual].map((point) => point.date)} />{error ? <p role="alert" className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">{error}</p> : <PortfolioDevelopmentChart points={development} benchmark={benchmark} benchmarkHistory={reference.data} benchmarkError={reference.error} />}</>;
}

export async function DashboardCapitalDeployment({ history }: Props) {
  const { deployment, annual, rows, error } = await history;
  return error ? <p role="alert" className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">{error}</p> : <CapitalDeploymentChart points={deployment} annual={annual} transactions={rows} />;
}
