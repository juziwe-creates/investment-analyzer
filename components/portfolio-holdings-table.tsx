import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import type { PortfolioHolding } from "@/lib/analytics/portfolio";

type PortfolioHoldingsTableProps = {
  holdings: PortfolioHolding[];
};

export function PortfolioHoldingsTable({ holdings }: PortfolioHoldingsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current holdings</CardTitle>
        <CardDescription>
          Open positions derived from buy and sell transactions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {holdings.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            Add buy transactions and prices to see current holdings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Security</th>
                  <th className="px-3 py-2 text-right font-medium">Quantity</th>
                  <th className="px-3 py-2 text-right font-medium">Invested capital</th>
                  <th className="px-3 py-2 text-right font-medium">Latest price</th>
                  <th className="px-3 py-2 text-right font-medium">Market value</th>
                  <th className="px-3 py-2 text-right font-medium">Gain/loss</th>
                  <th className="px-3 py-2 text-right font-medium">Dividends</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Total gain incl. dividends
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Total return</th>
                  <th className="px-3 py-2 text-right font-medium">Annualized return</th>
                  <th className="px-3 py-2 font-medium">Price date</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.securityKey} className="border-b last:border-0">
                    <td className="px-3 py-3 font-medium">{holding.securityName}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(holding.quantity)}</td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(holding.investedCapital, holding.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(holding.latestPrice, holding.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(holding.marketValue, holding.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(holding.investmentGain, holding.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(holding.dividendsReceived, holding.currency)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {formatCurrency(holding.totalProfitability, holding.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatPercent(holding.totalReturnPercent)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatPercent(holding.annualizedReturnPercent)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {holding.priceDate ? formatDate(holding.priceDate) : "Add price"}
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
