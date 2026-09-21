import { parseBuy } from "./buy";
import { parseSell } from "./sell";
import type { ParseResult, ParserContext } from "../types";

export function parseWarrantTrade(text: string, context: ParserContext, type: "buy" | "sell"): ParseResult {
  const result = type === "buy" ? parseBuy(text, context) : parseSell(text, context);
  const candidate = result.candidates[0];
  return { ...result, parserName: "comdirect-warrant-trade", parserVersion: "comdirect-warrant-trade-v1",
    documentType: type === "buy" ? "security_purchase" : "security_sale", candidates: [candidate] };
}
