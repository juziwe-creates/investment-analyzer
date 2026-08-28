import { upsertManualSecurityPrice } from "@/app/actions/prices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/types/database";

type UserSecurity = Database["public"]["Views"]["user_securities"]["Row"];
type ManualSecurityPrice = Database["public"]["Tables"]["manual_security_prices"]["Row"];

type SecurityPriceFormProps = {
  security: UserSecurity;
  price?: ManualSecurityPrice;
};

export function SecurityPriceForm({ security, price }: SecurityPriceFormProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={upsertManualSecurityPrice} className="flex min-w-[300px] gap-2">
      <input type="hidden" name="portfolio_id" value={security.portfolio_id} />
      <input type="hidden" name="security_key" value={security.security_key} />
      <input type="hidden" name="security_name" value={security.security_name} />
      <input type="hidden" name="isin" value={security.isin ?? ""} />
      <input type="hidden" name="ticker" value={security.ticker ?? ""} />
      <Input
        aria-label={`Current price for ${security.security_name}`}
        name="price"
        type="number"
        min="0"
        step="any"
        defaultValue={price?.price ?? ""}
        placeholder="Price"
        required
      />
      <Input
        aria-label={`Currency for ${security.security_name}`}
        name="currency"
        maxLength={3}
        defaultValue={price?.currency ?? security.security_currency ?? "EUR"}
        required
      />
      <Input
        aria-label={`Price date for ${security.security_name}`}
        name="price_date"
        type="date"
        defaultValue={price?.price_date ?? today}
        required
      />
      <Button type="submit" variant="outline">
        Save
      </Button>
    </form>
  );
}

