function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function AppLoading() {
  return <div className="space-y-8" aria-label="Loading page"><div className="space-y-3 border-b border-border/70 pb-7"><Bar className="h-3 w-24" /><Bar className="h-10 w-72 max-w-full" /><Bar className="h-4 w-96 max-w-full" /></div><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="space-y-2"><Bar className="h-3 w-24" /><Bar className="h-7 w-36" /></div>)}</div><Bar className="h-80 w-full" /></div>;
}
