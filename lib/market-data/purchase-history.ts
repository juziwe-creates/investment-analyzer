type PurchaseQuery = {
  eq(column: string, value: string): PurchaseQuery;
  is(column: string, value: null): PurchaseQuery;
  order(column: string, options: { ascending: boolean }): PurchaseQuery;
  limit(count: number): PromiseLike<{ data: { trade_date: string }[] | null; error: { message: string } | null }>;
};

export async function firstSecurityPurchase(query: PurchaseQuery, userId: string, portfolioId: string, identity: {
  security_key: string; isin: string | null; ticker: string | null;
}) {
  let scoped = query.eq("user_id", userId).eq("portfolio_id", portfolioId).eq("type", "buy");
  // Match the canonical coalesce(isin, ticker, security_name) identity without
  // interpolating provider/user text into a PostgREST expression.
  if (identity.isin === identity.security_key) scoped = scoped.eq("isin", identity.security_key);
  else if (identity.ticker === identity.security_key) scoped = scoped.is("isin", null).eq("ticker", identity.security_key);
  else scoped = scoped.is("isin", null).is("ticker", null).eq("security_name", identity.security_key);
  const { data, error } = await scoped.order("trade_date", { ascending: true }).limit(1);
  if (error) throw new Error(`Purchase history could not be loaded: ${error.message}`);
  const date = data?.[0]?.trade_date;
  if (!date) throw new Error("No purchase was found for this security in this portfolio. Check the transaction identity and portfolio before syncing history.");
  return date;
}
