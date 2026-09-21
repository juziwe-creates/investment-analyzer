export type ComdirectConnectionState = "NOT_CONNECTED" | "AUTHENTICATING" | "TAN_REQUIRED" | "CONNECTED" | "SESSION_EXPIRED" | "ERROR";
export type ComdirectDocumentMetadata = {
  externalDocumentId: string; title: string; documentDate: string | null; mimeType: string;
  filename: string | null; alreadyRead: boolean | null; rawMetadata: Record<string, unknown>;
};
export type ComdirectDocumentPage = { documents: ComdirectDocumentMetadata[]; nextCursor: string | null };
export type ComdirectAuthInput = { accessNumber: string; pin: string };
export type ComdirectTanChallenge = { challengeId: string; challengeType: string; challengeData: string | null };
export type ComdirectSession = { accessToken: string; refreshToken: string | null; expiresAt: number; sessionId: string | null };
