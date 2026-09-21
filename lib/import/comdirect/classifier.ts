import { searchableText } from "./normalize-text";
import type { DocumentClass } from "./types";

export function classifyComdirectDocument(input: { text: string; title?: string | null; filename?: string | null }): DocumentClass {
  const text = searchableText([input.title, input.filename, input.text].filter(Boolean).join("\n")).toLocaleLowerCase("de");
  if (/nichtausführungsanzeige|finanzreport|depotauszug|jahressteuerbescheinigung|allgemeine geschäftsbedingungen/.test(text)) return "NON_TRANSACTIONAL";
  if (/dividendengutschrift|gutschrift fälliger wertpapier-erträge|ausschüttung/.test(text)) return "DIVIDEND";
  if (/wertpapierabrechnung\s*(kauf|wertpapierkauf)|wertpapierkauf/.test(text)) return "BUY";
  if (/wertpapierabrechnung\s*(verkauf|wertpapierverkauf)|wertpapierverkauf/.test(text)) return "SELL";
  if (/wertloser verfall|knock-out|ausgeknockt|barausgleich|einlösung|tilgung|rückzahlung|fälligkeit|ausübung|anpassung der produktbedingungen/.test(text)) return "DERIVATIVE_LIFECYCLE";
  return text.length < 30 ? "UNKNOWN" : "UNKNOWN";
}
