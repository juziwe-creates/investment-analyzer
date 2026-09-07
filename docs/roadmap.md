# Alpha Roadmap

> Authority note: this roadmap controls implementation order, not product truth. `docs/product-spec.md`, `docs/analytics-rules.md`, and `docs/ui-ux-spec.md` take precedence as defined in `docs/specification-authority.md`.

# How To Read This Roadmap

Phases 0 through 10 below preserve useful implementation history and the sequence in which the current capabilities were conceived or delivered. They are not, by themselves, the target Alpha information architecture.

The approved target recomposes existing capabilities into:

```text
Portfolio
  -> Investment
       -> Decision / Lot
```

Correct analytics engines should be reused. A change in navigation or presentation is not justification for rewriting the transaction, market-data, or analytics layers.

# Product Direction

Alpha should grow from a focused transaction-level portfolio analytics MVP into a broker-independent decision analytics platform.

The north star is:

**Analyze every investment. Measure every decision.**

The roadmap prioritizes a narrow but trustworthy foundation before adding broker automation and advanced analytics.

# Current Implementation Snapshot

As of the Phase 0 documentation audit:

- **Operational foundations:** Next.js/Supabase application shell, authentication, RLS-backed user isolation, transaction-first storage, derived securities/holdings, manual transaction entry, historical/current market-data storage, provider-symbol mapping, and controlled EODHD/Alpha Vantage sync capabilities.
- **Operational analytics:** portfolio and capital-deployment charts, holdings inventory, transaction ledger, purchase-lot calculations, security-level aggregation, dividend allocation, missing-price safeguards, and XIRR calculations in the contexts documented by `docs/analytics-rules.md`.
- **Current presentation:** Portfolio, Investments, Stock Analytics, Lot Analytics, Transactions, Market Data, and placeholder destinations for Dividends, Import, and Settings. This is implementation state, not target navigation.
- **Partially delivered:** CSV/import workflow, dedicated dividend analytics, complete transaction history, multi-account analytical context, and coordinated responsive/mobile treatment.
- **Not yet delivered for target V1:** Investment Detail, contextual decision drawers, benchmark data/comparison, approved `α` metric, annual performance grid, the full nine-metric portfolio hierarchy, and complete calculation-lineage interactions.
- **Later capabilities:** Comdirect automation, additional brokers, richer import/settings workflows, global search, advanced attribution, and deeper risk analytics.

# Historical And Current Delivery Phases

## Phase 0: Foundations And Design

Goal: establish the product and technical foundation before writing application behavior.

Outcomes:

- architecture documented
- database design documented
- domain model documented
- core analytics rules selected
- MVP scope confirmed

Key decisions:

- default lot matching policy
- transaction sign conventions
- currency assumptions
- dividend allocation rule
- price data strategy
- one portfolio versus multiple portfolios in MVP

Deliverables:

- `docs/architecture.md`
- `docs/database-design.md`
- `docs/roadmap.md`
- `docs/analytics-rules.md`

## Phase 1: Project Foundation

Goal: create the application shell and infrastructure for authenticated user workflows.

Scope:

- Next.js application setup
- TypeScript configuration
- Tailwind CSS and shadcn/ui setup
- Supabase client setup
- Supabase Auth integration
- authenticated layout
- basic profile and portfolio setup

Success criteria:

- user can register
- user can log in
- user can access a protected dashboard
- user has a default portfolio

## Phase 2: Transaction-First Data Model

Goal: implement the transaction-first data foundation.

Scope:

- database migrations for MVP tables
- Supabase RLS policies
- typed data access layer
- manual transaction creation and listing
- security identity captured on transactions
- securities derived as a read-only view from transaction history
- transaction component support for fees and taxes
- source document and import run records

Success criteria:

- user can store buy transactions
- user can store sell transactions
- user can store dividend transactions
- user can see securities discovered from transactions
- all user data is isolated by RLS
- transaction records can be traced to manual entry or import metadata

## Phase 3: Manual And CSV Import MVP

Goal: get real user portfolio data into the system before broker automation.

Scope:

- manual transaction entry
- CSV upload flow
- import preview
- validation errors
- duplicate detection
- import run status tracking
- raw row preservation in `import_rows`

Success criteria:

- user can import investment transactions
- user can import dividend transactions
- failed rows are visible and explainable
- imported transactions link back to import rows and source documents

## Phase 4: Portfolio Calculations

Goal: derive holdings and dashboard metrics from transactions.

Scope:

- holding calculation
- current quantity by security
- invested capital
- realized gain
- unrealized gain
- total gain/loss
- total dividends received
- latest price lookup
- dashboard summary service

Success criteria:

- user can see current portfolio value
- user can see invested capital
- user can see total gain/loss
- user can see total dividends received
- no calculated holdings are stored as master data

## Phase 5: Lot-Level Transaction Analytics

Goal: analyze the performance of every purchase decision.

Scope:

- purchase lot model
- sell allocation against lots
- cost basis per lot
- remaining quantity per lot
- current value per lot
- unrealized gain per lot
- gain percentage per lot
- annualized return per lot

