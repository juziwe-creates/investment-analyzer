import type { Database } from "../../types/database";
import type { AnalyticsTransactionComponent } from "./engine";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type PresentableTransaction = Transaction & { components?: AnalyticsTransactionComponent[] };

export function presentationFactor(deployedCapital: number) {
  if (!Number.isFinite(deployedCapital) || deployedCapital <= 0) {
    throw new Error("Presentation mode requires positive current deployed capital in EUR.");
  }
  const factor = 1_000_000 / deployedCapital;
  if (!Number.isFinite(factor)) throw new Error("Presentation scale is unavailable.");
  return factor;
}

export function scaleTransaction<T extends PresentableTransaction>(transaction: T, factor: number): T {
  const scale = (value: number | null) => {
    if (value === null) return null;
    const result = value * factor;
    if (!Number.isFinite(result)) throw new Error("Presentation value is unavailable.");
    return result;
  };
  return {
    ...transaction,
    quantity: scale(transaction.quantity),
    gross_amount: scale(transaction.gross_amount),
    net_amount: scale(transaction.net_amount),
    notes: null,
    external_id: null,
    broker: null,
    source_document_id: null,
    import_run_id: null,
    ...(transaction.components ? { components: transaction.components.map((component) => ({ ...component, amount: component.amount * factor })) } : {})
  } as T;
}
