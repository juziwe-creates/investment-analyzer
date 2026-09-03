import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { createClient } from "@/lib/supabase/server";

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data: recentTransactions, error: recentTransactionsError } = await supabase
    .from("transactions")
    .select("*")
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-8">
      <header className="border-b border-border/70 pb-6">
        <p className="alpha-kpi-label">Source of truth</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em]">Transactions</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Your private event log. Portfolio, dividends, securities, and analytics derive from this.
        </p>
      </header>

      {message ? (
        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      {recentTransactionsError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {recentTransactionsError.message}
        </div>
      ) : null}

      <TransactionForm />
      <TransactionList transactions={recentTransactions ?? []} />
    </div>
  );
}
