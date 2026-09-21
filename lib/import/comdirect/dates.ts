export function parseGermanDate(input: string | null | undefined): string | null {
  const match = input?.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
  if (!match) return null;
  const date = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
