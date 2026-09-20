import type { Database } from "./database";

export type MarketHistoryPrice = Pick<Database["public"]["Tables"]["market_prices"]["Row"],
  "id" | "security_key" | "price_date" | "close_price" | "adjusted_close_price" | "currency" | "provider" | "provider_symbol" | "updated_at">;
