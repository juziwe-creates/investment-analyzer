import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { SecurityActivityWithoutBuyHistory } from "@/lib/analytics/portfolio";

type MissingBuyHistoryTableProps = {
  securities: SecurityActivityWithoutBuyHistory[];
};

export function MissingBuyHistoryTable({ securities }: MissingBuyHistoryTableProps) {
  if (securities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Missing buy history</CardTitle>
        <CardDescription>
          These securities have dividend or sell transactions, but no buy transactions yet.
          They are not counted as current holdings until their buy history is imported.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Security</th>
                <th className="px-3 py-2 font-medium">ISIN</th>
                <th className="px-3 py-2 font-medium">Ticker</th>
                <th className="px-3 py-2 text-right font-medium">Dividends</th>
                <th className="px-3 py-2 text-right font-medium">Total dividends</th>
                <th className="px-3 py-2 font-medium">Latest activity</th>
              </tr>
            </thead>
            <tbody>
              {securities.map((security) => (
                <tr key={security.securityKey} className="border-b last:border-0">
                  <td className="px-3 py-3 font-medium">{security.securityName}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {security.isin ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {security.ticker ?? "-"}
                  </td>
                  <td className="px-3 py-3 text-right">{security.dividendCount}</td>
                  <td className="px-3 py-3 text-right">
                    {formatCurrency(security.totalDividends, security.currency)}
                  </td>
                  <td className="px-3 py-3">{formatDate(security.latestTransactionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
