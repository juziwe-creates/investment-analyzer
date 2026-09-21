import { classifyComdirectDocument } from "./classifier";
import { normalizeComdirectText } from "./normalize-text";
import type { ParseResult, ParserContext } from "./types";
import { parseBuy } from "./parsers/buy";
import { parseDividend } from "./parsers/dividend";
import { parseSell } from "./parsers/sell";
import { parseWarrantTrade } from "./parsers/warrant";
import { parseWarrantLifecycle } from "./parsers/warrant-lifecycle";

export function parseComdirectDocument(rawText: string, context: ParserContext): ParseResult {
  const text = normalizeComdirectText(rawText);
  const kind = classifyComdirectDocument({ text, title: context.title, filename: context.filename });
  if (kind === "NON_TRANSACTIONAL") return { parserName: "comdirect-classifier", parserVersion: "comdirect-classifier-v1", documentType: "general_correspondence", candidates: [], warnings: [], confidence: "high" };
  if (kind === "UNKNOWN") return { parserName: "comdirect-classifier", parserVersion: "comdirect-classifier-v1", documentType: "unknown", candidates: [], warnings: [{ code: "unsupported_layout", message: "No supported comdirect document layout matched." }], confidence: "low" };
  if (kind === "DIVIDEND") return parseDividend(text, context);
  if (kind === "DERIVATIVE_LIFECYCLE") return parseWarrantLifecycle(text, context);
  const result = kind === "BUY" ? parseBuy(text, context) : parseSell(text, context);
  return ["warrant", "knock_out", "factor_certificate", "certificate"].includes(result.candidates[0]?.assetType ?? "")
    ? parseWarrantTrade(text, context, kind === "BUY" ? "buy" : "sell") : result;
}
