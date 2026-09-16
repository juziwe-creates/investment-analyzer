import Link from "next/link";
import { AnalyticsExperience } from "@/components/analytics-3d/analytics-experience";
import { loadUniverse } from "@/lib/analytics-3d/data";
import { contextHref } from "@/lib/analytics-3d/model";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ portfolio?: string }> }) {
  const { portfolio } = await searchParams;
  let model;
  try { model = await loadUniverse(portfolio); } catch {
    return <section className="space-y-4" aria-labelledby="analytics-title"><h1 id="analytics-title" className="text-3xl">αnalytics</h1><p role="alert">Portfolio data could not be loaded. Reload to retry or choose another account.</p><Link className="alpha-focus underline" href={contextHref("/dashboard", portfolio)}>View portfolio</Link></section>;
  }
  return <AnalyticsExperience key={portfolio ?? "all"} model={model} portfolio={portfolio} />;
}
