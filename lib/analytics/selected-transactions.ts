import { acquisitionCost, saleProceeds, dividendFacts, type AnalyticsTransaction } from "./engine";
import type { LotProfitability } from "./profitability";

export type SelectedTransaction = { id: string; date: string; type: "buy" | "sell" | "dividend"; name: string; currency: string; quantity: number | null; price: number | null; amount: number | null; reference: number | null; returnPercent: number | null; xirr: number | null };

export function selectedTransactionRows(transactions: AnalyticsTransaction[], lots: Pick<LotProfitability, "id" | "costBasis" | "remainingQuantity" | "currentValue" | "attributedSaleProceeds" | "totalReturnPercent" | "annualizedReturnPercent">[]): SelectedTransaction[] {
  const byId = new Map(lots.map((lot) => [lot.id, lot]));
  return transactions.flatMap((row): SelectedTransaction[] => {
    if (row.type !== "buy" && row.type !== "sell" && row.type !== "dividend") return [];
    const lot = byId.get(row.id);
    return [{ id: row.id, date: row.trade_date, type: row.type, name: row.security_name, currency: row.currency,
      quantity: row.quantity, price: row.unit_price,
      amount: lot?.costBasis ?? (row.type === "buy" ? acquisitionCost(row) : row.type === "sell" ? saleProceeds(row) : dividendFacts(row).cash),
      reference: lot ? lot.remainingQuantity > 0 ? lot.currentValue : lot.attributedSaleProceeds : null,
      returnPercent: lot?.totalReturnPercent ?? null, xirr: lot?.annualizedReturnPercent ?? null }];
  }).sort((a, b) => b.date.localeCompare(a.date));
}
