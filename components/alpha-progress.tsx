"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { usePathname } from "next/navigation";
import { AlphaLogo } from "@/components/alpha-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AlphaProgress({ status, active = true, size = "small", overlay = false }: { status: string; active?: boolean; size?: "small" | "large"; overlay?: boolean }) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  useEffect(() => {
    const delay = active ? visible ? 0 : 250 : Math.max(0, 400 - (performance.now() - shownAt.current));
    const timer = setTimeout(() => {
      if (active && !visible) shownAt.current = performance.now();
      setVisible(active);
    }, delay);
    return () => clearTimeout(timer);
  }, [active, visible]);
  if (!visible) return null;
  return <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-2 text-center", size === "large" ? "min-h-64 py-10" : "py-2", overlay && "absolute inset-0 z-10 bg-background/90")}>
    <div aria-hidden="true" className={cn("alpha-progress-mark", size === "large" && "scale-150 mb-3")}><AlphaLogo collapsed /></div>
    <p className="text-sm text-muted-foreground">{status.trim().split(/\s+/).slice(0, 4).join(" ")}</p>
  </div>;
}

export function ProgressSubmit({ status, children, ...props }: ComponentProps<typeof Button> & { status: string }) {
  const { pending } = useFormStatus();
  return <div className="relative"><Button {...props} type="submit" disabled={props.disabled || pending}>{children}</Button><AlphaProgress active={pending} status={status} /></div>;
}

export function RouteProgress() {
  const pathname = usePathname();
  const status = pathname.startsWith("/portfolio/") ? "Loading investment" : ({ "/dashboard": "Loading portfolio", "/portfolio": "Loading investments", "/transactions": "Reading transactions", "/dividends": "Loading dividends", "/market-data": "Loading market data", "/imports": "Loading imports", "/settings": "Loading settings", "/stock-analytics": "Calculating stock returns", "/transaction-analytics": "Calculating lot returns" }[pathname] ?? "Loading portfolio");
  return <AlphaProgress size="large" status={status} />;
}
