import { SecurityList } from "@/components/security-list";
import { createClient } from "@/lib/supabase/server";

export default async function SecuritiesPage() {
  const supabase = await createClient();
  const { data: securities, error } = await supabase
    .from("user_securities")
    .select(
      "user_id,portfolio_id,security_key,security_name,isin,wkn,ticker,exchange,security_currency,asset_type,transaction_count,first_trade_date,last_trade_date"
    )
    .order("security_name", { ascending: true });
  const { data: prices, error: pricesError } = await supabase
    .from("manual_security_prices")
    .select(
      "id,user_id,portfolio_id,security_key,security_name,isin,ticker,price,currency,price_date,created_at,updated_at"
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Securities</h2>
        <p className="text-muted-foreground">
          A read-only lookup derived from your transactions. No manual security catalog needed.
        </p>
      </div>

      {error || pricesError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error?.message ?? pricesError?.message}
        </div>
      ) : null}

      <SecurityList securities={securities ?? []} prices={prices ?? []} />
    </div>
  );
}
