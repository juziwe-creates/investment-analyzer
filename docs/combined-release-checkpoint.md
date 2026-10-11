# Combined Release Integration - 2026-10-11

The user approved merging `codex/chart-fixes-portfolio-map` and `codex/analytics-universe` into main for MVP testing. Preserve both feature sets rather than replacing either implementation.

## Merge Resolutions

- Shared timeline retains dated split events, raw split-rebased quotes, complete purchase-cost history, and fully sold dates.
- Optional Universe snapshots use the same dated quotes as the historical chart, including carrying a pre-split quote forward in post-split share units. A regression test reconciles snapshot and chart values and verifies closed holdings disappear.
- Profit generated, counterfactual benchmarks, historical sync improvements, Portfolio Map, imports, and presentation behavior remain intact.
- Union of both test configurations and suites; preserve the current Next.js/React and PDF importer dependencies while adding Universe's existing Three.js dependencies. Regenerate the lockfile from the combined manifest.
- No database writes or additional migrations are performed by the merge. Previously applied market-data backfills and ledger corrections remain shared across deployments.

## Verification And Limitations

- Main test suite: 147 passing; split/backfill suite: 20 passing, including the new cross-feature snapshot regression. Typecheck, lint, and production build passed before release.
- Universe's prior synthetic desktop/mobile QA remains documented in `docs/analytics-universe-todo.md`. This integration does not claim a fresh authenticated browser, physical device, or screen-reader check.
- Sector enrichment, company logos, and further Universe visual polish remain deferred as documented. Sector Map and Universe label unknown classifications honestly.
- Unsupported warrants and bonds still cause historical pricing gaps. They must not become zero prices or be silently excluded from complete portfolio totals.
- npm audit reports 13 findings (3 moderate, 9 high, 1 critical, including Next.js). No automatic force-fix or dependency downgrade was applied during this feature merge. A separate scoped dependency security update is required before production use; build/test success is not a security clearance.
- Deployment success must be confirmed from the main commit's Vercel status, not inferred from a local build.
