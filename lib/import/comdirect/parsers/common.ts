import { parseGermanDate } from "../dates";
import { classifyInstrument } from "../instrument-classifier";
import { currencyFrom, parseGermanNumber } from "../money";
import { searchableText } from "../normalize-text";
import { emptyCandidate, type ComponentType, type ParserContext, type TransactionCandidate } from "../types";

function first(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

function amount(text: string, label: string) {
  const match = text.match(new RegExp(`(?:${label})\\s*:?\\s*(?:(EUR|USD|GBP|CHF|DKK|NOK|SEK)\\s*)?(-?[\\d.]+(?:,\\d+)?)\\s*(EUR|USD|GBP|CHF|DKK|NOK|SEK)?`, "i"));
  return { value: parseGermanNumber(match?.[2]), currency: (match?.[1] ?? match?.[3])?.toUpperCase() ?? null, evidence: match?.[0] ?? null };
}

function component(text: string, label: string, type: ComponentType, currency: string) {
  const found = amount(text, label);
  return found.value && found.value !== 0 ? { type, amount: Math.abs(found.value), currency, description: found.evidence ?? label } : null;
}

export function parseSecurityIdentity(text: string) {
  const taxLine = text.match(/Stk\.?\s*([\d.,]+)\s+(.+?)\s*,?\s*WKN\s*\/\s*ISIN\s*:\s*([A-Z0-9]{6})\s*\/\s*([A-Z]{2}[A-Z0-9]{10})/i);
  const direct = text.match(/WKN\s*\/\s*ISIN\s*:?\s*([A-Z0-9]{6})\s*\/\s*([A-Z]{2}[A-Z0-9]{10})/i);
  return {
    quantity: parseGermanNumber(taxLine?.[1]),
    name: taxLine?.[2]?.trim() ?? null,
    wkn: (taxLine?.[3] ?? direct?.[1])?.toUpperCase() ?? null,
    isin: (taxLine?.[4] ?? direct?.[2])?.toUpperCase() ?? null,
    evidence: taxLine?.[0] ?? direct?.[0] ?? null
  };
}

export function parseTradeCandidate(input: string, context: ParserContext, type: "buy" | "sell"): TransactionCandidate {
  const text = searchableText(input);
  const candidate = emptyCandidate(context);
  const identity = parseSecurityIdentity(text);
  const gross = amount(text, "Kurswert");
  const netLabel = type === "buy" ? "Zu Ihren Lasten nach Steuern|Zu Ihren Lasten vor Steuern" : "Zu Ihren Gunsten nach Steuern|Zu Ihren Gunsten vor Steuern";
  const net = amount(text, netLabel);
  const unit = amount(text, "(?:Zum Kurs von|Kurs)");
  const currency = net.currency ?? gross.currency ?? unit.currency ?? currencyFrom(text) ?? "EUR";
  const components = [
    component(text, "Provision", "broker_fee", currency),
    component(text, "Börsenplatzabhäng(?:iges|\\.)? Entgelt", "exchange_fee", currency),
    component(text, "Abwickl(?:ungs)?\\.?entgelt(?: Clearstream)?", "fee", currency),
    component(text, "Kapitalertragsteuer", "tax", currency),
    component(text, "Solidaritätszuschlag", "tax", currency),
    component(text, "Kirchensteuer", "tax", currency)
  ].filter((value): value is NonNullable<typeof value> => value !== null);
  const source = [context.title, context.filename, text].filter(Boolean).join(" ");
  candidate.type = type;
  candidate.assetType = classifyInstrument(source);
  candidate.securityName = identity.name;
  candidate.isin = identity.isin;
  candidate.wkn = identity.wkn;
  candidate.tradeDate = parseGermanDate(first(text, [/Geschäftstag\s*:?\s*([^ ]+)/i, /(?:Wertpapierkauf|Wertpapierverkauf)\s+Nr\.?[^ ]+\s+vom\s+([^ ]+)/i]));
  candidate.settlementDate = parseGermanDate(first(text, [/(?:mit\s+)?Valuta\s+([^ ]+)/i, /Valuta\s*:?\s*([^ ]+)/i]));
  candidate.quantity = identity.quantity ?? parseGermanNumber(first(text, [/(?:Nennwert|Stück)\s*(?:Zum Kurs von)?\s*St\.?\s*([\d.,]+)/i]));
  candidate.unitPrice = unit.value === null ? null : Math.abs(unit.value);
  candidate.priceQuotation = /\bSt\.?\b|Stk\./i.test(text) ? "per_unit" : null;
  candidate.priceFactor = candidate.priceQuotation === "per_unit" ? 1 : null;
  candidate.grossAmount = gross.value === null ? null : Math.abs(gross.value);
  candidate.netAmount = net.value === null ? null : Math.abs(net.value);
  candidate.currency = currency;
  candidate.exchange = first(text, [/Ausführungsplatz\s*:?\s*([A-ZÄÖÜ -]{2,30}?)(?:\s+Handelszeit|\s+Wertpapier)/i]);
  candidate.components = components;
  candidate.rawEvidence = Object.fromEntries(Object.entries({ identity: identity.evidence, gross: gross.evidence, net: net.evidence, unitPrice: unit.evidence }).filter((entry): entry is [string, string] => !!entry[1]));
  return candidate;
}

export function parserConfidence(candidate: TransactionCandidate) {
  return candidate.tradeDate && (candidate.isin || candidate.wkn) && candidate.quantity && candidate.quantity > 0 && candidate.currency && candidate.grossAmount !== null && candidate.netAmount !== null
    ? "high" as const : "medium" as const;
}

export function findAmount(text: string, label: string) { return amount(searchableText(text), label); }
