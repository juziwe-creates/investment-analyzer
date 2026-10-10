# Dated stock splits and historical reload

## Calculation contract

- Original buys, sells, quantities, broker amounts and personal dividend transactions remain unchanged in `transactions`.
- `market_splits` stores provider events privately by owner, portfolio, security and effective date. The canonical ratio is new shares / old shares.
- Splits apply before trades on their effective date. A purchase on that date already uses post-split units. Events before the first purchase do not affect the position.
- Each open lot's remaining quantity is multiplied by the ratio. Its current-unit cost per share is divided by the same ratio. Original and remaining total acquisition costs stay unchanged.
- The number originally bought and the actual original purchase price remain historical facts. Current cost per share and remaining quantity reflect subsequent splits.
- A split creates no buy, sell, dividend, taxable cash, profit, or XIRR cash flow.
- FIFO/LIFO sales consume the updated quantities and cost per share. Ownership uses actual sale allocations rather than comparing original and remaining share counts.
- Benchmark exits use the fraction of original acquisition cost released, not post-split shares divided by original shares. Benchmark units do not change at a security split.
- Holdings and historical value use provider raw `close_price`. `adjusted_close_price` remains stored for audit but is not used for actual position valuation; it contains dividend adjustments as well as split adjustments.
- A carried prior raw quote is rebased for split events between its quote date and the valuation date. A newly fetched raw quote on/after the split is not adjusted again.
- Annual price returns and daily price changes rebase raw quotes to common share units using the explicit events. They exclude dividends. Personal recorded dividend cash is still the only actual dividend input to Economic Value.
- Provider dividend reference data retains native currency and unadjusted per-share amounts. It never creates personal dividend transactions.
- EODHD can include spin-off/reorganisation adjustment factors in its split feed. The automatic importer accepts positive whole-number forward/reverse factors and 3-for-2 splits. Other ratios stop the sync for document-based review. Cash-in-lieu and cross-ISIN share-class distributions require separate corporate-action support; no quantity is inferred for them.

Provider contracts: [EODHD splits/dividends](https://eodhd.com/financial-apis/api-splits-dividends) and [EODHD historical prices](https://eodhd.com/financial-apis/api-for-historical-data-and-volumes).

## Release order

1. Apply `supabase/migrations/20261011000000_stock_splits_and_history_reload.sql` in Supabase SQL Editor. It creates the private split table and admin-only atomic replacement functions. It does not delete existing history or alter transaction rows. Existing `benchmark_prices` must already be present.
2. Keep the application deployment on its existing version while preparing the reload. The new version requires the split table. Do not deploy it before applying the migration.
3. Stage and apply one security with a known split, then all eligible securities. Review shares, purchase costs, a pre/post-split chart interval, and partial/full sales against broker records before broad rollout.
4. Deploy the split-aware application with the replacement data. Old manually imported history may have an undocumented adjustment convention; the reload removes competing provider history only for securities that have a validated replacement.

## Offline administration tool

`tools/market-backfill.mjs` runs locally, outside Vercel request-duration limits. It never exposes an admin key to a browser. Required local environment variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-existing-project-url
SUPABASE_SERVICE_ROLE_KEY=local-administration-only
EODHD_API_TOKEN=your-existing-token
```

Keep the administration key only in a local ignored environment file. No purchased provider credentials are included in source or artifacts.

Example PowerShell commands, run from the repository directory:

```powershell
node --env-file=.env.local tools/market-backfill.mjs plan --portfolio 40a28dae-d620-4aa6-9fbd-c4be6a28b65e
node --env-file=.env.local tools/market-backfill.mjs download --portfolio 40a28dae-d620-4aa6-9fbd-c4be6a28b65e --security YOUR_ALPHABET_ISIN --max-calls 3
node --env-file=.env.local tools/market-backfill.mjs apply --portfolio 40a28dae-d620-4aa6-9fbd-c4be6a28b65e --security YOUR_ALPHABET_ISIN
```

- `plan`: reads all owner-scoped transactions, transaction-derived securities and saved EODHD symbols; no provider calls or database writes. Includes closed positions.
- `download`: starts seven days before each security's first purchase and ends today; stages raw daily prices, split events and reference dividends. Three API requests per eligible security, spaced at least 1.2 seconds apart. `--max-calls` is a hard per-run request cap. Stop on quota/access errors; completed staged files remain available. Unchanged same-day stages are reused unless `--force` is supplied.
- `apply`: makes no provider calls; verifies the transaction fingerprint and scope, checks date coverage and suspicious split/price discontinuities, backs up current rows locally, then calls the atomic replacement RPC. An RPC failure rolls back the corresponding deletes and inserts. Other securities retain their existing rows until their own replacements succeed.
- Without `--security`, the tool includes every security with purchase history and a confirmed German EUR listing. Missing mappings or non-German listings are reported and skipped, not assigned a guessed currency. A later mapping change requires staging again.
- Backups, plans and staged payloads are under ignored `.market-backfill/<portfolio-id>/`. Do not delete these until signed-in validation succeeds. Backups contain original provider rows and can be restored through an administrator-reviewed database import.
- This replaces all `market_prices`, `market_dividends` and `market_splits` for each validated security, including old manual provider price history. It preserves `manual_security_prices` (explicit user overrides), sync logs, documents and all transactions, including actual dividends.
- The initial reload may report missing price coverage, corporate actions requiring review, delisted symbols or genuine overnight crashes as review items. It never interpolates missing prices or overwrites them with zeros.

## Existing benchmark table

The optional `--benchmarks path/to/config.json` argument includes the confirmed entries in `tools/benchmark-backfill.example.json`. Existing application IDs are `msci-world`, `sp-500`, `dax`. Unconfirmed entries retain all existing uploaded rows.

Before marking an entry confirmed, verify its EODHD symbol, native currency and exact price/net/gross/performance return methodology. A subscription including indices does not establish that a particular MSCI EUR net-total-return series is available. Do not substitute an ETF, USD price index, or similarly named index for the current series.

- Daily rows go into the existing `public.benchmark_prices`; no new benchmark/import table is created.
- The tool verifies existing row fields against the documented schema in `docs/database-design.md`. Replacement uses `(benchmark_id, price_date)` and is atomic per index.
- Existing benchmark return methodology must match the configured replacement; both the tool and RPC reject a mismatch.
- Native EUR levels are used directly. Confirmed USD indices are converted with prior-or-same-date `EURUSD.FOREX` rates (no look-ahead, at most seven days old) and labeled as derived EUR. Other currencies require an explicit extension.
- No extra benchmark dividend cash is fabricated. A price index remains labeled price index; total-return semantics come from the confirmed source.
- The shared table's client permissions remain authenticated read-only. Only the offline service-role tool may replace benchmark history.

## Verification and remaining prerequisites

Run `npm test`, `npm run test:splits`, `npm run typecheck`, `npm run lint`, and `npm run build`.

Live execution requires the migration, local administrative credentials, confirmed benchmark mappings, and signed-in validation against the actual broker quantities. This package prepares that execution; it does not automatically run a live deletion or reload.
