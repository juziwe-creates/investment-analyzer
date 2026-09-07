# Specification And Implementation Discrepancies

## Purpose

This register compares the authoritative Alpha target with the current repository implementation as inspected during Phase 0. It prepares implementation work; it does not authorize or perform application changes.

Classifications:

- **KEEP** - implementation already aligns sufficiently.
- **REFINE** - implementation is mostly correct but needs adjustment.
- **REFACTOR** - the underlying capability is useful, but its presentation or structure conflicts with the target.
- **MISSING** - required target capability is not implemented.
- **DECISION REQUIRED** - correction depends on an approved product or analytics definition.
- **V2/FUTURE** - intentionally outside V1.

## Design Foundation

| Requirement | Classification | Current implementation | Recommended disposition |
| --- | --- | --- | --- |
| α Alpha branding and tagline | KEEP | Alpha wordmark and refreshed authentication/analytical styling exist. | Preserve and apply consistently during recomposition. |
| Geist and tabular numerals | KEEP | Geist and financial-number styling are established. | Preserve; verify every analytical surface. |
| Semantic color/design tokens | REFINE | Alpha-oriented CSS tokens exist, but older component styles still coexist. | Consolidate remaining hard-coded or generic component styles during Phase 1. |
| Light-first theme | KEEP | Current redesign foundation is light-first. | Preserve token structure for later dark mode. |
| Collapsible desktop sidebar | KEEP | Collapsible sidebar exists and retains the Alpha mark. | Recompose destinations to the approved hierarchy. |
| Mobile bottom navigation | REFINE | Bottom navigation exists, but `More` currently links directly to Transactions and has no complete More menu. | Implement Portfolio, Investments, Dividends, More with Transactions, Import, and Settings under More. |
| Restrained card usage | REFINE | Newer pages use sections, while several forms/tables still use generic Card wrappers. | Replace only wrappers that conflict with the approved hierarchy; preserve functional internals. |
| Responsive behavior | REFINE | Responsive foundations exist, but several wide analytical tables depend on horizontal scrolling. | Add purpose-designed mobile KPI, holdings, lot, and transaction representations. |
| WCAG AA foundations | REFINE | Focus styles and semantic tables exist in parts of the app. | Complete keyboard, drawer focus, non-color status, chart alternative, and reduced-motion checks. |

## Navigation And Information Architecture

| Destination/capability | Classification | Current implementation | Recommended disposition |
| --- | --- | --- | --- |
| Portfolio | REFINE | `/dashboard` provides the portfolio overview and charts. | Keep capability; make it the clear default analytical home and complete its required metrics. |
| Investments | REFINE | `/portfolio` provides current holdings with filters. | Expand to Current, Closed, and All inventory and link to Investment Detail. |
| Dividends | MISSING | Route is a placeholder. | Build the dedicated V1 dividend analytical destination. |
| Transactions | REFINE | Ledger and manual-entry form exist. | Preserve ledger; add full-history access and contextual analytical interaction. |
| Stock Analytics | REFACTOR | Standalone route/table aggregates lot analytics by security. | Reuse calculations and table concepts inside Investment Detail; remove as a primary destination. |
| Lot Analytics / Transaction Analytics | REFACTOR | Standalone route/table exposes purchase-lot profitability. | Reuse inside Investment Detail purchase lots and transaction/decision drawers. |
| Market Data | REFACTOR | Mature operational sync center is a primary sidebar destination. | Preserve capability as supporting administration, but remove it from primary analytical navigation. |
| Import | REFINE | Route is a placeholder; underlying import schema/history exists. | Keep navigation; do not overbuild during the visual redesign. |
| Settings | KEEP | Minimal placeholder fits the V1 scope. | Keep accessible; defer significant redesign. |
| Global investment search | V2/FUTURE | Not implemented. | Do not add in V1. |

## Portfolio

