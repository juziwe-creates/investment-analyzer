import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityPriceForm } from "@/components/security-price-form";
import { formatDate } from "@/lib/formatters";
import type { Database } from "@/types/database";

type UserSecurity = Database["public"]["Views"]["user_securities"]["Row"];
type ManualSecurityPrice = Database["public"]["Tables"]["manual_security_prices"]["Row"];

type SecurityListProps = {
  securities: UserSecurity[];
  prices: ManualSecurityPrice[];
};

export function SecurityList({ securities, prices }: SecurityListProps) {
  const pricesBySecurity = new Map(prices.map((price) => [price.security_key, price]));

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">ISIN</th>
                  <th className="px-3 py-2 font-medium">Ticker</th>
                  <th className="px-3 py-2 font-medium">Exchange</th>
                  <th className="px-3 py-2 font-medium">Currency</th>
                  <th className="px-3 py-2 text-right font-medium">Transactions</th>
                  <th className="px-3 py-2 font-medium">First seen</th>
                  <th className="px-3 py-2 font-medium">Latest price</th>
                </tr>
              </thead>
              <tbody>
                {securities.map((security) => (
                  <tr key={security.security_key} className="border-b last:border-0">
                    <td className="px-3 py-3 font-medium">{security.security_name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{security.isin ?? "-"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{security.ticker ?? "-"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{security.exchange ?? "-"}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {security.security_currency ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-right">{security.transaction_count}</td>
                    <td className="px-3 py-3">{formatDate(security.first_trade_date)}</td>
                    <td className="px-3 py-3">
                      <SecurityPriceForm
                        security={security}
                        price={pricesBySecurity.get(security.security_key)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
