import {
  saveSecurityProviderSymbol,
  syncSecurityMarketData
} from "@/app/actions/market-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { marketDataProviderSymbol } from "@/lib/market-data/symbols";
import type { SecurityInventoryItem } from "@/lib/analytics/portfolio";
import type { Database } from "@/types/database";

type SecurityProviderSymbol =
  Database["public"]["Tables"]["security_provider_symbols"]["Row"];
type LatestMarketPrice =
  Database["public"]["Views"]["latest_provider_market_prices"]["Row"];
type MarketDataSyncRun =
  Database["public"]["Tables"]["market_data_sync_runs"]["Row"];
type MarketPriceCoverage =
  Database["public"]["Views"]["market_price_coverage"]["Row"];
type MarketDividendCoverage =
  Database["public"]["Views"]["market_dividend_coverage"]["Row"];

type MarketDataFilter =
  | "all"
  | "owned"
  | "missing-symbol"
  | "missing-prices"
  | "missing-dividends"
  | "failed"
  | "needs-sync";

type MarketDataSyncTableProps = {
  filter?: string;
  providerId: string;
  query?: string;
  securities: SecurityInventoryItem[];
  providerSymbols: SecurityProviderSymbol[];
  marketPrices: LatestMarketPrice[];
  priceCoverage: MarketPriceCoverage[];
  dividendCoverage: MarketDividendCoverage[];
  syncRuns: MarketDataSyncRun[];
};

const recentSyncWindowMs = 18 * 60 * 60 * 1000;

function latestRunForSecurity(
  syncRuns: MarketDataSyncRun[],
  securityKey: string,
  providerId: string
) {
  return syncRuns.find(
    (run) => run.security_key === securityKey && run.provider === providerId
  );
}

function selectedFilter(value: string | undefined): MarketDataFilter {
  if (
    value === "owned" ||
    value === "missing-symbol" ||
    value === "missing-prices" ||
    value === "missing-dividends" ||
    value === "failed" ||
    value === "needs-sync"
  ) {
    return value;
  }

  return "all";
}

function isRecentlySynced(syncRun: MarketDataSyncRun | undefined) {
  if (!syncRun || syncRun.status === "failed") {
    return false;
  }

  const timestamp = Date.parse(syncRun.finished_at ?? syncRun.started_at);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp < recentSyncWindowMs;
}

function formatCoverageDateRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) {
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  }

  if (startDate) {
    return `From ${formatDate(startDate)}`;
  }

  if (endDate) {
    return `Until ${formatDate(endDate)}`;
  }

  return "-";
}

