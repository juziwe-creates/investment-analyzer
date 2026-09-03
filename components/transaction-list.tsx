import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import type { Database } from "@/types/database";

type Transaction = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  | "id"
  | "type"
  | "trade_date"
  | "security_name"
  | "isin"
  | "ticker"
  | "quantity"
  | "unit_price"
  | "gross_amount"
  | "net_amount"
  | "currency"
>;

type TransactionListProps = {
  transactions: Transaction[];
};

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction history</CardTitle>
        <CardDescription>
          Private source-of-truth events for your portfolio analytics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            No transactions yet. Add your first buy, sell, or dividend above.
          </div>
        ) : (
          <table className="alpha-table min-w-[900px]">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Security</th>
                  <th className="px-3 py-2 font-medium">ISIN / Ticker</th>
                  <th className="px-3 py-2 text-right font-medium">Quantity</th>
                  <th className="px-3 py-2 text-right font-medium">Unit price</th>
                  <th className="px-3 py-2 text-right font-medium">Gross</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b last:border-0">
                    <td className="px-3 py-3">{formatDate(transaction.trade_date)}</td>
                    <td className="px-3 py-3 capitalize">{transaction.type}</td>
                    <td className="px-3 py-3 font-medium">{transaction.security_name}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {transaction.isin ?? transaction.ticker ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-right">{formatNumber(transaction.quantity)}</td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(transaction.unit_price, transaction.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(transaction.gross_amount, transaction.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(transaction.net_amount, transaction.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
