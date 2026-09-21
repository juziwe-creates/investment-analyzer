import { extractText, getDocumentProxy } from "unpdf";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 50;
const TIMEOUT_MS = 15_000;

export async function extractPdfText(bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new Error("PDF size is outside the supported range.");
  const pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
  if (pdf.numPages > MAX_PAGES) throw new Error("PDF has too many pages for one import request.");
  const extracted = await Promise.race([
    extractText(pdf, { mergePages: true }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PDF extraction timed out.")), TIMEOUT_MS))
  ]);
  const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
  if (text.trim().length < 30) throw new Error("PDF contains insufficient extractable text.");
  return { text, totalPages: extracted.totalPages };
}
