import type { ComdirectAuthInput, ComdirectDocumentMetadata, ComdirectDocumentPage, ComdirectSession, ComdirectTanChallenge } from "./types";

export interface ComdirectClient {
  startAuthentication(input: ComdirectAuthInput): Promise<{ session: ComdirectSession; challenge: ComdirectTanChallenge | null }>;
  completeTan(session: ComdirectSession, challengeId: string, tan: string): Promise<ComdirectSession>;
  listPostboxDocuments(session: ComdirectSession, cursor: string | null, limit: number): Promise<ComdirectDocumentPage>;
  downloadDocument(session: ComdirectSession, document: ComdirectDocumentMetadata): Promise<Uint8Array>;
}

export class ComdirectContractUnavailableError extends Error {
  constructor() { super("Install the current official comdirect Swagger/Postman contract before enabling authentication and PostBox sync."); }
}

// HTTP paths and CdSecondary authentication semantics intentionally stay out of source until
// the authenticated, current comdirect contract is supplied.
export function createComdirectClient(): ComdirectClient {
  throw new ComdirectContractUnavailableError();
}
