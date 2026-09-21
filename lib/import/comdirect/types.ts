export type DocumentClass = "BUY" | "SELL" | "DIVIDEND" | "DERIVATIVE_LIFECYCLE" | "NON_TRANSACTIONAL" | "UNKNOWN";
export type ImportConfidence = "high" | "medium" | "low";
export type CandidateAssetType = "stock" | "etf" | "fund" | "bond" | "warrant" | "knock_out" | "factor_certificate" | "certificate" | "other" | null;
export type SourceEventType = "trade" | "cash_redemption" | "worthless_expiry" | "knock_out_redemption" | "physical_exercise" | "instrument_adjustment" | null;
export type ComponentType = "fee" | "tax" | "withholding_tax" | "exchange_fee" | "broker_fee" | "other";

export type TransactionCandidate = {
  type: "buy" | "sell" | "dividend" | "fee" | "tax";
  assetType: CandidateAssetType;
  sourceEventType: SourceEventType;
  securityName: string | null;
  isin: string | null;
  wkn: string | null;
  ticker: string | null;
  exchange: string | null;
  tradeDate: string | null;
  settlementDate: string | null;
  quantity: number | null;
  unitPrice: number | null;
  priceQuotation: "per_unit" | "percentage" | "points" | null;
  priceFactor: number | null;
  grossAmount: number | null;
  netAmount: number | null;
  currency: string | null;
  components: { type: ComponentType; amount: number; currency: string; description?: string }[];
  broker: "comdirect";
  sourceDocumentId: string;
  importRunId: string;
  rawEvidence: Record<string, string>;
  instrumentTerms?: {
    issuer: string | null; underlyingName: string | null; underlyingIsin: string | null;
    direction: "call" | "put" | "long" | "short" | null; strike: number | null;
    strikeCurrency: string | null; ratio: number | null; expiryDate: string | null;
    knockOutBarrier: number | null; settlementMethod: "cash" | "physical" | null; quanto: boolean | null;
  };
};

export type ParseWarning = { code: string; message: string };
export type ParseResult = {
  parserName: string;
  parserVersion: string;
  documentType: string;
  candidates: TransactionCandidate[];
  warnings: ParseWarning[];
  confidence: ImportConfidence;
};
export type ParserContext = { sourceDocumentId: string; importRunId: string; title?: string | null; filename?: string | null };
export type ValidationCheck = { code: string; status: "pass" | "warning" | "fail"; message: string };
export type ValidationResult = { valid: boolean; autoImport: boolean; checks: ValidationCheck[] };

export function emptyCandidate(context: ParserContext): TransactionCandidate {
  return { type: "buy", assetType: null, sourceEventType: "trade", securityName: null, isin: null, wkn: null,
    ticker: null, exchange: null, tradeDate: null, settlementDate: null, quantity: null, unitPrice: null,
    priceQuotation: null, priceFactor: null, grossAmount: null, netAmount: null, currency: null, components: [],
    broker: "comdirect", sourceDocumentId: context.sourceDocumentId, importRunId: context.importRunId, rawEvidence: {} };
}
