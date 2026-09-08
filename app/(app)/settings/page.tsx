import Link from "next/link";
import { presentationEnabled } from "@/lib/presentation";
import { PresentationSettings } from "@/components/presentation-settings";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ portfolio?: string }> }) {
  const { portfolio } = await searchParams;
  const presenting = await presentationEnabled();
  const marketDataHref = portfolio ? `/market-data?portfolio=${encodeURIComponent(portfolio)}` : "/market-data";
  return <div className="space-y-8"><header className="border-b border-border/70 pb-7"><p className="alpha-kpi-label">Workspace</p><h1 className="mt-2 text-3xl font-medium">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Supporting controls remain intentionally restrained while the analytical experience takes priority.</p></header><section className="space-y-4"><div className="alpha-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-medium">Market data</h2><p className="mt-1 text-sm text-muted-foreground">Manage provider symbols, coverage, and controlled price synchronization.</p></div><Link href={marketDataHref} className="alpha-focus inline-flex rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted">Open Market Data</Link></div><div className="alpha-surface p-5"><h2 className="font-medium">More settings</h2><PresentationSettings enabled={presenting} /></div></section></div>;
}