| Requirement | Classification | Current implementation | Recommended disposition |
| --- | --- | --- | --- |
| Nine-metric KPI hierarchy | MISSING | Portfolio hero plus four secondary values are shown. | Implement the approved hierarchy after unresolved metric definitions are decided. |
| Portfolio Value | REFINE | Hero value exists and distinguishes incomplete pricing. | Preserve data-quality handling and align with approved EUR methodology. |
| Total Return amount and percent | DECISION REQUIRED | Current value is based on current summary profitability and invested capital. | Approve treatment after partial/full sales and denominator before finalizing. |
| Current Deployed Capital | REFINE | Current invested-capital value exists. | Add traceable calculation breakdown and confirm naming across views. |
| Realized Gain | DECISION REQUIRED | Lot engines expose sale allocation, but no approved portfolio/investment definition exists. | Define methodology before surfacing as authoritative. |
| Unrealized Gain | REFINE | Current/priced investment gain is available. | Clarify denominator, missing-price behavior, and relation to realized gain. |
| Dividends | KEEP | Received dividends appear in portfolio metrics and capital-deployment analytics. | Preserve transaction-derived source and integrate in the target hierarchy. |
| Annualized Return | REFINE | XIRR exists for lots/stocks; portfolio-level presentation is incomplete. | Reuse the XIRR engine only after portfolio cash-flow scope is approved. |
| Return Current Year | DECISION REQUIRED | Required metric is not shown and methodology is unapproved. | Approve cash-flow-aware methodology before implementation. |
| Return Last 365 Days | DECISION REQUIRED | Required metric is not shown and methodology is unapproved. | Approve cash-flow-aware methodology before implementation. |
| Performance chart | REFINE | Portfolio/deployed-capital timeline, period filters, security filters, tooltips, and missing-price messaging exist. | Recompose visual treatment and retain reproducible calculations. |
| Cumulative dividend toggle | MISSING | Dividends are shown in a separate capital-deployment chart, not as the specified optional portfolio series. | Add a disabled-by-default series toggle. |
| Benchmark selector | MISSING | No selector for MSCI World, S&P 500, or DAX. | Add after benchmark-data strategy is available. |
| Normalized benchmark comparison | MISSING | Benchmark prices and normalized comparison are absent. | Store/fetch benchmark history and normalize both series to 100 at period start. |
| `α` KPI | DECISION REQUIRED | No benchmark-relative KPI is shown. | Define the statistical calculation before using the `α` label. |
| Holdings table | REFINE | Current holdings table has filters and several performance columns. | Align required columns, default weight sort, full-row navigation, sticky header, and mobile rows. |
| Account selector/context | MISSING | Header displays static `All Accounts`; queries do not use a persistent selector. | Add context that filters every analytical and ledger query. |

## Investment Experience

| Requirement | Classification | Current implementation | Recommended disposition |
| --- | --- | --- | --- |
| Investment Detail route/page | MISSING | No investment-detail route exists. | Build the signature drill-down from the Investments inventory. |
| Investment KPIs | REFACTOR | Many metrics exist in standalone Stock Analytics. | Reuse calculators in the Investment Detail hierarchy after metric decisions. |
| Price / Position Value toggle | MISSING | No investment chart exists. | Add the specified two-mode investment chart. |
| Buy/sell markers | MISSING | No investment chart markers exist. | Add shape-and-color markers, visible by default. |
| Optional dividend markers | MISSING | No investment chart markers exist. | Add a disabled-by-default dividend marker toggle. |
| Historical portfolio-state tooltip | MISSING | Portfolio chart tooltips exist, but not security-specific historical state. | Derive price, shares, value, deployed capital, and unrealized return at hover date. |
| Transaction decision drawer | MISSING | No contextual analytical drawer exists. | Build one reusable drawer for chart markers and ledger interactions with focus management. |
| Open / Closed / All purchase lots | REFACTOR | Lot Analytics provides rows and ownership status in a standalone page. | Recompose beneath Investment Detail with Open as default. |
| Annual Performance grid | MISSING | No calendar-year security-performance grid exists. | Implement price-performance definition from the UI/UX specification. |
| Benchmark and difference rows | MISSING | No benchmark history is available. | Add after benchmark data is implemented; keep personal-return semantics separate. |

## Dividends

| Requirement | Classification | Current implementation | Recommended disposition |
| --- | --- | --- | --- |
| Dedicated analytical page | MISSING | Dividends route is a placeholder. | Build portfolio and investment dividend analysis from actual dividend transactions. |
| Yield on Cost | DECISION REQUIRED | Current lot logic uses latest allocated payment; older documentation also describes trailing-twelve-month behavior. | Approve one exact definition before presenting it as canonical. |
| Dividend contribution | REFINE | Portfolio totals and lot allocations exist. | Reuse calculations across Portfolio, Investment Detail, and drawers after gross/net policy is decided. |
| Gross versus after-tax semantics | DECISION REQUIRED | Stock/Lot Analytics assumes a fixed 0.71575 retained factor while other views use received amounts. | Decide whether metrics are gross, net, both, or configurable. |

## Transactions

