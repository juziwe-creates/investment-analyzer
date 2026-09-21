# Comdirect PostBox Import

## Status

The downloaded-PDF workflow is implemented. The live official API transport is intentionally blocked until the current authenticated comdirect Swagger or Postman contract is available. The public product page confirms PostBox access and the absence of a public sandbox, but it is not a sufficient endpoint contract.

## Security Rules

- The comdirect PIN and TAN are never stored, logged, or accepted by the PDF workflow.
- Client ID and client secret are server-only environment variables.
- Access and refresh tokens must remain server-side when the live adapter is implemented.
- Original PDFs use the private `source-documents` bucket and user-scoped paths.
- Originals are opened through a 60-second signed URL after an authenticated ownership query.
- Extracted PDF text is processed in memory and is never written to Postgres, Storage metadata, logs, or errors.
- UI messages contain parser outcomes, never raw bank-document text.

## Import Flow

1. Create a bounded import run for at most five PDFs and 3 MB per browser-upload batch. This stays below Vercel's 4.5 MB function request limit; future API downloads travel server-to-server and retain the 15 MB per-document storage/extraction limit.
2. Reject non-PDF files, oversized files, and content hashes already owned by the user.
3. Store each new original privately and record its source metadata.
4. Extract text with page, byte, and time limits.
5. Classify and parse with versioned deterministic parsers.
6. Validate identity, dates, quantities, quotation basis, security arithmetic, and cash arithmetic.
7. Check exact fingerprints and probable duplicates of manual entries.
8. Auto-import only high-confidence reconciled candidates. Route every ambiguity to review.
9. Promote an approved candidate through one atomic database function.

## Supported Documents

- Standard security purchases and sales with explicit per-unit prices.
- Dividend credits with broker-reported gross, net, and tax components.
- Warrant, knock-out, factor-certificate, and certificate trades when quotation basis is explicit.
- Cash redemption, knock-out redemption, and worthless-expiry lifecycle events.
- Non-transactional correspondence is retained and ignored without creating a transaction.

Physical exercise, instrument adjustments, unknown layouts, incomplete identities, arithmetic mismatches, and probable manual duplicates require review. Physical delivery cannot be auto-imported until the delivered-security mapping is explicit.

## Idempotency

Document SHA-256 prevents the same PDF from being ingested twice. A normalized transaction fingerprint protects the ledger when different documents describe the same event. The database enforces both protections. Retrying an already-imported row returns its existing transaction.

## Live Connector Preconditions

Before implementing HTTP calls, provide the current authenticated contract that defines:

- authorization and token endpoints and payloads;
- Session-TAN activation and challenge handling;
- PostBox metadata endpoint, filters, page/cursor semantics, and stable document ID;
- document-download endpoint and response format;
- token/session expiry behavior and error payloads.

After that contract is available, implement the typed adapter in `lib/comdirect/client.ts`, add fixture-based mocked transport tests, run a metadata-only pilot, then enable bounded document download. No public sandbox exists, so production tests must start read-only and with strict limits.
