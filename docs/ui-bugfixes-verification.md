# UI Bugfixes Verification

Implementation branch: `codex/ui-bugfixes`, based on `main` at `525b225`.
The separate analytics checkpoint `e77c260` is preserved and was not merged.

## CR-01

`app/actions/transactions.ts:deleteTransaction` checks actual-data mode, authentication, transaction owner, requested account context, and portfolio owner. The RLS client performs one scoped canonical delete. Existing FKs cascade components and detach import rows; source documents are untouched. Root-layout revalidation refreshes transaction-derived routes. The existing Decision Drawer provides explicit confirmation, cancel focus, pending/error states and success feedback. URL/account context is retained by refresh rather than redirect.

Mocked server-action execution covers owner, foreign owner, foreign portfolio, wrong context, anonymous access, presentation mode, invalid IDs and failed deletion. Migration contract checks verify cascade/source preservation. No live portfolio transaction was deleted for testing.

## CR-02 And CR-03

Shared `TimeSeriesChart` supports two right axes, independent formats/extents, canonical-ID clickable observations, responsive adjacent bars and optional visible-height caps. Payment-date yield uses YTD factual dividend cash divided by active LIFO acquisition cost, with annual reset. Existing calendar-year average-cost yield remains unchanged. Price dividend/share and Position cumulative-dividend maxima are capped at 50%; separate dividend markers are removed, while buy/sell markers remain. Missing financial facts remain unavailable.

Desktop and 390px mobile-browser checks verified bar activation, canonical event drawer, keyboard activation, independent axes and Dividends OFF removing both axes/bars. Rendered SVG measurements gave dividend/share height ratios 0.3333, 0.5, 0.5, 0.5. Mobile screenshots showed no horizontal page overflow. Bars narrow in dense histories, with enlarged hit areas up to the available date spacing; zoom and keyboard activation remain available.

## CR-04

`components/portfolio-development-chart.tsx` and `components/investment-detail-chart.tsx` now mark deployment as stepped. `components/capital-deployment-chart.tsx` was already stepped and retains that configuration. Cumulative dividends are stepped as well. Shared step paths retain exact timestamps without decimation dropping capital events. `investmentHistory` includes transaction dates between quotes without carrying later quotes backwards. Portfolio timeline preserves final zero-capital sale events even without dividends. Recorded acquisition cost remains independent of missing-price availability; market-value gaps are disclosed as incomplete.

## CR-05

`calculateYieldOnCost` is the shared investment-level implementation: previous full calendar-year factual dividends / remaining acquisition cost at that year's final dividend. Later buys do not dilute it. Tests verify EUR120 / EUR2,000 = 6%, prior sales leaving EUR100 / EUR1,000 = 10%, no-dividend 0%, invalid denominator null, same-day ordering, currency guards and presentation scaling. Investment Detail, Dashboard holdings, Transactions' investment context and Dividends reuse this result. Portfolio-wide and per-lot aggregation remain outside the approved definition.

## CR-06

`InvestmentHistoryPanel` owns one TimeViewportProvider for chart and Purchase Lots. Inclusive purchase-date filtering precedes Open/Closed/All without recalculating returns. Browser checks verified presets, navigator keyboard changes, zoom, keyboard pan, empty states, status selection and chart-mode state preservation. Unit tests verify inclusive boundaries and unchanged lot objects.

## Verification

- `npm run lint`: exit 0, no warnings/errors.
- `npm run typecheck`: exit 0.
- `npm test`: 64 tests passed, 0 failed.
- `npm run build`: exit 0, all 18 routes generated, production TypeScript check passed.
- Temporary synthetic UI route removed; no synthetic or derived data persisted.
- No new dependency, migration, provider request or database change was required.

## Validation Limits

Live Supabase deletion/RLS and production account reconciliation were not exercised against the user's financial records. Server behavior was tested with mocks plus existing schema contracts. Responsive checks used an emulated viewport, not physical iOS or a screen reader. Aggregate/per-lot Yield on Cost still requires a separate product definition and was not invented.
