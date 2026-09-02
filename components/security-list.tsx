import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityMarketDataForm } from "@/components/security-market-data-form";
import { SecurityPriceForm } from "@/components/security-price-form";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import type { SecurityInventoryItem } from "@/lib/analytics/portfolio";
import type { Database } from "@/types/database";

type ManualSecurityPrice = Database["public"]["Tables"]["manual_security_prices"]["Row"];
type LatestMarketPrice = Database["public"]["Views"]["latest_market_prices"]["Row"];

type SecurityListProps = {
  securities: SecurityInventoryItem[];
  prices: ManualSecurityPrice[];
  marketPrices: LatestMarketPrice[];
};

export function SecurityList({
  securities,
  prices,
  marketPrices
}: SecurityListProps) {
  const pricesBySecurity = new Map(prices.map((price) => [price.security_key, price]));
  const marketPricesBySecurity = new Map(
    marketPrices.map((price) => [price.security_key, price])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discovered securities</CardTitle>
        <CardDescription>
          This read-only list is derived from your private transaction history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {securities.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            Securities will appear here after you add transactions.
          </div>
        ) : (
          <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">Owned quantity</th>
                  <th className="px-3 py-2 font-medium">ISIN</th>
                  <th className="px-3 py-2 font-medium">Ticker</th>
                  <th className="px-3 py-2 font-medium">Exchange</th>
                  <th className="px-3 py-2 font-medium">Currency</th>
                  <th className="px-3 py-2 text-right font-medium">Transactions</th>
                  <th className="px-3 py-2 font-medium">First seen</th>
                  <th className="px-3 py-2 font-medium">Latest market price</th>
                  <th className="px-3 py-2 font-medium">Manual fallback</th>
                  <th className="px-3 py-2 font-medium">Market data</th>
                </tr>
              </thead>
              <tbody>
                {securities.map((security) => {
                  const marketPrice = marketPricesBySecurity.get(security.security_key);
                  const marketPriceValue = marketPrice
                    ? marketPrice.adjusted_close_price ?? marketPrice.close_price
                    : null;

                  return (
                    <tr key={security.security_key} className="border-b last:border-0">
                      <td className="px-3 py-3 font-medium">{security.security_name}</td>
                      <td className="px-3 py-3 text-right">
                        <span className={security.ownedQuantity === 0 ? "text-muted-foreground" : ""}>
                          {formatNumber(security.ownedQuantity)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{security.isin ?? "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{security.ticker ?? "-"}</td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {security.exchange ?? "-"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {security.security_currency ?? "-"}
                      </td>
                      <td className="px-3 py-3 text-right">{security.transaction_count}</td>
                      <td className="px-3 py-3">{formatDate(security.first_trade_date)}</td>
                      <td className="px-3 py-3">
                        {marketPrice ? (
                          <div>
                            <div className="font-medium">
                              {formatCurrency(marketPriceValue, marketPrice.currency)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(marketPrice.price_date)} via {marketPrice.provider}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not synced</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <SecurityPriceForm
                          security={security}
                          price={pricesBySecurity.get(security.security_key)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <SecurityMarketDataForm security={security} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
