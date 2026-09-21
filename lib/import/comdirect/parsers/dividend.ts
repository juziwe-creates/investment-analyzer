import { parseGermanDate } from "../dates";
import { currencyFrom, parseGermanNumber } from "../money";
import { searchableText } from "../normalize-text";
import { emptyCandidate, type ParseResult, type ParserContext } from "../types";
import { findAmount, parseSecurityIdentity } from "./common";

export function parseDividend(input: string, context: ParserContext): ParseResult {
  const text = searchableText(input);
  const candidate = emptyCandidate(context);
  const identity = parseSecurityIdentity(text);
  const gross = findAmount(text, "(?:Bruttoertrag|Zu Ihren Gunsten vor Steuern)");
  const net = findAmount(text, "(?:Ausmachender Betrag|Zu Ihren Gunsten nach Steuern)");
  const perShare = findAmount(text, "(?:Dividende pro Stück|Ausschüttung pro Stück)");
  const currency = net.currency ?? gross.currency ?? perShare.currency ?? currencyFrom(text) ?? "EUR";
  const taxLabels: [string, "tax" | "withholding_tax"][] = [["Kapitalertragsteuer", "tax"], ["Solidaritätszuschlag", "tax"], ["Kirchensteuer", "tax"], ["ausländische Quellensteuer", "withholding_tax"]];
  candidate.type = "dividend";
  candidate.sourceEventType = null;
  candidate.securityName = identity.name;
  candidate.isin = identity.isin;
  candidate.wkn = identity.wkn;
  candidate.tradeDate = parseGermanDate(text.match(/(?:zahlbar ab|Zahltag|Valuta)\s*:?\s*([^ ]+)/i)?.[1]);
  candidate.settlementDate = parseGermanDate(text.match(/Valuta\s*:?\s*([^ ]+)/i)?.[1]) ?? candidate.tradeDate;
  candidate.quantity = identity.quantity ?? parseGermanNumber(text.match(/Depotbestand\s*:?\s*(?:St\.?|Stk\.?)?\s*([\d.,]+)/i)?.[1]);
  candidate.unitPrice = perShare.value === null ? null : Math.abs(perShare.value);
  candidate.priceQuotation = candidate.unitPrice === null ? null : "per_unit";
  candidate.priceFactor = candidate.unitPrice === null ? null : 1;
  candidate.grossAmount = gross.value === null ? null : Math.abs(gross.value);
  candidate.netAmount = net.value === null ? candidate.grossAmount : Math.abs(net.value);
  candidate.currency = currency;
  candidate.components = taxLabels.flatMap(([label, type]) => {
    const found = findAmount(text, label);
    return found.value && found.value !== 0 ? [{ type, amount: Math.abs(found.value), currency, description: found.evidence ?? label }] : [];
  });
  candidate.rawEvidence = Object.fromEntries(Object.entries({ identity: identity.evidence, gross: gross.evidence, net: net.evidence, perShare: perShare.evidence }).filter((entry): entry is [string, string] => !!entry[1]));
  const confidence = candidate.tradeDate && (candidate.isin || candidate.wkn) && candidate.grossAmount !== null && candidate.netAmount !== null ? "high" : "medium";
  return { parserName: "comdirect-dividend", parserVersion: "comdirect-dividend-v1", documentType: "dividend", candidates: [candidate], warnings: [], confidence };
}
