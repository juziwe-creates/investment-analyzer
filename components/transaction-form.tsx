import { createManualTransaction } from "@/app/actions/transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TransactionForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add transaction</CardTitle>
        <CardDescription>
          Record the event first. Securities and analytics will be derived from transaction history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createManualTransaction} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                name="type"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                defaultValue="buy"
                required
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="dividend">Dividend</option>
                <option value="fee">Fee</option>
                <option value="tax">Tax</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_date">Trade date</Label>
              <Input id="trade_date" name="trade_date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Cash currency</Label>
              <Input id="currency" name="currency" defaultValue="EUR" maxLength={3} required />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="security_name">Security name</Label>
              <Input
                id="security_name"
                name="security_name"
                placeholder="e.g. Vanguard FTSE All-World"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isin">ISIN</Label>
              <Input id="isin" name="isin" placeholder="IE00B3RBWM25" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticker">Ticker</Label>
              <Input id="ticker" name="ticker" placeholder="VWCE" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="wkn">WKN</Label>
              <Input id="wkn" name="wkn" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchange">Exchange</Label>
              <Input id="exchange" name="exchange" placeholder="XETRA" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="security_currency">Security currency</Label>
              <Input id="security_currency" name="security_currency" defaultValue="EUR" maxLength={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset_type">Asset type</Label>
              <Input id="asset_type" name="asset_type" placeholder="ETF, stock, bond" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" name="quantity" type="number" step="any" min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_price">Unit price</Label>
              <Input id="unit_price" name="unit_price" type="number" step="any" min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gross_amount">Gross amount</Label>
              <Input id="gross_amount" name="gross_amount" type="number" step="any" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fees">Fees</Label>
              <Input id="fees" name="fees" type="number" step="any" min="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxes">Taxes</Label>
              <Input id="taxes" name="taxes" type="number" step="any" min="0" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="net_amount">Net amount</Label>
              <Input id="net_amount" name="net_amount" type="number" step="any" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" placeholder="Optional context" />
            </div>
          </div>

          <Button type="submit">Save transaction</Button>
        </form>
      </CardContent>
    </Card>
  );
}
