"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contentHash, transactionFingerprint } from "@/lib/import/comdirect/fingerprint";
import { extractPdfText } from "@/lib/import/comdirect/pdf";
import { parseComdirectDocument } from "@/lib/import/comdirect/parse-document";
import type { TransactionCandidate } from "@/lib/import/comdirect/types";
import { validateCandidate } from "@/lib/import/comdirect/validate";
import { safeStorageFilename } from "@/lib/comdirect/documents";
import { requireActualDataMode } from "@/lib/presentation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024;

function importsRedirect(message: string, review = false): never {
  redirect(`${review ? "/imports/review" : "/imports"}?message=${encodeURIComponent(message)}`);
}

async function authenticatedContext(requestedPortfolioId: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const query = supabase.from("portfolios").select("id").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1);
  if (requestedPortfolioId) query.eq("id", requestedPortfolioId);
  const { data: portfolio, error } = await query.maybeSingle();
  if (error || !portfolio) importsRedirect("Select an available portfolio before importing.");
  return { supabase, user, portfolioId: portfolio.id };
}

function candidateJson(candidate: TransactionCandidate) {
  return JSON.parse(JSON.stringify(candidate)) as Json;
}

async function probableManualDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  portfolioId: string,
  candidate: TransactionCandidate
) {
  if (!candidate.tradeDate || !candidate.quantity) return false;
  let query = supabase.from("transactions").select("id").eq("user_id", userId).eq("portfolio_id", portfolioId)
    .eq("type", candidate.type).eq("trade_date", candidate.tradeDate).eq("quantity", candidate.quantity).limit(1);
  if (candidate.isin) query = query.eq("isin", candidate.isin);
  else if (candidate.wkn) query = query.eq("wkn", candidate.wkn);
  else return false;
  const { data } = await query;
  return Boolean(data?.length);
}