Success criteria:

- user can view every purchase lot
- user can compare lot performance
- each metric can be traced to underlying transactions and prices

## Phase 6: Dividend Analytics

Goal: show dividend income and yield on cost at decision level.

Scope:

- dividend transaction processing
- dividend allocation to holdings or lots
- total dividends by security
- total dividends by purchase lot
- current annual dividend field or estimate
- yield on cost calculation

Success criteria:

- user can see total dividend income
- user can see dividend contribution by investment decision
- user can see yield on cost per purchase lot
- dividend analytics are reproducible from transactions

## Phase 6A: Market Data Foundation

Goal: persist daily market prices and reference dividend events so profitability can be calculated for real valuation dates.

Scope:

- provider abstraction for market data vendors
- daily historical market price storage
- reference dividend event storage
- per-security market data sync
- sync run tracking for provider errors and rate limits
- latest market price lookup for profitability calculations
- manual price fallback when market data is missing
- EODHD provider support for historical end-of-day prices and reference dividends
- provider-symbol mappings so sync does not require editing transaction facts
- market-data coverage diagnostics for prices, dividends, recent failures, and securities needing attention
- UI safeguards that keep syncs deliberate while testing with limited provider plans
- German exchange currency-label correction for EODHD `.XETRA` and `.F` prices
- incremental bulk refresh for already-synced stocks, ETFs, and funds

Success criteria:

- user can sync daily prices for a discovered security with a ticker
- daily prices are persisted in `market_prices`
- reference dividends are persisted in `market_dividends`
- sync attempts are visible in `market_data_sync_runs`
- profitability uses latest fetched market price before manual fallback
- provider setup is controlled through server-side environment variables and never exposed to the browser
- user can inspect and override provider symbols one security at a time before spending API calls
- user can see price and dividend coverage before trusting analytics for a security
- user can refresh latest price rows for previously synced stocks and ETFs without a full historical reload

## Phase 7: Portfolio Development

Goal: explain how wealth evolved over time.

Scope:

- historical price support
- portfolio value time series
- invested capital time series
- capital gain time series
- dividend income time series
- chart view
- optional generated portfolio snapshots

Success criteria:

- user can view portfolio development over time
- chart distinguishes invested capital, market value, gains, and dividends
- chart values are reproducible from transactions and prices

## Phase 7A: Convincing Analytics Views

Historical/current implementation phase: the three views below produced useful analytical capabilities. They are not the approved target user-facing architecture.

Goal: make the three core analytics views correct, useful, and polished enough to guide real decisions.

Scope:

- portfolio development and capital deployment view
- transaction analytics view for every purchase lot
- stock analytics view aggregating purchase lots by security
- stock and date filters for analytics tables
- sortable key figures for decision comparison
- after-tax dividend profitability using an explicit tax assumption
- clear handling of missing prices

Success criteria:

- transaction analytics reconciles to purchase lots
- stock analytics reconciles to transaction analytics
- users can rank decisions by raw profit, raw return, dividend yield, and annualized return
- missing historical prices are visible instead of silently distorting results
- the pages remain responsive enough for the current MVP dataset

Backlog:

- add richer graphics for transaction and stock analytics after table metrics are validated
- profile and optimize the three analytics views for larger datasets
- move expensive repeated analytics into cached server-side calculations or snapshots if needed
- complete historical price coverage for the full portfolio

Target recomposition:

- portfolio development and holdings become the Portfolio experience;
- security-level calculations become part of Investment Detail;
- transaction/lot calculations become Purchase Lots and Decision Analytics reached from Investment Detail and transaction interactions;
- existing calculators should be reused where their definitions are approved and their results reconcile.

## Phase 8: Comdirect Import

Goal: add the first broker-specific integration while preserving broker independence.

Scope:

- Comdirect adapter
- Comdirect CSV or export parser
- Comdirect postbox document metadata
- broker-specific field mapping
- Comdirect duplicate detection
- source traceability from document to transaction

Success criteria:

- user can import Comdirect transactions
- imported records use the canonical transaction model
- Comdirect-specific logic stays outside analytics services

## Phase 9: Advanced Analytics

Goal: expand from MVP metrics into deeper portfolio analysis.

Scope:

- XIRR
- benchmark comparison
- portfolio attribution
- dividend growth analysis
- tax estimation
- richer realized gain reporting

Success criteria:

- user can compare portfolio performance against benchmarks
- user can understand sources of return
- advanced metrics remain traceable to source data

## Phase 10: Broker Expansion And Automation

Goal: support additional data sources and reduce manual maintenance.

Scope:

- automated Comdirect synchronization
- delta loads
- Trade Republic adapter
- Interactive Brokers adapter
- broker account model
- import scheduling
- improved reconciliation

Success criteria:

- additional brokers can be added through adapter contracts
- users can refresh data without reimporting everything
- duplicate detection and auditability still hold

# Target Alpha Implementation Phases

These phases describe the next product-facing evolution. Detailed requirements are in `docs/ui-ux-spec.md`; unresolved formulas must be decided in `docs/analytics-rules.md` before affected metrics are finalized.

