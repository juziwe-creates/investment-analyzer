"use client";

import { useState } from "react";
import { setPresentation } from "@/app/actions/presentation";

export function PresentationSettings({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div className="mt-4 space-y-3">
    <label className="flex items-center justify-between gap-4">
      <span>Scale to 1 million deployed capital</span>
      <input type="checkbox" role="switch" checked={enabled} disabled={pending}
        className="h-5 w-5 accent-primary"
        onChange={async (event) => {
          setPending(true);
          try {
            const result = await setPresentation(event.target.checked);
            if (result.error) { setError(result.error); setPending(false); }
            else window.location.reload();
          } catch { setError("Setting could not be changed. Please try again."); setPending(false); }
        }} />
    </label>
    <p className="text-sm text-muted-foreground">Scales all accounts together for presentation. Quantities and money totals change; per-share prices and dates stay the same. Your stored records remain unchanged.</p>
    <p className="text-xs text-muted-foreground">Only the on/off preference is held in a session cookie. The scale and presentation amounts are calculated in memory.</p>
    {pending && <p role="status" className="text-sm">Updating presentation mode...</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
