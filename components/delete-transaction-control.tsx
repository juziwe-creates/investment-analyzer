"use client";

import { useEffect, useRef, useState } from "react";
import { deleteTransaction } from "@/app/actions/transactions";

export function DeleteTransactionControl({ transactionId, portfolioId, onDeleted }: { transactionId: string; portfolioId?: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirming) cancelRef.current?.focus(); }, [confirming]);
  async function remove() {
    if (pending) return;
    setPending(true); setError(null);
    try {
      const result = await deleteTransaction(transactionId, portfolioId);
      if (result.error) setError(result.error);
      else onDeleted();
    } catch { setError("Deletion failed. Check your connection and leave presentation mode before trying again."); }
    finally { setPending(false); }
  }
  return <div className="mt-6 border-t border-border pt-4">
    {!confirming ? <button ref={triggerRef} type="button" className="alpha-focus rounded-md px-2 py-2 text-sm text-destructive" onClick={() => setConfirming(true)}>Delete transaction</button> : <section aria-labelledby="delete-confirmation-title" aria-describedby="delete-confirmation-description">
      <h3 id="delete-confirmation-title" className="font-medium">Delete transaction?</h3>
      <p id="delete-confirmation-description" className="mt-2 text-sm leading-6 text-muted-foreground">This transaction will be permanently removed. Portfolio values, lots, returns and dividend analytics will be recalculated. Original source documents will be retained.</p>
      <div className="mt-4 flex flex-wrap gap-3"><button ref={cancelRef} type="button" disabled={pending} className="alpha-focus min-h-11 rounded-md border border-border px-4 text-sm disabled:opacity-50" onClick={() => { setConfirming(false); setError(null); requestAnimationFrame(() => triggerRef.current?.focus()); }}>Cancel</button><button type="button" disabled={pending} className="alpha-focus min-h-11 rounded-md bg-destructive px-4 text-sm text-destructive-foreground disabled:opacity-50" onClick={remove}>{pending ? "Deleting..." : "Delete transaction"}</button></div>
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>}
  </div>;
}
