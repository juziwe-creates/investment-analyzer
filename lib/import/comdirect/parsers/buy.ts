import { parserConfidence, parseTradeCandidate } from "./common";
import type { ParseResult, ParserContext } from "../types";

export function parseBuy(text: string, context: ParserContext): ParseResult {
  const candidate = parseTradeCandidate(text, context, "buy");
  return { parserName: "comdirect-buy", parserVersion: "comdirect-buy-v1", documentType: "security_purchase",
    candidates: [candidate], warnings: [], confidence: parserConfidence(candidate) };
}