| Requirement | Classification | Current implementation | Recommended disposition |
| --- | --- | --- | --- |
| Default ledger | KEEP | Transaction history table provides date, type, security, quantity, prices, gross, and net. | Preserve as the efficient default. |
| Complete history/pagination | REFINE | Server query is limited to the latest 50 rows with no pagination. | Add pagination or cursor-based complete history. |
| Analytical row interaction | MISSING | Rows are static. | Open contextual performance detail when a transaction is selected. |
| Decision drawer | MISSING | No shared analytical drawer exists. | Reuse the Investment Detail transaction drawer pattern. |
| Transaction-source-of-truth behavior | KEEP | Transactions drive holdings and analytics and are protected by RLS. | Preserve. |

## Responsive And Mobile

| Requirement | Classification | Current implementation | Recommended disposition |
| --- | --- | --- | --- |
| Portfolio/Investments/Dividends/More bottom nav | REFINE | Four-item bottom nav exists, but More is not a menu. | Implement the approved behavior. |
| Mobile KPI hierarchy | MISSING | Desktop grids reflow but no intentional progressive disclosure exists. | Build the compact hero plus expandable secondary metrics. |
| Mobile holdings | MISSING | Desktop table remains a wide table. | Render compact analytical rows/cards with direct detail navigation. |
| Mobile lot/transaction presentation | MISSING | Wide tables rely on overflow behavior. | Use stacked rows and mobile drawer/sheet patterns. |

## Trust, Data Quality, And States

| Requirement | Classification | Current implementation | Recommended disposition |
| --- | --- | --- | --- |
| Calculation explanations | REFINE | Formula prose exists on analytics pages and in documentation, but values do not consistently expose their contributing records. | Add reusable calculation breakdowns backed by actual transaction IDs. |
| Concise metric tooltips | MISSING | Complex metric labels generally have no contextual tooltip. | Add only for materially ambiguous metrics. |
| Data-quality messaging | KEEP | Portfolio and analytics identify missing prices instead of silently treating them as zero. | Preserve and make messages reusable. |
| Skeleton loading | MISSING | No route-specific layout-preserving skeletons were found. | Add skeleton states to the main analytical routes. |
| Polished empty states | REFINE | Basic placeholders and dashed empty areas exist. | Add clear next actions without implying zero-valued analytics. |
| Inline errors | KEEP | Main data pages render contextual inline query errors. | Preserve and add targeted retry actions where practical. |
| EUR-only presentation | DECISION REQUIRED | Transactions and prices carry currency, but an approved cross-currency valuation layer is absent. | Define FX source, valuation date, fallback, and auditability before claiming converted EUR values. |

## Cross-Cutting Decisions Required Before Phase 1 Completion

1. Portfolio Total Return after partial/full sales: realized gains and denominator/methodology.
2. Realized Gain: exact portfolio and investment-level definition.
3. Lot matching: one deliberate policy across views, or explicitly approved context-specific policies.
4. Dividend semantics: gross versus after-tax and the place of tax assumptions in performance.
5. Yield on Cost: one exact definition and applicable time window.
6. EUR/FX: conversion source, date, storage/derivation, and missing-rate handling.
7. YTD and last-365-day return: exact cash-flow-aware methodology.
8. `α`: exact statistical definition before the label is used.

## Preservation Rule

Alpha is being evolved, not rebuilt. Existing authentication, RLS, transaction schema, market-data adapters and sync controls, import traceability, missing-data safeguards, and deterministic analytics should be retained wherever they do not conflict with the authoritative specifications. Visual redesign alone is not a reason to rewrite the analytics or data layer.

## Packages 1-7 Final Status

This status was recorded after the coordinated implementation run. `BLOCKED` means the UI and surrounding architecture were implemented without fabricating the unavailable calculation or data.

