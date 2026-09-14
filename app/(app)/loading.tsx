import { RouteProgress } from "@/components/alpha-progress";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function AppLoading() {
  return <div className="space-y-8"><div className="space-y-3 border-b border-border/70 pb-7"><Bar className="h-3 w-24" /><Bar className="h-10 w-72 max-w-full" /><Bar className="h-4 w-96 max-w-full" /></div><RouteProgress /></div>;
}
