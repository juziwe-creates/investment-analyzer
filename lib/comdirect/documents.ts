import type { ComdirectDocumentMetadata } from "./types";

export function unseenDocuments(documents: ComdirectDocumentMetadata[], knownExternalIds: Iterable<string>) {
  const known = new Set(knownExternalIds);
  return documents.filter((document) => !known.has(document.externalDocumentId));
}

export function safeStorageFilename(filename: string | null, externalId: string) {
  const cleaned = (filename ?? `${externalId}.pdf`).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}
