# Historical reload execution checkpoint

Executed 2026-10-11 after the owner configured local administrative and provider credentials. Database migration was applied by the owner before execution. No secrets, backups, private catalogue overrides or staged financial data are committed.

## Completed

- Owner-scoped raw daily security histories were staged, validated, backed up and replaced atomically. Stored per-security counts and first/last dates were checked against every staged file.
- Original transaction rows were fingerprinted before and after execution and matched exactly. Actual personal dividends and document records were not rewritten.
- Dated Alphabet and NVIDIA stock splits are stored and applied by the existing lot engine, with original acquisition costs preserved.
- DAX uses `GDAXI.INDX`, native EUR, `performance_index`.
- S&P 500 uses `SPXNTR.INDX`, `net_total_return`, converted from USD with prior-or-same-date `EURUSD.FOREX` closes. `SP500NTR.INDX` was rejected for this reload because its coverage started too late.
- Both refreshed benchmark series cover the first investment period through the latest trading day. They replace/add rows in the existing `benchmark_prices` table, retaining its client read-only permissions.
- Verified EUR mappings are saved for subsequent incremental syncs. Exact-ISIN Frankfurt alternatives were used when the Xetra listing lacked history or was absent.

## Remaining Data Gaps

- MSCI World: its existing EUR net-total-return weekly history is preserved. No equivalent index was found in the EODHD index catalogue or index search; do not substitute an ETF or price-only proxy without an explicit methodology decision.
- Historical corporate-action identities, products unsupported by the provider, and positions without acquisition history are retained for review. Existing rows for those identities were not removed.
- A legacy security identifier contains trailing whitespace. Its original ledger identity is preserved; the history is available under that identity. Normalising ledger identities is a separate data-cleanup task.

## Tool Improvements

- Planning now derives one canonical identity per transaction group instead of trusting duplicated live `user_securities` view rows.
- `--catalogue` accepts verified EUR Xetra/Frankfurt reference data. A successful existing mapping can be reused; a catalogue-confirmed contradictory ISIN is rejected.
- `--symbol` permits a single-security alternate listing only with an exact catalogue ISIN/EUR match.
- `--only-benchmarks` runs reference history ingestion independently of securities.
- Unchanged stages are reused. Independent coverage/identity failures are reported while other securities continue; authentication/quota/rate-limit failures stop the run.
- Local operation reports are separated by scope, and backups remain under ignored `.market-backfill/`.

## Release Status

The application work remains on `codex/chart-fixes-portfolio-map`; no merge to main was authorised in this execution. Test the signed-in preview against the refreshed live data before merging. Private verification results and recoverable backups are retained locally in `.market-backfill/`.
