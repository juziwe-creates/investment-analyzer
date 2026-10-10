# Stock splits / historical reload checkpoint

Implementation is on `codex/chart-fixes-portfolio-map`, based on preview commit `9a0ac32`. No merge to main, live migration or reload has been performed. Apply the migration before testing a preview containing this package.

Implemented:

- Dated EODHD split ingestion with private RLS storage and owner-scoped reads.
- Split-aware lots, holdings, dividend eligibility, current/annual price comparisons, portfolio/investment histories and benchmark exits.
- Actual valuation uses raw closing prices; dividend-adjusted close is audit-only.
- Local plan/download/apply administration tool; paginated reads, request cap/delay, staged downloads, transaction fingerprint, local backups and atomic per-security/per-index replacement.
- Existing `benchmark_prices` reused; confirmed EUR index histories or dated USD-to-EUR conversion; no guessed index symbols or return methodology.

Verified: 116 existing tests and 13 targeted split/backfill tests passed. Typecheck, lint and production build passed during implementation (Google Fonts required network-enabled build). No database runtime validation or authenticated UI check was possible without applying the migration and loading live split events.

Next execution prerequisites:

1. Apply `20261011000000_stock_splits_and_history_reload.sql` before deploying this application revision.
2. Configure local-only `SUPABASE_SERVICE_ROLE_KEY`; do not add it to a browser environment or commit it.
3. Plan and stage Alphabet alone, review downloaded coverage/split events and actual broker quantities, then apply its replacement and verify split-aware charts.
4. Stage/apply other mapped EUR securities, including exited positions. Irregular corporate-action factors and suspicious price discontinuities require review rather than fabricated corrections.
5. Confirm equivalent EODHD symbols, native currencies and price/net/gross/performance return methodology for `msci-world`, `sp-500`, `dax`; update the benchmark config and run the same staging/replacement flow. Existing benchmarks remain unchanged until then.

Detailed procedure and financial rules: `docs/stock-splits-and-backfill.md`.
