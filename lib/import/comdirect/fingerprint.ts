import { createHash } from "node:crypto";
import type { TransactionCandidate } from "./types";

const number = (value: number | null) => value === null ? "" : value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
export function transactionFingerprint(portfolioId: string, candidate: TransactionCandidate) {
  const canonical = [portfolioId, candidate.broker, candidate.type, candidate.tradeDate ?? "", candidate.isin ?? candidate.wkn ?? candidate.securityName ?? "",
    number(candidate.quantity), number(candidate.unitPrice), number(candidate.grossAmount), number(candidate.netAmount), candidate.currency ?? "",
    candidate.assetType ?? "", candidate.sourceEventType ?? ""].join("|").toUpperCase();
  return createHash("sha256").update(canonical).digest("hex");
}

export function contentHash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
