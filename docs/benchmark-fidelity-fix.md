# Benchmark Zoom And Fidelity Fix

Implemented on 2026-09-20 against the existing `public.benchmark_prices` dataset.

## Scope

- Primary chart dates alone control the shared viewport; benchmark dates control overlay rendering only.
- Daily benchmark observations are used automatically for entry, exit, valuation, cash-flow and timeline calculations when present. Prior-or-same-date matching remains mandatory and never looks ahead.
- Purchase-lot comparison includes a reproducible calculation trace and warns when the entry observation is more than three calendar days old.
- Existing transaction fee components are loaded through the authenticated transaction relation. Historical buys without any component detail may use a larger factual net debit as their all-in acquisition cost. Taxes are not reclassified as fees.

## Data Review

The schema defines RLS-protected `transaction_components` owned through their parent transaction. Existing trade import scripts insert `fee` components alongside gross and net amounts, while dividend imports insert tax or withholding-tax components. The application previously selected only `transactions.*`, so those stored fees did not reach the analytics engine. The transaction reader now selects only the component fields required by analytics.

`benchmark_prices` has primary key `(benchmark_id, price_date)`. Daily and weekly rows are therefore one canonical date series, not parallel datasets. This change adds no migration, import, database write or provider call.

## Verification

Automated coverage verifies unchanged viewport full range, minimum zoom, presets, pan and navigator ratio across benchmark overlays; exact daily matching; weekend fallback; no look-ahead; weekly compatibility; volatile Friday-to-Monday precision; anonymized multi-purchase trace reconciliation; explicit fee use; safe net-debit fallback; and presentation scaling.
