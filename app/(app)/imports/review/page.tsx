import Link from "next/link";
import { approveComdirectImport, ignoreComdirectImport } from "@/app/actions/comdirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import type { TransactionCandidate } from "@/lib/import/comdirect/types";

function amount(value: number | null, currency: string | null) {
  return value === null ? "Unavailable" : new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "EUR" }).format(value);
}

export default async function ImportReviewPage({ searchParams }: { searchParams: Promise<{ message?: string; portfolio?: string }> }) {
  const { message, portfolio } = await searchParams;
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("import_rows")
    .select("id,normalized_payload,validation_result,error_message,created_at,source_document_id,import_runs!inner(portfolio_id),source_documents(original_filename,normalized_document_type)")
    .eq("status", "review").order("created_at", { ascending: true }).limit(100);
  const filtered = portfolio ? rows?.filter((row) => (row.import_runs as unknown as { portfolio_id: string }).portfolio_id === portfolio) : rows;

  return <div className="space-y-7">
    <header className="border-b border-border/70 pb-7"><p className="alpha-kpi-label">Human validation</p><h1 className="mt-2 text-3xl font-medium">Import review</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Only ambiguous or unsupported documents stop here. Confirm the parsed facts or ignore the document; nothing enters the ledger before approval.</p><Button asChild variant="link" className="mt-3 h-auto px-0"><Link href={`/imports${portfolio ? `?portfolio=${encodeURIComponent(portfolio)}` : ""}`}>Back to imports</Link></Button></header>
    {message ? <div className="alpha-surface px-4 py-3 text-sm text-muted-foreground">{message}</div> : null}
    {error ? <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error.message}</div> : null}
    <div className="space-y-5">{filtered?.length ? filtered.map((row) => {
      const candidate = row.normalized_payload as unknown as TransactionCandidate | null;
      const document = row.source_documents as unknown as { original_filename: string | null; normalized_document_type: string | null } | null;
      return <article key={row.id} className="alpha-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{candidate?.securityName || document?.original_filename || "Unsupported document"}</p><p className="mt-1 text-xs text-muted-foreground">{document?.normalized_document_type?.replaceAll("_", " ") || "unknown type"}</p></div>{row.source_document_id ? <Button asChild size="sm" variant="outline"><Link href={`/api/imports/documents/${row.source_document_id}`} target="_blank">Open original</Link></Button> : null}</div>
        {row.error_message ? <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{row.error_message}</p> : null}
        {candidate ? <form action={approveComdirectImport} className="mt-5 grid gap-4 md:grid-cols-3">
          <input type="hidden" name="row_id" value={row.id} />{portfolio ? <input type="hidden" name="portfolio" value={portfolio} /> : null}
          <label className="space-y-1 text-xs text-muted-foreground md:col-span-2">Security<Input name="security_name" defaultValue={candidate.securityName ?? ""} required /></label>
          <label className="space-y-1 text-xs text-muted-foreground">Trade date<Input name="trade_date" type="date" defaultValue={candidate.tradeDate ?? ""} required /></label>
          <label className="space-y-1 text-xs text-muted-foreground">Quantity<Input name="quantity" type="number" step="any" defaultValue={candidate.quantity ?? ""} required /></label>
          <label className="space-y-1 text-xs text-muted-foreground">Unit price<Input name="unit_price" type="number" step="any" defaultValue={candidate.unitPrice ?? ""} /></label>
          <label className="space-y-1 text-xs text-muted-foreground">Gross amount<Input name="gross_amount" type="number" step="any" defaultValue={candidate.grossAmount ?? ""} required /></label>
          <label className="space-y-1 text-xs text-muted-foreground">Net amount<Input name="net_amount" type="number" step="any" defaultValue={candidate.netAmount ?? ""} required /></label>
          <div className="flex items-end text-sm text-muted-foreground">{candidate.type} · {amount(candidate.netAmount, candidate.currency)}</div>
          <div className="flex items-end"><Button type="submit">Approve and import</Button></div>
        </form> : <p className="mt-4 text-sm text-muted-foreground">This document has no safe transaction candidate. It can be retained for audit or ignored.</p>}
        <form action={ignoreComdirectImport} className="mt-3"><input type="hidden" name="row_id" value={row.id} />{portfolio ? <input type="hidden" name="portfolio" value={portfolio} /> : null}<Button type="submit" size="sm" variant="ghost">Ignore document</Button></form>
      </article>;
    }) : <div className="alpha-surface px-5 py-12 text-center text-sm text-muted-foreground">The review queue is clear.</div>}</div>
  </div>;
}