export async function importComdirectPdfs(formData: FormData) {
  await requireActualDataMode();
  const files = formData.getAll("documents").filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) importsRedirect("Choose at least one PDF.");
  if (files.length > MAX_FILES) importsRedirect(`Import at most ${MAX_FILES} PDFs per batch.`);
  if (files.some((file) => file.type !== "application/pdf" || file.size > MAX_FILE_BYTES)) importsRedirect("Every file must be a PDF no larger than 3 MB.");
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) importsRedirect("The batch exceeds the 3 MB request limit.");

  const requestedPortfolioId = formData.get("portfolio")?.toString() || null;
  const { supabase, user, portfolioId } = await authenticatedContext(requestedPortfolioId);
  const { data: run, error: runError } = await supabase.from("import_runs").insert({
    user_id: user.id, portfolio_id: portfolioId, source_type: "comdirect", broker: "comdirect",
    status: "processing", documents_seen: files.length, rows_total: files.length
  }).select("id").single();
  if (runError || !run) importsRedirect(runError?.message ?? "Could not start the import.");

  const counts = { new: 0, imported: 0, review: 0, ignored: 0, failed: 0, created: 0 };
  for (const [index, file] of files.entries()) {
    let sourceDocumentId: string | null = null;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = contentHash(bytes);
      const { data: duplicate } = await supabase.from("source_documents").select("id").eq("user_id", user.id).eq("content_hash", hash).maybeSingle();
      if (duplicate) { counts.ignored += 1; continue; }

      counts.new += 1;
      const filename = safeStorageFilename(file.name, hash.slice(0, 12));
      const storagePath = `${user.id}/${portfolioId}/${run.id}/${hash}-${filename}`;
      const { error: uploadError } = await supabase.storage.from("source-documents").upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      const { data: source, error: sourceError } = await supabase.from("source_documents").insert({
        user_id: user.id, portfolio_id: portfolioId, import_run_id: run.id,
        document_type: "postbox_document", source_type: "comdirect", storage_path: storagePath,
        original_filename: filename, content_hash: hash, broker: "comdirect", mime_type: "application/pdf",
        source_metadata: { import_method: "manual_postbox_pdf", byte_size: bytes.byteLength }, parse_status: "processing"
      }).select("id").single();
      if (sourceError || !source) {
        await supabase.storage.from("source-documents").remove([storagePath]);
        throw sourceError ?? new Error("Could not record the source document.");
      }
      sourceDocumentId = source.id;

      const extracted = await extractPdfText(bytes);
      const parsed = parseComdirectDocument(extracted.text, { sourceDocumentId: source.id, importRunId: run.id, filename });
      await supabase.from("source_documents").update({
        normalized_document_type: parsed.documentType, parser_name: parsed.parserName,
        parser_version: parsed.parserVersion, source_metadata: { import_method: "manual_postbox_pdf", byte_size: bytes.byteLength, page_count: extracted.totalPages }
      }).eq("id", source.id);

      if (!parsed.candidates.length) {
        const status = parsed.documentType === "general_correspondence" ? "ignored" : "review";
        const { error: rowError } = await supabase.from("import_rows").insert({
          import_run_id: run.id, source_document_id: source.id, row_number: index + 1,
          raw_payload: { filename, document_type: parsed.documentType }, normalized_payload: null,
          validation_result: { warnings: parsed.warnings, confidence: parsed.confidence },
          parser_name: parsed.parserName, parser_version: parsed.parserVersion, status,
          error_message: parsed.warnings.map((warning) => warning.message).join(" ") || null
        });
        if (rowError) throw rowError;
        await supabase.from("source_documents").update({ parse_status: status === "ignored" ? "ignored_non_transactional" : "review" }).eq("id", source.id);
        if (status === "ignored") counts.ignored += 1; else counts.review += 1;
        continue;
      }

      const candidate = parsed.candidates[0];
      const validation = validateCandidate(candidate, parsed.confidence);
      const fingerprint = transactionFingerprint(portfolioId, candidate);
      const manualDuplicate = await probableManualDuplicate(supabase, user.id, portfolioId, candidate);
      if (manualDuplicate) validation.checks.push({ code: "probable_manual_duplicate", status: "warning", message: "A similar transaction already exists and requires review." });
      const autoImport = validation.autoImport && !manualDuplicate;
      const { data: row, error: rowError } = await supabase.from("import_rows").insert({
        import_run_id: run.id, source_document_id: source.id, row_number: index + 1,
        raw_payload: { filename, document_type: parsed.documentType }, normalized_payload: candidateJson(candidate),
        validation_result: validation as unknown as Json, parser_name: parsed.parserName,
        parser_version: parsed.parserVersion, transaction_fingerprint: fingerprint, status: autoImport ? "pending" : "review",
        error_message: autoImport ? null : validation.checks.filter((check) => check.status !== "pass").map((check) => check.message).join(" ")
      }).select("id").single();
      if (rowError || !row) throw rowError ?? new Error("Could not record the parsed document.");

      if (autoImport) {
        const { error: importError } = await supabase.rpc("import_comdirect_candidate", {
          p_import_row_id: row.id, p_candidate: candidateJson(candidate), p_fingerprint: fingerprint
        });
        if (importError) throw importError;
        counts.imported += 1; counts.created += 1;
      } else {
        await supabase.from("source_documents").update({ parse_status: "review" }).eq("id", source.id);
        counts.review += 1;
      }
    } catch (error) {
      counts.failed += 1;
      if (sourceDocumentId) await supabase.from("source_documents").update({ parse_status: "failed" }).eq("id", sourceDocumentId);
      await supabase.from("import_rows").insert({
        import_run_id: run.id, source_document_id: sourceDocumentId, row_number: index + 1,
        raw_payload: { filename: file.name }, status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 500) : "Document processing failed."
      });
    }
  }

  const finalStatus = counts.failed ? (counts.imported || counts.review || counts.ignored ? "completed_with_errors" : "failed") : "completed";
  await supabase.from("import_runs").update({
    status: finalStatus, finished_at: new Date().toISOString(), rows_imported: counts.imported,
    rows_failed: counts.failed, documents_new: counts.new, documents_imported: counts.imported,
    documents_review: counts.review, documents_ignored: counts.ignored, documents_failed: counts.failed,
    transactions_created: counts.created
  }).eq("id", run.id);
  revalidatePath("/imports"); revalidatePath("/imports/review"); revalidatePath("/transactions");
  importsRedirect(`Processed ${files.length} PDF(s): ${counts.imported} imported, ${counts.review} for review, ${counts.ignored} ignored, ${counts.failed} failed.`);
}

