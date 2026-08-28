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
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(
      "id,type,trade_date,security_name,isin,ticker,quantity,unit_price,gross_amount,net_amount,currency"
    )
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Transactions</h2>
        <p className="text-muted-foreground">
          Your private event log. Portfolio, dividends, securities, and analytics derive from this.
        </p>
      </div>

      {message ? (
        <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      <TransactionForm />
      <TransactionList transactions={transactions ?? []} />
    </div>
  );
}
