import type { CandidateAssetType } from "./types";

export function classifyInstrument(text: string): CandidateAssetType {
  const value = text.toLocaleLowerCase("de");
  if (/turbo|knock[ -]?out/.test(value)) return "knock_out";
  if (/faktor[- ]?zertifikat/.test(value)) return "factor_certificate";
  if (/optionsschein|\bcall(?:\b|\d)|\bput(?:\b|\d)|\bdiscc\d*/.test(value)) return "warrant";
  if (/zertifikat/.test(value)) return "certificate";
  if (/\betf\b|exchange traded fund/.test(value)) return "etf";
  if (/fonds|fund/.test(value)) return "fund";
  if (/anleihe|bond/.test(value)) return "bond";
  return "stock";
}
