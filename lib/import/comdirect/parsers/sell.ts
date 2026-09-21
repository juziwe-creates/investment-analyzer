import { parserConfidence, parseTradeCandidate } from "./common";
import type { ParseResult, ParserContext } from "../types";

export function parseSell(text: string, context: ParserContext): ParseResult {
  const candidate = parseTradeCandidate(text, context, "sell");
  return { parserName: "comdirect-sell", parserVersion: "comdirect-sell-v1", documentType: "security_sale",
    candidates: [candidate], warnings: [], confidence: parserConfidence(candidate) };
}
