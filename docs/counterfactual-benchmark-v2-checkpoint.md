# Counterfactual Benchmark V2 Checkpoint

Status: implementation verified on main after 431b839; this checkpoint accompanies the V2 implementation commit. Not pushed or deployed. Analytics Universe remains unmerged.

The user approved preserving FIFO on Dashboard and LIFO on Investment Detail, and using the existing recorded-dividend return model without the legacy tax multiplier. These rules are recorded in docs/analytics-rules.md.

Implemented shared virtual benchmark lots using the engine's exact sale allocation traces, EUR timelines, source-linked lot and holding comparisons, shared XIRR, prior observation matching, missing-data disclosure, metadata and benchmark-preserving navigation. Existing Actual views are retained. Portfolio and Position Value charts consume server-calculated counterfactual timelines.

Verification: 88 automated tests passed; typecheck, lint and production build passed. Desktop/mobile fixture verified switching MSCI World/DAX, current and closed lot comparisons, detailed metrics, benchmark-preserving links and unavailable S&P history. Mobile page has no horizontal overflow. Temporary fixture removed and development server stopped. Final test/lint rerun after the last currency guard passed.

No schema changes, database writes, reimports, provider calls or alpha metric. Live authenticated Supabase verification remains for deployment. Unrelated cache, scripts and manual imports are preserved.

Next: push when authorized, then signed-in smoke test. The scheduled automation is removed because this implementation run completed. Included usage was 83% used at the final build checkpoint; purchased-credit balance unchanged during this run.
