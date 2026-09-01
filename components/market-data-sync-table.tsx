import {
  saveSecurityProviderSymbol,
  syncSecurityMarketData
} from "@/app/actions/market-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { marketDataProviderSymbol } from "@/lib/market-data/symbols";
import type { SecurityInventoryItem } from "@/lib/analytics/portfolio";
import type { Database } from "@/types/database";

type SecurityProviderSymbol =
  Database["public"]["Tables"]["security_provider_symbols"]["Row"];
type LatestMarketPrice = Database["public"]["Views"]["latest_market_prices"]["Row"];
type MarketDataSyncRun =
  Database["public"]["Tables"]["market_data_sync_runs"]["Row"];

type MarketDataSyncTableProps = {
  providerId: string;
  securities: SecurityInventoryItem[];
  providerSymbols: SecurityProviderSymbol[];
  marketPrices: LatestMarketPrice[];
  syncRuns: MarketDataSyncRun[];
};

function latestRunForSecurity(
  syncRuns: MarketDataSyncRun[],
  securityKey: string,
  providerId: string
) {
  return syncRuns.find(
    (run) => run.security_key === securityKey && run.provider === providerId
  );
}

export function MarketDataSyncTable({
  providerId,
  securities,
  providerSymbols,
  marketPrices,
  syncRuns
}: MarketDataSyncTableProps) {
  const symbolsBySecurity = new Map(
    providerSymbols.map((symbol) => [symbol.security_key, symbol])
  );
  const pricesBySecurity = new Map(
    marketPrices.map((price) => [price.security_key, price])
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market data sync</CardTitle>
        <CardDescription>
          Resolve provider symbols deliberately, then sync one security at a time.
          Each sync uses about two provider calls: prices and dividends.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {securities.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
            Market data controls will appear after transactions create securities.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Security</th>
                  <th className="px-3 py-2 font-medium">Identity</th>
                  <th className="px-3 py-2 text-right font-medium">Owned</th>
                  <th className="px-3 py-2 font-medium">Transaction ticker</th>
                  <th className="px-3 py-2 font-medium">Provider symbol</th>
                  <th className="px-3 py-2 font-medium">Latest price</th>
                  <th className="px-3 py-2 font-medium">Last sync</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {securities.map((security) => {
                  const storedSymbol = symbolsBySecurity.get(security.security_key);
                  const suggestedSymbol = security.ticker
                    ? marketDataProviderSymbol({
                        providerId,
                        ticker: security.ticker,
                        exchange: security.exchange
                      })
                    : "";
                  const providerSymbol = storedSymbol?.provider_symbol ?? suggestedSymbol;
                  const marketPrice = pricesBySecurity.get(security.security_key);
                  const marketPriceValue = marketPrice
                    ? marketPrice.adjusted_close_price ?? marketPrice.close_price
                    : null;
                  const syncRun = latestRunForSecurity(
                    syncRuns,
                    security.security_key,
                    providerId
                  );

                  return (
                    <tr key={security.security_key} className="border-b align-top last:border-0">
                      <td className="px-3 py-4">
                        <div className="font-medium">{security.security_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {security.asset_type ?? "security"} - {security.security_currency ?? "-"}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-xs text-muted-foreground">
                        <div>ISIN: {security.isin ?? "-"}</div>
                        <div>WKN: {security.wkn ?? "-"}</div>
                      </td>
                      <td className="px-3 py-4 text-right">
                        {formatNumber(security.ownedQuantity)}
                      </td>
                      <td className="px-3 py-4 text-xs text-muted-foreground">
                        <div>{security.ticker ?? "-"}</div>
                        <div>{security.exchange ?? "-"}</div>
                      </td>
                      <td className="px-3 py-4">
                        <form action={saveSecurityProviderSymbol} className="space-y-2">
                          <input type="hidden" name="return_to" value="/market-data" />
                          <input type="hidden" name="portfolio_id" value={security.portfolio_id} />
                          <input type="hidden" name="security_key" value={security.security_key} />
                          <input type="hidden" name="provider" value={providerId} />
                          <Label className="sr-only" htmlFor={`symbol-${security.security_key}`}>
                            Provider symbol
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`symbol-${security.security_key}`}
                              name="provider_symbol"
                              defaultValue={providerSymbol}
                              placeholder="MSF.XETRA"
                              className="h-8 min-w-36"
                            />
                            <Button type="submit" variant="outline" size="sm">
                              Save
                            </Button>
                          </div>
                          <Input
                            name="notes"
                            defaultValue={storedSymbol?.notes ?? ""}
                            placeholder="Optional mapping note"
                            className="h-8"
                          />
                          <div className="text-xs text-muted-foreground">
                            {storedSymbol
                              ? `Stored ${storedSymbol.source}`
                              : suggestedSymbol
                                ? "Suggested from ticker/exchange"
                                : "No suggestion yet"}
                          </div>
                        </form>
                      </td>
                      <td className="px-3 py-4">
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
                      <td className="px-3 py-4">
                        {syncRun ? (
                          <div>
                            <div className="font-medium">{syncRun.status}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(syncRun.finished_at ?? syncRun.started_at)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {syncRun.prices_imported} prices - {syncRun.dividends_imported} dividends
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No sync yet</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <form action={syncSecurityMarketData} className="space-y-2">
                          <input type="hidden" name="return_to" value="/market-data" />
                          <input type="hidden" name="portfolio_id" value={security.portfolio_id} />
                          <input type="hidden" name="security_key" value={security.security_key} />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!providerSymbol}
                          >
                            Sync one
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            Estimated calls: 2
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