| Area | Final state | Result / remaining constraint |
| --- | --- | --- |
| Alpha branding, Geist, tokens, light theme | RESOLVED | Geist is loaded through Next.js; semantic tokens, tabular numerals, restrained surfaces, and reduced-motion behavior are present. |
| Desktop navigation | RESOLVED | Primary destinations are Portfolio, Investments, Dividends, Transactions, Import, and Settings. |
| Mobile navigation | RESOLVED | Portfolio, Investments, Dividends, and a functional More menu are implemented. |
| Stock Analytics destination | RESOLVED | Old route redirects to Investments; its calculations are reused in investment inventory/detail. |
| Lot Analytics destination | RESOLVED | Old route redirects to Transactions; lot calculations are reused in Purchase Lots and decision drawers. |
| Market Data information architecture | RESOLVED | Removed from primary navigation and retained as supporting functionality from Settings. |
| Account/portfolio context | RESOLVED | Persistent selector filters Portfolio, Investments, Investment Detail, Dividends, Transactions, and Market Data using existing portfolios. |
| Portfolio Value and deployed capital | RESOLVED | Displayed from priced open holdings with missing-price and non-EUR aggregation safeguards. |
| Portfolio Total Return | BLOCKED | Exact treatment after partial/full sales and denominator remain unresolved; UI shows `Pending definition`. |
| Portfolio Realized Gain | BLOCKED | Portfolio/investment-level definition remains unresolved; UI shows `Pending definition`. |
| Portfolio Unrealized Gain | RESOLVED | Current/priced open-position value less remaining cost basis is shown with missing-price disclosure. |
| Portfolio Dividends | RESOLVED | Actual received dividend transactions are shown, subject to EUR aggregation availability. |
| Portfolio Annualized Return | BLOCKED | Cash-flow scope, lot rule, and dividend semantics remain unresolved; UI shows `Pending definition`. |
| YTD and last-365-day returns | BLOCKED | Methodology remains unresolved; required metric positions are present and marked pending. |
| Portfolio performance chart | RESOLVED | Portfolio Value and Current Deployed Capital are default; cumulative dividends are optional and off by default; period and interval controls remain available. |
| Benchmark selector | RESOLVED | MSCI World default plus S&P 500 and DAX selection are implemented and preserved in URL context. |
| Normalized benchmark series | BLOCKED | No stored benchmark history or approved ingestion path exists; UI states that comparison is unavailable. |
| `α` KPI | BLOCKED | Formal statistical/product definition remains unresolved and the metric is not displayed. |
| Portfolio holdings | PARTIALLY RESOLVED | Current holdings, weight sorting, numeric sorting, filtering, full-row detail navigation, and mobile rows exist. Return and Yield on Cost cells remain pending their definitions. |
| Investments Current/Closed/All | RESOLVED | Searchable investment inventory and detail links are implemented. |
| Investment Detail | PARTIALLY RESOLVED | Header, factual KPIs, history chart, markers, historical state, drawer, lots, and annual performance exist. Total Return, Realized Gain, dividend-sensitive annualized return, and Yield on Cost remain blocked. |
| Price / Position Value chart | RESOLVED | Both modes are implemented with Price as default. |
| Buy/sell and dividend markers | RESOLVED | Buy/sell markers are visible; dividends are optional and off by default. |
| Historical state tooltip | RESOLVED | Date, price, shares, position value, deployed capital, and unrealized return are inspectable. |
| Decision drawer | RESOLVED | Shared right-side drawer supports marker and ledger interaction, close button, Escape, click-away, focus restoration, and focus containment. |
| Purchase Lots Open/Closed/All | RESOLVED | Existing lot engine is reused; current-model values are labeled as such while policy decisions remain open. |
| Annual security performance | PARTIALLY RESOLVED | Year-end/YTD security price performance is implemented; benchmark and difference rows remain unavailable without benchmark history. |
| Dedicated Dividends page | PARTIALLY RESOLVED | Received totals, current year, contribution by investment, yearly breakdown, history, and investment links are implemented. Yield on Cost remains blocked. |
| Transaction ledger | RESOLVED | Server pagination exposes complete history, with page sorting/filtering and mobile rows. |
| Transaction analytical interaction | RESOLVED | Rows open the shared decision drawer; buy decisions include current-model lot context. |
| EUR/FX safety | PARTIALLY RESOLVED | German-exchange currency-label correction remains; non-EUR values display as unavailable and aggregate analytics are withheld. Actual FX conversion remains blocked by methodology/data. |
| Loading, empty, and error states | RESOLVED | Route skeleton, contextual empty states, inline query errors, and missing-data warnings are present. |
| Calculation transparency | PARTIALLY RESOLVED | Portfolio, Investment Detail, and Dividends expose calculation explanations and blocked definitions. Full per-value transaction lineage remains a later refinement. |
| Responsive analytical layouts | RESOLVED | Core holdings, lots, transactions, dividends, charts, and mobile KPI disclosure avoid desktop-table compression. |
| Global search | INTENTIONALLY DEFERRED | V2 requirement; not implemented. |

## Remaining Authoritative Blockers

1. Portfolio Total Return after partial/full sales and its denominator.
2. Portfolio and investment Realized Gain definition.
3. One authoritative lot-matching policy or approved context-specific policies.
4. Gross, net, and after-tax dividend treatment in performance.
5. Yield on Cost definition.
6. Historical/current EUR FX conversion methodology and data source.
7. YTD and last-365-day return methodology.
8. Formal `α` definition.
9. Benchmark history storage/ingestion for MSCI World, S&P 500, and DAX.
