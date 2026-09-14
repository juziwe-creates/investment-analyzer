import { PortfolioDevelopmentChart } from "@/components/portfolio-development-chart";
import { CapitalDeploymentChart } from "@/components/capital-deployment-chart";
import { TimeViewportData } from "@/components/time-viewport";
import type { loadDashboardHistory } from "@/lib/analytics/dashboard-history";
import { AlphaProgress } from "@/components/alpha-progress";

type Props = { history: ReturnType<typeof loadDashboardHistory> };

export function HistoryLoading({ label }: { label: string }) {
  return <div className="flex h-[440px] items-center justify-center rounded-md bg-muted/40"><AlphaProgress size="large" status={`Loading ${label}`} /></div>;
}

export async function DashboardPerformance({ history }: Props) {
  const { development, deployment, annual, error } = await history;
  return <><TimeViewportData dates={[...development, ...deployment, ...annual].map((point) => point.date)} />{error ? <p role="alert" className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">{error}</p> : <PortfolioDevelopmentChart points={development} />}</>;
}

export async function DashboardCapitalDeployment({ history }: Props) {
  const { deployment, annual, rows, error } = await history;
  return error ? <p role="alert" className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">{error}</p> : <CapitalDeploymentChart points={deployment} annual={annual} transactions={rows} />;
}
