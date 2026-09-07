"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export type DecisionDrawerMetric = { label: string; value: string };

export function DecisionDrawer({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  metrics,
  note
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  subtitle?: string;
  metrics: DecisionDrawerMetric[];
  note?: string;
}) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button type="button" className="absolute inset-0 bg-foreground/20" aria-label="Close decision details" onClick={onClose} />
      <aside ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="decision-drawer-title" className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l border-border bg-card p-6 shadow-[0_0_60px_hsl(var(--foreground)/0.16)]">
        <div className="flex items-start justify-between gap-4">
          <div><p className="alpha-kpi-label">{eyebrow}</p><h2 id="decision-drawer-title" className="mt-2 text-2xl font-medium">{title}</h2>{subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}</div>
          <button type="button" onClick={onClose} className="alpha-focus rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Close decision details"><X className="h-4 w-4" /></button>
        </div>
        <dl className="mt-8 divide-y divide-border/70 border-y border-border/70">
          {metrics.map((metric) => <div key={metric.label} className="flex items-baseline justify-between gap-6 py-3"><dt className="text-sm text-muted-foreground">{metric.label}</dt><dd className="text-right font-medium tabular-nums">{metric.value}</dd></div>)}
        </dl>
        {note ? <p className="mt-5 text-xs leading-5 text-muted-foreground">{note}</p> : null}
      </aside>
    </div>
  );
}