## Target Phase 0: Authoritative Specifications

- establish specification authority;
- add the approved UI/UX specification;
- consolidate the product specification;
- reconcile architecture and roadmap;
- register implementation discrepancies without changing application code.

## Target Phase 1: Analytics Decisions And Shared Foundations

- approve the unresolved return, realized-gain, lot-matching, dividend, Yield on Cost, FX, YTD, and last-365-day definitions;
- preserve and test analytics that already match the approved rules;
- establish reusable UI primitives, account context, calculation explanations, and responsive states.

## Target Phase 2: Portfolio

- implement the approved nine-metric hierarchy;
- refine portfolio/deployed-capital chart interaction;
- add optional dividends and normalized benchmark comparison;
- refine holdings and mobile presentation;
- make account context apply consistently.

## Target Phase 3: Investments And Investment Detail

- add Current, Closed, and All investment inventory;
- build Investment Detail around security history, current state, and the user's decisions;
- recompose Stock Analytics and Lot Analytics into KPIs, charts, purchase lots, and decision drawers;
- add annual security performance and benchmark rows.

## Target Phase 4: Dividends And Transactions

- build the dedicated dividend analytical destination;
- integrate approved dividend and Yield on Cost semantics across relevant views;
- retain the transaction ledger and add complete history plus analytical row interaction.

## Target Phase 5: Quality And Release Validation

- complete loading, empty, error, accessibility, and mobile behavior;
- visually validate the coordinated redesign across the application;
- verify reconciliation, calculation lineage, and acceptable performance before release.

# Historical MVP Definition

The checklist below records the original MVP definition. The current target is governed by the Product and UI/UX specifications.

The MVP is complete when a user can:

1. register and log in
2. create or use a portfolio
3. import or manually enter buy transactions
4. import or manually enter sell transactions
5. import or manually enter dividend transactions
6. view current portfolio value
7. view invested capital
8. view total gain/loss
9. view total dividends received
10. view portfolio development over time
11. analyze every purchase lot
12. understand dividend contribution per investment decision

# Domain Model Summary

Core domain concepts:

- User: authenticated investor.
- Portfolio: collection of investment transactions owned by a user.
- Transaction: source-of-truth investment event.
- Security Identity: name, ISIN, WKN, ticker, exchange, currency, and asset type captured on a transaction.
- Transaction Component: fee, tax, or other monetary detail attached to a transaction.
- Source Document: uploaded or external artifact that supports imported data.
- Import Run: processing record for an import attempt.
- Price: market value for a security on a date.
- Holding: calculated current position.
- Purchase Lot: calculated investment decision derived from a buy transaction.
- Dividend Allocation: calculated relationship between dividend income and held lots.
- Portfolio Snapshot: derived chart point that can be regenerated.

# Analytics Rules To Decide Early

The current implemented rules are documented in `docs/analytics-rules.md`.

The following rules should remain explicit because they affect user-facing numbers:

- lot matching policy for sells
- dividend allocation method
- treatment of fees in cost basis
- treatment of taxes in net return
- cash amount sign conventions
- handling of partial sells
- handling of missing price data
- handling of multiple currencies and FX rates

# Historical MVP Suggestions - Not Approved Product Rules

The following were earlier proposals. They do not resolve the open analytics questions and must not be treated as authoritative where they conflict with `docs/product-spec.md` or `docs/analytics-rules.md`.

- Use FIFO lot matching.
- Include broker fees in cost basis.
- Track taxes separately from investment performance, but keep them available for net-return views.
- Use EUR as the initial base currency while storing currency on every monetary record.
- Use latest available close price for current value.
- Use monthly portfolio development points if daily historical prices are not available yet.
- Allocate dividends proportionally across eligible lots by held quantity on the dividend date.

# Risks

- Broker imports may contain inconsistent formats or missing identifiers.
- Dividend allocation can become complex when partial sells occur before payment dates.
- Historical price gaps can make portfolio development charts misleading.
- Multiple currencies introduce FX complexity that can distort returns if deferred too long.
- Storing derived snapshots too early could blur the source-of-truth model.

# Historical Non-Goals For The Original MVP

These describe the earlier MVP boundary. They do not override V1 requirements in `docs/ui-ux-spec.md`, including benchmark comparison and multi-account-ready architecture.

- automated broker synchronization
- tax filing support
- benchmark comparison
- multiple lot matching policies
- full multi-currency performance attribution
- options, crypto, derivatives, or complex corporate actions
- broker account reconciliation

# Documentation Maintenance

These documents should be updated whenever a core analytics rule changes. In particular, changes to lot matching, dividend allocation, cost basis, taxes, or currency handling should be reflected before implementation continues.

The unresolved decisions that block authoritative V1 metrics are:

- Portfolio Total Return after partial/full sales;
- Realized Gain at portfolio and investment level;
- a deliberate lot-matching policy;
- gross versus after-tax dividend semantics;
- Yield on Cost definition;
- EUR/FX valuation methodology; and
- YTD and last-365-day return methodology.
