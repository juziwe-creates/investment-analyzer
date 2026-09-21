export function normalizeComdirectText(input: string) {
  return input.normalize("NFKC").replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n")
    .split("\n").map((line) => line.replace(/[\t ]+/g, " ").trim()).filter(Boolean).join("\n");
}

export function searchableText(input: string) {
  return normalizeComdirectText(input).replace(/\s+/g, " ");
}
