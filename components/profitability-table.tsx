import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";
import type { LotProfitability } from "@/lib/analytics/profitability";

type ProfitabilityTableProps = {
  lots: LotProfitability[];
};

export function ProfitabilityTable({ lots }: ProfitabilityTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction profitability</CardTitle>
        <CardDescription>
          Buy-lot profitability from current price, open cost basis, allocated dividends, and annualized return.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {lots.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            Add buy transactions to see decision-level profitability.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Buy date</th>
                  <th className="px-3 py-2 font-medium">Security</th>
                  <th className="px-3 py-2 text-right font-medium">Quantity</th>
                  <th className="px-3 py-2 text-right font-medium">Open qty</th>
                  <th className="px-3 py-2 text-right font-medium">Cost basis</th>
                  <th className="px-3 py-2 text-right font-medium">Current value</th>
                  <th className="px-3 py-2 text-right font-medium">Gain/loss</th>
                  <th className="px-3 py-2 text-right font-medium">Dividends</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Return</th>
                  <th className="px-3 py-2 text-right font-medium">Annualized</th>
                  <th className="px-3 py-2 font-medium">Price date</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.id} className="border-b last:border-0">
                    <td className="px-3 py-3">{formatDate(lot.tradeDate)}</td>
                    <td className="px-3 py-3 font-medium">{lot.securityName}</td>
                    <td className="px-3 py-3 text-right">{formatNumber(lot.quantity)}</td>
                    <td className="px-3 py-3 text-right">
                      {formatNumber(lot.remainingQuantity)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(lot.costBasis, lot.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(lot.currentValue, lot.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(lot.unrealizedGainLoss, lot.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(lot.accumulatedDividends, lot.currency)}
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {formatCurrency(lot.totalProfitability, lot.currency)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatPercent(lot.totalReturnPercent)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatPercent(lot.annualizedReturnPercent)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {lot.priceDate ? formatDate(lot.priceDate) : "Add price"}
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
