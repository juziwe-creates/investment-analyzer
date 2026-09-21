import type { ImportConfidence, TransactionCandidate, ValidationCheck, ValidationResult } from "./types";

const tolerance = (expected: number, actual: number) => Math.max(0.02, Math.max(Math.abs(expected), Math.abs(actual)) * 0.001);
const close = (expected: number, actual: number) => Math.abs(expected - actual) <= tolerance(expected, actual);

export function validateCandidate(candidate: TransactionCandidate, confidence: ImportConfidence): ValidationResult {
  const checks: ValidationCheck[] = [];
  const check = (condition: boolean, code: string, pass: string, fail: string) => checks.push({ code, status: condition ? "pass" : "fail", message: condition ? pass : fail });
  check(!!candidate.tradeDate, "trade_date", "Transaction date is present.", "Transaction date is missing or invalid.");
  check(!!candidate.isin || !!candidate.wkn, "security_identity", "Security identity is present.", "ISIN or WKN is required.");
  if (candidate.isin) check(/^[A-Z]{2}[A-Z0-9]{10}$/.test(candidate.isin), "isin", "ISIN syntax is valid.", "ISIN syntax is invalid.");
  check(!!candidate.currency && /^[A-Z]{3}$/.test(candidate.currency), "currency", "Currency is valid.", "Currency is missing or invalid.");
  check(candidate.quantity !== null && candidate.quantity > 0, "quantity", "Quantity is positive.", "Positive quantity is required.");
  check(candidate.grossAmount !== null && candidate.grossAmount >= 0, "gross_amount", "Gross amount is present.", "Gross amount is missing.");
  check(candidate.netAmount !== null && candidate.netAmount >= 0, "net_amount", "Net amount is present.", "Net amount is missing.");
  if (candidate.type === "buy" || candidate.type === "sell") {
    check(candidate.priceQuotation === "per_unit" && candidate.priceFactor === 1, "quotation", "Per-unit quotation is explicit.", "Quotation basis or price factor is ambiguous.");
    if (candidate.quantity !== null && candidate.unitPrice !== null && candidate.priceFactor !== null && candidate.grossAmount !== null) {
      check(close(candidate.quantity * candidate.unitPrice * candidate.priceFactor, candidate.grossAmount), "security_arithmetic", "Quantity and price reconcile to gross value.", "Quantity and price do not reconcile to gross value.");
    }
  }
  if (candidate.grossAmount !== null && candidate.netAmount !== null) {
    const deductions = candidate.components.reduce((sum, component) => sum + component.amount, 0);
    const expected = candidate.type === "buy" ? candidate.grossAmount + deductions : candidate.grossAmount - deductions;
    const status = close(expected, candidate.netAmount) ? "pass" : "warning";
    checks.push({ code: "cash_arithmetic", status, message: status === "pass" ? "Gross, components, and net cash reconcile." : "Cash arithmetic does not fully reconcile; review is required." });
  }
  if (["warrant", "knock_out", "factor_certificate", "certificate"].includes(candidate.assetType ?? "") && candidate.priceQuotation !== "per_unit") {
    checks.push({ code: "derivative_quotation", status: "fail", message: "Leveraged-product quotation is not unambiguous." });
  }
  if (candidate.sourceEventType === "physical_exercise" || candidate.sourceEventType === "instrument_adjustment") {
    checks.push({ code: "lifecycle_review", status: "fail", message: "This lifecycle event requires manual review." });
  }
  const valid = !checks.some((item) => item.status === "fail");
  return { valid, autoImport: valid && confidence === "high" && !checks.some((item) => item.status === "warning"), checks };
}