export function MarketDataSyncTable({
  filter,
  providerId,
  query,
  securities,
  providerSymbols,
  marketPrices,
  priceCoverage,
  dividendCoverage,
  syncRuns
}: MarketDataSyncTableProps) {
  const activeFilter = selectedFilter(filter);
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const symbolsBySecurity = new Map(
    providerSymbols.map((symbol) => [symbol.security_key, symbol])
  );
  const pricesBySecurity = new Map(
    marketPrices.map((price) => [price.security_key, price])
  );
  const priceCoverageBySecurity = new Map(
    priceCoverage.map((coverage) => [coverage.security_key, coverage])
  );
  const dividendCoverageBySecurity = new Map(
    dividendCoverage.map((coverage) => [coverage.security_key, coverage])
  );
  const rows = securities
    .map((security) => {
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
      const priceCoverageRow = priceCoverageBySecurity.get(security.security_key);
      const dividendCoverageRow = dividendCoverageBySecurity.get(security.security_key);
      const syncRun = latestRunForSecurity(
        syncRuns,
        security.security_key,
        providerId
      );
      const failedSync =
        syncRun?.status === "failed" || syncRun?.status === "completed_with_errors";
      const missingSymbol = !providerSymbol;
      const missingPrices = !priceCoverageRow || priceCoverageRow.price_count === 0;
      const missingDividends =
        !dividendCoverageRow || dividendCoverageRow.dividend_count === 0;
      const recentlySynced = isRecentlySynced(syncRun);

      return {
        security,
        storedSymbol,
        suggestedSymbol,
        providerSymbol,
        marketPrice,
        priceCoverage: priceCoverageRow,
        dividendCoverage: dividendCoverageRow,
        syncRun,
        failedSync,
        missingSymbol,
        missingPrices,
        missingDividends,
        recentlySynced
      };
    })
    .filter((row) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        row.security.security_name,
        row.security.isin,
        row.security.wkn,
        row.security.ticker,
        row.security.exchange,
        row.providerSymbol
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    })
    .filter((row) => {
      if (activeFilter === "owned") {
        return row.security.ownedQuantity > 0;
      }

      if (activeFilter === "missing-symbol") {
        return row.missingSymbol;
      }

      if (activeFilter === "missing-prices") {
        return row.missingPrices;
      }

      if (activeFilter === "missing-dividends") {
        return row.missingDividends;
      }

      if (activeFilter === "failed") {
        return row.failedSync;
      }

      if (activeFilter === "needs-sync") {
        return row.missingSymbol || row.missingPrices || row.failedSync;
      }

      return true;
    });
  const storedSymbolCount = providerSymbols.length;
  const pricedSecurityCount = priceCoverage.filter(
    (coverage) => coverage.price_count > 0
  ).length;
  const failedSyncCount = syncRuns.filter(
    (run) => run.status === "failed" || run.status === "completed_with_errors"
  ).length;

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
          <div className="space-y-4">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Shown</p>
                <p className="text-lg font-semibold">{rows.length} / {securities.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Stored symbols</p>
                <p className="text-lg font-semibold">{storedSymbolCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">With prices</p>
                <p className="text-lg font-semibold">{pricedSecurityCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Recent issues</p>
                <p className="text-lg font-semibold">{failedSyncCount}</p>
              </div>
            </div>

            <form className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_220px_auto_auto]">
              <div>
                <Label htmlFor="market-data-query">Search</Label>
                <Input
                  id="market-data-query"
                  name="q"
                  defaultValue={query}
                  placeholder="Name, ISIN, WKN, ticker"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="market-data-filter">Filter</Label>
                <select
                  id="market-data-filter"
                  name="filter"
                  defaultValue={activeFilter}
                  className="mt-2 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All securities</option>
                  <option value="owned">Owned only</option>
                  <option value="missing-symbol">Missing provider symbol</option>
                  <option value="missing-prices">Missing prices</option>
                  <option value="missing-dividends">Missing dividends</option>
                  <option value="failed">Failed or warning sync</option>
                  <option value="needs-sync">Needs attention</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit">Apply</Button>
              </div>
              <div className="flex items-end">
                <Button asChild type="button" variant="outline">
                  <Link href="/market-data">Reset</Link>
                </Button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Security</th>
                  <th className="px-3 py-2 font-medium">Identity</th>
                  <th className="px-3 py-2 text-right font-medium">Owned</th>
                  <th className="px-3 py-2 font-medium">Transaction ticker</th>
                  <th className="px-3 py-2 font-medium">Provider symbol</th>
                  <th className="px-3 py-2 font-medium">Price coverage</th>
                  <th className="px-3 py-2 font-medium">Dividend coverage</th>
                  <th className="px-3 py-2 font-medium">Last sync</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const {
                    security,
                    storedSymbol,
                    suggestedSymbol,
                    providerSymbol,
                    marketPrice,
                    priceCoverage: priceCoverageRow,
                    dividendCoverage: dividendCoverageRow,
                    syncRun,
                    recentlySynced
                  } = row;
                  const marketPriceValue = marketPrice
                    ? marketPrice.adjusted_close_price ?? marketPrice.close_price
                    : null;

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
                        {priceCoverageRow ? (
                          <div>
                            <div className="font-medium">
                              {formatNumber(priceCoverageRow.price_count)} prices
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCoverageDateRange(
                                priceCoverageRow.first_price_date,
                                priceCoverageRow.latest_price_date
                              )}
                            </div>
                            {marketPrice ? (
                              <div className="text-xs text-muted-foreground">
                                Latest: {formatCurrency(marketPriceValue, marketPrice.currency)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not synced</span>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        {dividendCoverageRow ? (
                          <div>
                            <div className="font-medium">
                              {formatNumber(dividendCoverageRow.dividend_count)} dividends
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCoverageDateRange(
                                dividendCoverageRow.first_ex_dividend_date,
                                dividendCoverageRow.latest_ex_dividend_date
                              )}
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
                            {syncRun.error_message ? (
                              <div className="max-w-64 text-xs text-destructive">
                                {syncRun.error_message}
                              </div>
                            ) : null}
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
                            disabled={!providerSymbol || recentlySynced}
                          >
                            Sync one
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            {recentlySynced
                              ? "Synced recently"
                              : "Estimated calls: 2"}
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            {rows.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No securities match the current filters.
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
