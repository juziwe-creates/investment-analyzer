import { syncSecurityMarketData } from "@/app/actions/market-data";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/database";

type UserSecurity = Database["public"]["Views"]["user_securities"]["Row"];

type SecurityMarketDataFormProps = {
  security: UserSecurity;
};

export function SecurityMarketDataForm({ security }: SecurityMarketDataFormProps) {
  const canSync = Boolean(security.ticker);

  return (
    <form action={syncSecurityMarketData}>
      <input type="hidden" name="portfolio_id" value={security.portfolio_id} />
      <input type="hidden" name="security_key" value={security.security_key} />
      <Button type="submit" variant="outline" size="sm" disabled={!canSync}>
        Sync daily
      </Button>
      {!canSync ? (
        <p className="mt-1 text-xs text-muted-foreground">Ticker required</p>
      ) : null}
    </form>
  );
}
