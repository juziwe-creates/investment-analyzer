import { PortfolioDevelopmentChart } from "@/components/portfolio-development-chart";
import { CapitalDeploymentChart } from "@/components/capital-deployment-chart";
import { TimeViewportData } from "@/components/time-viewport";
import type { loadDashboardHistory } from "@/lib/analytics/dashboard-history";

type Props = { history: ReturnType<typeof loadDashboardHistory> };

export function HistoryLoading({ label }: { label: string }) {
  return <div role="status" aria-label={`Loading ${label}`} className="h-[440px] animate-pulse rounded-md bg-muted/40"><span className="sr-only">Loading {label}</span></div>;
}

export async function DashboardPerformance({ history }: Props) {
  const { development, deployment, error } = await history;
  return <><TimeViewportData dates={[...development, ...deployment].map((point) => point.date)} />{error ? <p role="alert" className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">{error}</p> : <PortfolioDevelopmentChart points={development} />}</>;
}

export async function DashboardCapitalDeployment({ history }: Props) {
  const { deployment, error } = await history;
  return error ? <p role="alert" className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">{error}</p> : <CapitalDeploymentChart points={deployment} />;
}
