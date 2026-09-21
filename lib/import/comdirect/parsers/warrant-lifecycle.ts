import { parseGermanDate } from "../dates";
import { classifyInstrument } from "../instrument-classifier";
import { searchableText } from "../normalize-text";
import { emptyCandidate, type ParseResult, type ParserContext, type SourceEventType } from "../types";
import { findAmount, parseSecurityIdentity } from "./common";

export function parseWarrantLifecycle(input: string, context: ParserContext): ParseResult {
  const text = searchableText(input);
  const lower = text.toLocaleLowerCase("de");
  if (/anpassung der produktbedingungen/.test(lower)) return {
    parserName: "comdirect-warrant-lifecycle", parserVersion: "comdirect-warrant-lifecycle-v1",
    documentType: "instrument_adjustment", candidates: [], confidence: "medium",
    warnings: [{ code: "instrument_adjustment_review", message: "Instrument adjustments require manual identity review and create no transaction." }]
  };
  const event: SourceEventType = /physische lieferung|ausübung/.test(lower) ? "physical_exercise"
    : /wertloser verfall|wertlos ausgebucht/.test(lower) ? "worthless_expiry"
    : /knock[ -]?out|ausgeknockt/.test(lower) ? "knock_out_redemption" : "cash_redemption";
  const candidate = emptyCandidate(context);
  const identity = parseSecurityIdentity(text);
  const payout = findAmount(text, "(?:Ausmachender Betrag|Rückzahlungsbetrag|Zu Ihren Gunsten nach Steuern|Zu Ihren Gunsten vor Steuern)");
  const explicitZero = /(?:0,00\s*EUR|ohne wert|wertlos)/i.test(text);
  candidate.type = "sell";
  candidate.assetType = classifyInstrument([context.title, context.filename, text].filter(Boolean).join(" "));
  candidate.sourceEventType = event;
  candidate.securityName = identity.name;
  candidate.isin = identity.isin;
  candidate.wkn = identity.wkn;
  candidate.tradeDate = parseGermanDate(text.match(/(?:Fälligkeit|Einlösung|Tilgung|Rückzahlung|Valuta|wirksam zum)[^\d]{0,40}(\d{1,2}\.\d{1,2}\.\d{4})/i)?.[1]);
  candidate.settlementDate = parseGermanDate(text.match(/Valuta[^\d]{0,20}(\d{1,2}\.\d{1,2}\.\d{4})/i)?.[1]) ?? candidate.tradeDate;
  candidate.quantity = identity.quantity;
  candidate.grossAmount = payout.value === null && explicitZero ? 0 : payout.value === null ? null : Math.abs(payout.value);
  candidate.netAmount = candidate.grossAmount;
  candidate.currency = payout.currency ?? "EUR";
  candidate.unitPrice = candidate.quantity && candidate.grossAmount !== null ? candidate.grossAmount / candidate.quantity : null;
  candidate.priceQuotation = "per_unit";
  candidate.priceFactor = 1;
  candidate.rawEvidence = Object.fromEntries(Object.entries({ identity: identity.evidence, payout: payout.evidence }).filter((entry): entry is [string, string] => !!entry[1]));
  const complete = candidate.tradeDate && (candidate.isin || candidate.wkn) && candidate.quantity && candidate.quantity > 0 && candidate.grossAmount !== null;
  return { parserName: "comdirect-warrant-lifecycle", parserVersion: "comdirect-warrant-lifecycle-v1",
    documentType: event === "worthless_expiry" ? "security_expiry" : event === "knock_out_redemption" ? "knock_out_settlement" : event === "physical_exercise" ? "corporate_action" : "security_redemption",
    candidates: [candidate], confidence: complete && event !== "physical_exercise" ? "high" : "low",
    warnings: event === "physical_exercise" ? [{ code: "physical_exercise_review", message: "Physical exercise cannot be auto-imported without delivered-security mapping." }] : [] };
}
