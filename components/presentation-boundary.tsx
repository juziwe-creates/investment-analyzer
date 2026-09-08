"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PresentationBoundary({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  const blocked = enabled && ["/imports", "/market-data"].includes(pathname);
  return <div onClickCapture={(event) => {
    // Full navigations prevent reuse of prefetched views from the other mode.
    if (!enabled) return;
    const link = (event.target as Element).closest("a");
    if (!link || link.target === "_blank") return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    event.stopPropagation();
    window.location.assign(url.href);
  }}>
    {enabled && <div role="status" className="border-b border-border bg-muted px-4 py-3 text-sm">
      Presentation mode: all accounts scaled to EUR 1,000,000 current deployed capital.
      <a href="/settings" className="ml-3 underline">Settings</a>
    </div>}
    {blocked ? <p className="p-8">Leave presentation mode in Settings to access imports and market data.</p> : children}
  </div>;
}
