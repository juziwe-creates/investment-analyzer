import Link from "next/link";
import { FileUp, Inbox, ShieldCheck } from "lucide-react";
import { importComdirectPdfs } from "@/app/actions/comdirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { presentationEnabled } from "@/lib/presentation";
import { createClient } from "@/lib/supabase/server";

function dateTime(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "In progress";
}

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ message?: string; portfolio?: string }> }) {
  const { message, portfolio } = await searchParams;
  const supabase = await createClient();
  const presenting = await presentationEnabled();
  const runsQuery = supabase.from("import_runs").select("id,status,started_at,finished_at,documents_seen,documents_imported,documents_review,documents_ignored,documents_failed,transactions_created")
    .eq("broker", "comdirect").order("started_at", { ascending: false }).limit(10);
  if (portfolio) runsQuery.eq("portfolio_id", portfolio);
  const [{ data: runs, error: runsError }, { count: reviewCount, error: reviewError }] = await Promise.all([
    runsQuery,
    supabase.from("import_rows").select("id", { count: "exact", head: true }).eq("status", "review")
  ]);
  const schemaUnavailable = runsError || reviewError;

  return <div className="space-y-8">
    <header className="border-b border-border/70 pb-7">
      <p className="alpha-kpi-label">Private document ingestion</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-medium">Imports</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Bring comdirect PostBox documents into the transaction ledger with deterministic parsing, validation, and duplicate protection.</p></div>
        <Button asChild variant="outline"><Link href={`/imports/review${portfolio ? `?portfolio=${encodeURIComponent(portfolio)}` : ""}`}><Inbox className="mr-2 h-4 w-4" />Review queue{reviewCount ? ` (${reviewCount})` : ""}</Link></Button>
      </div>
    </header>

    {message ? <div className="alpha-surface px-4 py-3 text-sm text-muted-foreground">{message}</div> : null}
    {schemaUnavailable ? <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">The Comdirect database migration must be applied in Supabase before imports can run. Existing portfolio data is unaffected.</div> : null}

    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Official API connection</CardTitle><CardDescription>Connection status: Not connected</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>The application boundary for OAuth, Session-TAN, metadata paging, and document download is prepared.</p>
          <p>Connection remains disabled until the current authenticated comdirect Swagger or Postman contract is available. No endpoint or authentication behavior is guessed.</p>
          <Button disabled variant="outline">Connect comdirect</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5 text-primary" />Import downloaded PDFs</CardTitle><CardDescription>Operational fallback for PostBox documents already downloaded from comdirect.</CardDescription></CardHeader>
        <CardContent>
          <form action={importComdirectPdfs} className="space-y-4">
            {portfolio ? <input type="hidden" name="portfolio" value={portfolio} /> : null}
            <Input name="documents" type="file" accept="application/pdf,.pdf" multiple required disabled={presenting || Boolean(schemaUnavailable)} />
            <p className="text-xs leading-5 text-muted-foreground">Up to five PDFs and 3 MB per batch. Originals remain private. Extracted document text is processed in memory and is not stored.</p>
            <Button type="submit" disabled={presenting || Boolean(schemaUnavailable)}><FileUp className="mr-2 h-4 w-4" />Import PDFs</Button>
          </form>
        </CardContent>
      </Card>
    </div>

    <section className="space-y-4">
      <div><h2 className="text-xl font-medium">Recent runs</h2><p className="mt-1 text-sm text-muted-foreground">Each batch remains auditable from source document to transaction.</p></div>
      <div className="overflow-x-auto rounded-lg border border-border/80 bg-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border/70 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Started</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Seen</th><th className="px-4 py-3 text-right">Imported</th><th className="px-4 py-3 text-right">Review</th><th className="px-4 py-3 text-right">Ignored</th><th className="px-4 py-3 text-right">Failed</th><th className="px-4 py-3">Finished</th></tr></thead>
          <tbody>{runs?.length ? runs.map((run) => <tr key={run.id} className="border-b border-border/50 last:border-0"><td className="px-4 py-3">{dateTime(run.started_at)}</td><td className="px-4 py-3 font-medium">{run.status.replaceAll("_", " ")}</td><td className="px-4 py-3 text-right tabular-nums">{run.documents_seen}</td><td className="px-4 py-3 text-right tabular-nums">{run.documents_imported}</td><td className="px-4 py-3 text-right tabular-nums">{run.documents_review}</td><td className="px-4 py-3 text-right tabular-nums">{run.documents_ignored}</td><td className="px-4 py-3 text-right tabular-nums">{run.documents_failed}</td><td className="px-4 py-3 text-muted-foreground">{dateTime(run.finished_at)}</td></tr>) : <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No comdirect imports yet.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </div>;
}
