import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyComdirectDocument } from "./classifier";
import { parseGermanDate } from "./dates";
import { transactionFingerprint } from "./fingerprint";
import { parseGermanNumber } from "./money";
import { normalizeComdirectText } from "./normalize-text";
import { parseComdirectDocument } from "./parse-document";
import { validateCandidate } from "./validate";
import { safeStorageFilename, unseenDocuments } from "../../comdirect/documents";

const fixture = (name: string) => readFileSync(`fixtures/comdirect/${name}.txt`, "utf8");
const context = { sourceDocumentId: "document", importRunId: "run" };

test("German text, numbers, currencies and dates normalize deterministically", () => {
  assert.equal(normalizeComdirectText(" A\u00a0  B\r\n C "), "A B\nC");
  assert.equal(parseGermanNumber("EUR 1.234,56"), 1234.56);
  assert.equal(parseGermanNumber("(12,50 EUR)"), -12.5);
  assert.equal(parseGermanNumber("1.000"), 1000);
  assert.equal(parseGermanDate("Valuta 29.02.2024"), "2024-02-29");
  assert.equal(parseGermanDate("31.02.2024"), null);
});

test("classifier distinguishes supported, lifecycle, ignored and unknown documents", () => {
  assert.equal(classifyComdirectDocument({ text: fixture("buy-standard") }), "BUY");
  assert.equal(classifyComdirectDocument({ text: fixture("sell-with-tax") }), "SELL");
  assert.equal(classifyComdirectDocument({ text: fixture("dividend-german") }), "DIVIDEND");
  assert.equal(classifyComdirectDocument({ text: fixture("warrant-cash-redemption") }), "DERIVATIVE_LIFECYCLE");
  assert.equal(classifyComdirectDocument({ text: fixture("non-transaction-financial-report") }), "NON_TRANSACTIONAL");
  assert.equal(classifyComdirectDocument({ text: fixture("unknown-document") }), "UNKNOWN");
});

test("BUY parses identity, dates, fees and reconciled cash", () => {
  const parsed = parseComdirectDocument(fixture("buy-standard"), context);
  const candidate = parsed.candidates[0], validation = validateCandidate(candidate, parsed.confidence);
  assert.equal(parsed.parserVersion, "comdirect-buy-v1");
  assert.deepEqual({ type: candidate.type, isin: candidate.isin, quantity: candidate.quantity, price: candidate.unitPrice, gross: candidate.grossAmount, net: candidate.netAmount },
    { type: "buy", isin: "DE000ABC1234", quantity: 5, price: 100, gross: 500, net: 505 });
  assert.equal(candidate.components[0].amount, 5);
  assert.equal(validation.autoImport, true);
});

test("SELL parses fees and taxes and rejects arithmetic mismatches", () => {
  const parsed = parseComdirectDocument(fixture("sell-with-tax"), context);
  assert.equal(parsed.candidates[0].components.length, 2);
  assert.equal(validateCandidate(parsed.candidates[0], parsed.confidence).autoImport, true);
  const broken = structuredClone(parsed.candidates[0]); broken.grossAmount = 700;
  assert.equal(validateCandidate(broken, "high").autoImport, false);
});

test("DIVIDEND preserves gross, net and broker tax facts", () => {
  const parsed = parseComdirectDocument(fixture("dividend-german"), context), candidate = parsed.candidates[0];
  assert.equal(candidate.type, "dividend");
  assert.equal(candidate.tradeDate, "2026-05-06");
  assert.equal(candidate.grossAmount, 100);
  assert.equal(candidate.netAmount, 73.62);
  assert.equal(candidate.components[0].amount, 26.38);
  assert.equal(validateCandidate(candidate, parsed.confidence).autoImport, true);
});

test("Optionsschein trades use the instrument price and explicit product type", () => {
  const parsed = parseComdirectDocument(fixture("buy-warrant-call"), context), candidate = parsed.candidates[0];
  assert.equal(parsed.parserVersion, "comdirect-warrant-trade-v1");
  assert.equal(candidate.assetType, "warrant");
  assert.equal(candidate.unitPrice, 2);
  assert.equal(candidate.priceFactor, 1);
  assert.equal(validateCandidate(candidate, parsed.confidence).autoImport, true);
});

test("supported cash and zero lifecycle events close quantities while physical delivery requires review", () => {
  const redemption = parseComdirectDocument(fixture("warrant-cash-redemption"), context);
  assert.equal(redemption.candidates[0].sourceEventType, "cash_redemption");
  assert.equal(redemption.candidates[0].grossAmount, 1500);
  assert.equal(validateCandidate(redemption.candidates[0], redemption.confidence).autoImport, true);
  const expiry = parseComdirectDocument(fixture("warrant-worthless-expiry"), context);
  assert.equal(expiry.candidates[0].sourceEventType, "worthless_expiry");
  assert.equal(expiry.candidates[0].grossAmount, 0);
  assert.equal(validateCandidate(expiry.candidates[0], expiry.confidence).autoImport, true);
  const physical = parseComdirectDocument(fixture("warrant-physical-exercise"), context);
  assert.equal(physical.candidates[0].sourceEventType, "physical_exercise");
  assert.equal(validateCandidate(physical.candidates[0], physical.confidence).autoImport, false);
});

test("fingerprints and document discovery are deterministic and idempotent", () => {
  const candidate = parseComdirectDocument(fixture("buy-standard"), context).candidates[0];
  assert.equal(transactionFingerprint("portfolio", candidate), transactionFingerprint("portfolio", structuredClone(candidate)));
  const documents = [{ externalDocumentId: "a", title: "A", documentDate: null, mimeType: "application/pdf", filename: null, alreadyRead: true, rawMetadata: {} },
    { externalDocumentId: "b", title: "B", documentDate: null, mimeType: "application/pdf", filename: null, alreadyRead: false, rawMetadata: {} }];
  assert.deepEqual(unseenDocuments(documents, ["a"]).map((row) => row.externalDocumentId), ["b"]);
  assert.equal(safeStorageFilename("Sensitive statement 1.PDF", "id"), "Sensitive-statement-1.PDF");
});

test("database and action boundaries keep documents private and imports atomic", () => {
  const migration = readFileSync("supabase/migrations/20260921000000_comdirect_postbox_foundation.sql", "utf8");
  const action = readFileSync("app/actions/comdirect.ts", "utf8");
  assert.match(migration, /values \('source-documents', 'source-documents', false/);
  assert.match(migration, /create or replace function public\.import_comdirect_candidate/);
  assert.match(migration, /where id = p_import_row_id\s+for update/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /insert into public\.transaction_components/);
  assert.match(action, /extractPdfText\(bytes\)/);
  assert.doesNotMatch(action, /raw_payload:\s*\{[^}]*text/);
  assert.doesNotMatch(action, /console\.(?:log|error)/);
});