function formNumber(formData: FormData, key: string) {
  const value = formData.get(key)?.toString().trim();
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function approveComdirectImport(formData: FormData) {
  await requireActualDataMode();
  const rowId = formData.get("row_id")?.toString();
  if (!rowId) importsRedirect("Import row is missing.", true);
  const { supabase } = await authenticatedContext(formData.get("portfolio")?.toString() || null);
  const { data: row, error } = await supabase.from("import_rows").select("id,normalized_payload,import_run_id,import_runs(portfolio_id)").eq("id", rowId).maybeSingle();
  if (error || !row?.normalized_payload) importsRedirect(error?.message ?? "The parsed transaction is unavailable.", true);
  const candidate = row.normalized_payload as unknown as TransactionCandidate;
  candidate.securityName = formData.get("security_name")?.toString().trim() || candidate.securityName;
  candidate.tradeDate = formData.get("trade_date")?.toString() || candidate.tradeDate;
  candidate.quantity = formNumber(formData, "quantity") ?? candidate.quantity;
  candidate.unitPrice = formNumber(formData, "unit_price") ?? candidate.unitPrice;
  candidate.grossAmount = formNumber(formData, "gross_amount") ?? candidate.grossAmount;
  candidate.netAmount = formNumber(formData, "net_amount") ?? candidate.netAmount;
  const validation = validateCandidate(candidate, "high");
  if (!validation.valid) importsRedirect(validation.checks.filter((check) => check.status === "fail").map((check) => check.message).join(" "), true);
  const relation = row.import_runs as unknown as { portfolio_id: string } | null;
  if (!relation) importsRedirect("The import run is unavailable.", true);
  const fingerprint = transactionFingerprint(relation.portfolio_id, candidate);
  await supabase.from("import_rows").update({ normalized_payload: candidateJson(candidate), validation_result: validation as unknown as Json, transaction_fingerprint: fingerprint }).eq("id", row.id);
  const { error: importError } = await supabase.rpc("import_comdirect_candidate", { p_import_row_id: row.id, p_candidate: candidateJson(candidate), p_fingerprint: fingerprint });
  if (importError) importsRedirect(importError.message, true);
  revalidatePath("/imports"); revalidatePath("/imports/review"); revalidatePath("/transactions");
  importsRedirect("Transaction imported.", true);
}

export async function ignoreComdirectImport(formData: FormData) {
  await requireActualDataMode();
  const rowId = formData.get("row_id")?.toString();
  if (!rowId) importsRedirect("Import row is missing.", true);
  const { supabase } = await authenticatedContext(formData.get("portfolio")?.toString() || null);
  const { data: row, error } = await supabase.from("import_rows").update({ status: "ignored", error_message: "Ignored by user." }).eq("id", rowId).eq("status", "review").select("source_document_id").maybeSingle();
  if (error || !row) importsRedirect(error?.message ?? "Review item is unavailable.", true);
  if (row.source_document_id) await supabase.from("source_documents").update({ parse_status: "ignored_non_transactional" }).eq("id", row.source_document_id);
  revalidatePath("/imports"); revalidatePath("/imports/review");
  importsRedirect("Review item ignored.", true);
}
