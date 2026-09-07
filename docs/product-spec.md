# Alpha Product Specification

## Status And Authority

This is the highest-ranking product specification for Alpha. Calculation details remain governed by `docs/analytics-rules.md`, and presentation details remain governed by `docs/ui-ux-spec.md`.

## Product

**Name:** α Alpha

**Tagline:** Analyze every investment. Measure every decision.

Alpha is a transaction-led investment analytics product for individual investors who want to understand not only portfolio performance, but which investments and individual decisions created that performance.

## Core Purpose

Alpha helps users understand:

1. how their portfolio is performing;
2. what individual investments contributed; and
3. which individual investment decisions created the result.

## Product Hierarchy

The primary analytical drill-down is:

```text
Portfolio -> Investment -> Decision / Lot
```

This hierarchy is a fundamental product principle. Portfolio provides the overview, Investment Detail explains the user's relationship with one security, and Decision/Lot analysis evaluates individual purchases and the effects of subsequent sells and dividends.

## Source Of Truth

Transactions remain the canonical source of truth.

- Buy, sell, dividend, fee, and tax events are stored as transaction facts.
- Holdings, purchase lots, ownership state, portfolio development, and performance metrics are derived.
- Derived values must be reproducible and traceable to contributing transactions and market data.
- Market prices and provider dividends are supporting reference data; actual received dividends remain transactions.
- Calculated holdings must not become manually maintained master data.

## Primary V1 Navigation

The intended top-level navigation is:

- Portfolio
- Investments
- Dividends
- Transactions

Secondary navigation is:

- Import
- Settings

Stock Analytics, Lot Analytics / Transaction Analytics, and Market Data must not remain independent primary analytical destinations in the target V1 experience.

- Existing Stock Analytics capabilities should be reused in Investment Detail.
- Existing Lot/Transaction Analytics capabilities should be reused in Purchase Lots and Decision Analytics.
- Market Data remains supporting operational and administrative functionality, accessible where needed without competing with the primary analytical hierarchy.

## Portfolio

Portfolio is the default analytical home. It answers the user's highest-level questions about value, return, deployed capital, realized and unrealized outcomes, dividends, time-based returns, and the holdings driving the result.

V1 includes:

- the nine-metric hierarchy defined in `docs/ui-ux-spec.md`;
- portfolio value and current deployed capital over time;
- optional cumulative dividends;
- period selection;
- current holdings with sortable performance metrics;
- one active benchmark selected from MSCI World, S&P 500, and DAX;
- account context that updates all portfolio calculations and views.

Benchmark comparisons must use a common normalized basis. A benchmark-relative KPI may be labeled `α` only after its statistical definition has been approved.

## Investments

Investments is a searchable and filterable inventory with Current, Closed, and All states. Selecting an investment opens Investment Detail.

Investment Detail is Alpha's signature experience. It combines:

- investment-level KPIs;
- price and position-value history;
- buy and sell decision markers;
- optional dividend markers;
- historical portfolio state;
- transaction and decision analysis in context;
- open and closed purchase lots; and
- calendar-year security performance compared with a benchmark.

Security calendar-year price performance and the user's personal investment return are distinct concepts and must be labeled accordingly.

## Dividends

Dividends is a dedicated V1 analytical destination. Dividend contribution also appears contextually in Portfolio, Investment Detail, Decision/Lot analysis, Yield on Cost, and optional chart series or markers.

Actual received dividends derive from transaction records. Provider dividend events remain reference data and must not silently replace received cash amounts.

## Transactions

Transactions is the efficient source-of-truth ledger for the complete accessible history. Selecting a transaction exposes analytical context using a drawer or equivalent contextual expansion where practical; it does not replace the ledger.

## Accounts, Privacy, And Access

- The product architecture anticipates multiple portfolios or broker accounts even while only one may exist.
- The active account selection updates KPIs, charts, holdings, transactions, dividends, and calculations.
- A user's transactions and all values derived from them are private to that user and protected by Row Level Security.

## Currency And Language

- V1 user-facing analytics are shown in EUR using international/English number formatting.
- Correct EUR presentation for non-EUR assets requires an approved FX and valuation methodology; relabeling native-currency values as EUR is not conversion.
- V1 language is English.
- The architecture should remain localization-ready and support future configurable base currency.

## Trust And Transparency

Alpha must make derived metrics understandable without cluttering the primary interface.

- Calculations should link to actual contributing transactions and market data.
- Missing data must not be presented as zero when that would be misleading.
- Return concepts must be named precisely and must not be conflated.
- Ambiguous metrics receive concise explanations and deeper calculation breakdowns.
- Errors should be contextual and data-quality limitations visible.

## V1 Experience Principles

- Light-first, premium, calm, and analytical.
- Strong information hierarchy rather than equal KPI cards.
- Portfolio charts contain no transaction markers; Investment Detail charts do.
- Desktop tables become purpose-designed mobile rows instead of compressed wide tables.
- Core workflows meet WCAG AA accessibility expectations.
- Global investment search is V2, not V1.

## Implementation Principle

> Alpha is being evolved, not rebuilt. Preserve working infrastructure, data models, market-data capabilities, authentication, transaction-source-of-truth behavior, and analytics implementations wherever they remain consistent with the authoritative specifications. Refactor or replace only behavior that conflicts with approved requirements or is technically necessary to support them.

> Do not treat visual redesign as justification for rewriting the analytics/data layer.

## Unresolved Analytics Decisions

The following require explicit product decisions before affected implementation behavior can be considered final. This specification does not choose answers:

1. Portfolio Total Return after partial or full sales, including realized-gain treatment and denominator/methodology.
2. Realized Gain at portfolio and investment level.
3. One deliberate lot-matching policy, because current views use differing FIFO/LIFO behavior.
4. Dividend semantics, including gross versus after-tax treatment and tax assumptions in performance.
5. Yield on Cost definition, because current views use inconsistent concepts.
6. EUR/FX valuation methodology for multi-currency assets.
7. Return Current Year and Return Last 365 Days methodology.

These decisions must be recorded in `docs/analytics-rules.md` when approved. Existing behavior is evidence for review, not automatic approval.
