export function parseGermanNumber(input: string | null | undefined): number | null {
  if (!input) return null;
  const negative = /(^|\s)-|\(.*\)/.test(input);
  let value = input.replace(/[()\sA-Za-z€$£']/g, "").replace(/[^0-9,.-]/g, "");
  if (!value) return null;
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");
  else if ((value.match(/\./g) ?? []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  value = value.replace(/(?!^)-/g, "");
  const parsed = Number(value);
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : null;
}

export function currencyFrom(input: string | null | undefined) {
  if (!input) return null;
  if (/€|\bEUR\b/i.test(input)) return "EUR";
  const match = input.match(/\b(EUR|USD|GBP|CHF|DKK|NOK|SEK|JPY|CAD|AUD)\b/i);
  return match?.[1].toUpperCase() ?? null;
}
