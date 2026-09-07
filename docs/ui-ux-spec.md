# α Alpha — UI/UX Specification

**Status:** Approved design specification for implementation
**Primary implementation target:** V1
**Design direction:** Modern Analytical
**Primary viewport:** 1920×1080 laptop
**Product tagline:** *Analyze every investment. Measure every decision.*

---

## 1. Purpose

α Alpha is an investment analytics application designed to help investors understand not only **how their portfolio is performing**, but **which investment decisions created that performance**.

The UI must therefore optimize for three outcomes:

- **20% Premium feel** — the product should look refined, serious, and expensive.
- **30% Immediate comprehension** — users should quickly understand portfolio status and performance.
- **50% Analytical differentiation** — users should be able to analyze information their broker typically does not provide.

The defining product interaction is:

**Portfolio → Investment → Transaction / Lot → Performance of that decision**

The design must avoid the visual patterns of generic SaaS dashboards, consumer-fintech gamification, crypto products, and overly dense trading terminals.

---

# 2. Design Direction

## 2.1 Chosen direction

**Modern Analytical**

Reference philosophy:

- Linear: structure, calmness, hierarchy
- Mercury: restraint and premium financial feel
- Koyfin: analytical depth
- TradingView: financial chart interaction quality

The product should feel:

- analytical
- premium
- calm
- data-rich
- precise
- trustworthy
- modern
- intentionally understated

It must **not** feel:

- playful
- gamified
- crypto-like
- neon
- card-heavy
- overly institutional / Bloomberg-dense
- like a generic Tailwind dashboard

---

# 3. Product Brand

## 3.1 Product name / wordmark

Primary wordmark:

**α Alpha**

Treatment:

- custom/stylized lowercase Greek alpha symbol `α`
- `Alpha` rendered in restrained modern type
- no surrounding box
- no stock-chart arrow
- no candlestick icon
- no euro symbol
- no coin imagery
- monochrome by default
- blue alpha symbol allowed in branded contexts

Collapsed navigation may show only:

**α**

## 3.2 Alpha as metric

The benchmark-relative performance KPI should be displayed using **only the symbol `α`**, not the word “Alpha”.

Example:

```text
Annualized Return       10.8%
MSCI World               8.6%
─────────────────────────────
α                        +2.2pp
```

## 3.3 Tagline

Use on login/onboarding/landing surfaces, not in normal analytical workspace:

> Analyze every investment. Measure every decision.

---

# 4. Visual Design System

## 4.1 Theme

V1 is **light-first**.

The implementation must use semantic design tokens so dark mode can be added cleanly later.

Dark mode is **not required in V1**.

## 4.2 Typography

Primary font:

**Geist**

Requirements:

- use Geist Sans for UI text
- use tabular numerals for financial values and tables
- maintain clear hierarchy through type size/weight rather than cards
- avoid excessive bolding

Suggested hierarchy:

- Page title: 28–32px / medium or semibold
- Hero portfolio value: 38–44px / medium or semibold
- Section headings: 18–20px / medium
- KPI labels: 12–13px / medium / muted
- KPI values: 18–24px / medium
- Body: 14px
- Table: 13–14px

Exact values may be tuned visually during implementation.

## 4.3 Color philosophy

### Background

Use a **very light warm grey** as the application canvas.

Primary analytical surfaces are white.

Avoid pure white for the entire app shell.

### Accent

Use a restrained **deep royal blue**.

Directional tokens:

```css
--accent: #3157D5;
--accent-hover: #2748B8;
--accent-subtle: #EEF2FF;
```

These are starting values, not immutable constants. All colors must be semantic tokens.

### Financial semantics

- positive performance = muted green
- negative performance = muted red
- blue = brand / selection / actions
- green/red must not be reused as navigation colors

Do not communicate positive/negative status with color alone.

### Chart semantics

- Portfolio Value = deep blue
- Deployed Capital = neutral graphite
- Dividends = muted teal
- Benchmark = slate/light grey dashed
- gains/losses = green/red when applicable

## 4.4 Surfaces

Primary approach:

**Mostly borderless sections, not card-heavy layout.**

Use:

- whitespace
- typography
- alignment
- section dividers
- subtle background differences

Use cards only when the content is genuinely a contained object.

## 4.5 Borders and shadows

- subtle 1px neutral borders
- almost no visible shadows in normal page content
- shadows allowed for:
  - drawers
  - dropdown menus
  - overlays
  - floating interaction surfaces

## 4.6 Corner radius

Default:

**8px**

Avoid highly rounded consumer-fintech surfaces.

## 4.7 Motion

Use subtle micro-interactions.

Preferred transition range:

**150–250ms**

Use for:

- chart period changes
- drawer entry/exit
- hover state transitions
- expandable controls
- KPI number changes where appropriate

Avoid decorative animation.

Respect `prefers-reduced-motion`.

---

# 5. Application Shell

## 5.1 Desktop navigation

Use a persistent left sidebar.

V1 top-level navigation:

```text
α Alpha

Portfolio
Investments
Dividends
Transactions

──────────────

Import
Settings
```

Do **not** create a separate top-level Performance destination in V1.

Performance analytics live inside Portfolio and Investment views.

## 5.2 Sidebar dimensions

Suggested:

- expanded: 220–240px
- collapsed: ~64px

Sidebar must be collapsible.

Collapsed mode keeps the `α` brand mark visible.

## 5.3 Header

Desktop page header should contain the page title plus contextual controls.

Example:

```text
Portfolio                      All Accounts ▼
```

The account selector should be persistently accessible.

### V2 only

Global search / command bar.

Example:

```text
Search investments...    ⌘K
```

Search should allow direct navigation to securities such as Allianz.

Do not implement global search in V1.

---

# 6. Multi-Account Model

The interface must anticipate multiple broker accounts from the beginning.

Example selector:

```text
All Accounts ▼
```

Possible values:

```text
All Accounts
Comdirect
ING
Manual Portfolio
```

Changing the selected account must update the entire analytical context:

- KPIs
- charts
- holdings
- transactions
- dividends
- calculations

Architecture must support additional broker accounts even if only one account currently exists.

---

# 7. Currency and Formatting

## 7.1 Currency

All user-facing financial values must be displayed in **EUR** in V1.

Even when an underlying security trades in another currency, Alpha should show the converted EUR value.

Do not display USD/native price as the primary displayed price in V1.

## 7.2 Number format

Use international/English formatting:

```text
€487,430.20
12.8%
+€55,216.30
```

Not German formatting.

## 7.3 Language

V1 UI language:

**English**

Architecture should be localization-ready.

German localization is not required in V1.

---

# 8. Portfolio Page — Primary Screen

The Portfolio page is the default/home analytical screen.

It should immediately answer:

1. What is my portfolio worth?
2. What return did I make?
3. How much capital is currently deployed?
4. How much is realized vs unrealized?
5. How much came from dividends?
6. What are my annualized/current-period returns?
7. Which holdings are driving the result?

---

# 9. Portfolio KPI Hierarchy

Do **not** render nine equal KPI cards.

Use hierarchy.

Suggested structure:

```text
PORTFOLIO VALUE

€487,430.20
+€55,216.30 · +12.8% total return


Current deployed     Annualized return     Dividends
€392,410             +9.7%                 €18,340


Realized             Unrealized            This year       Last 365 days
+€22,140             +€33,076              +11.8%          +14.2%
```

Required metrics:

1. Portfolio Value
2. Total Return — amount and %
3. Current Deployed Capital
4. Realized Gain
5. Unrealized Gain
6. Dividends
7. Annualized Return %
8. Return Current Year %
9. Return Last 365 Days %

### Total Return display rule

At portfolio level, show both:

- absolute €
- percentage %

Prefer € first, % second.

In comparison-heavy tables, percentage may be visually primary.

---

# 10. Portfolio Performance Chart

## 10.1 Default series

Default visible series:

- Portfolio Value
- Current Deployed Capital

Other optional series:

- Cumulative Dividends — toggleable and **off by default**
- Benchmark — when benchmark comparison is active

## 10.2 Period selector

Required:

```text
1M  3M  YTD  1Y  3Y  5Y  10Y  MAX
```

`MAX` represents the full available investment history.

No separate “Since first investment” option is required.

## 10.3 Return-method display

Do not expose a complex return-methodology dropdown throughout V1.

Alpha should choose the appropriate metric for each context.

Calculation methodology must remain transparent through tooltips and “How is this calculated?” explanations.

## 10.4 Transactions on portfolio chart

Do **not** show buy/sell transaction markers at portfolio level.

They would create excessive visual noise.

Transaction markers belong on the Investment Detail chart.

## 10.5 Chart style

Use:

- thin lines
- no decorative gradients beneath main series
- subtle gridlines
- no permanent point markers except meaningful events
- crosshair on hover
- responsive tooltip
- smooth subtle transitions
- selected series emphasized
- inactive series muted

---

# 11. Benchmarks

Supported benchmarks:

- MSCI World
- S&P 500
- DAX

Default:

**MSCI World**

Only one benchmark should be active at a time.

## 11.1 Comparison normalization

Portfolio vs benchmark comparisons should be normalized to a common base, typically:

```text
100 at period start
```

Example:

```text
200 ┤                      Portfolio 184
    │                 ╭────
150 ┤          ╭──────╯
    │    ╭─────╯
100 ┼────╯
    │        MSCI World 167
    └────────────────────────
```

Do not compare portfolio EUR value directly against raw benchmark index level.

## 11.2 Alpha KPI

Benchmark-relative performance should eventually be represented using:

`α`

Example:

```text
Annualized Return       10.8%
MSCI World               8.6%
─────────────────────────────
α                        +2.2pp
```

The exact statistical definition must be explicit in the calculation layer. Do not label a value `α` unless the underlying methodology is well defined.

---

# 12. Holdings Table

Required default columns:

1. Investment
2. Value
3. Deployed
4. Return
5. Ann. Return
6. Yield on Cost
7. Ptf Weight

Example:

```text
Investment      Value       Deployed     Return          Ann. Return   Yield on Cost  Ptf Weight
Allianz        €43,210      €31,440      +€11,770 +37%     +8.7%          6.2%          8.9%
Meta           €31,440      €18,220      +€13,220 +73%    +16.8%          0.0%          6.4%
```

## 12.1 Return cell

Show both:

- absolute return €
- return %

## 12.2 Sorting

- all numeric columns sortable
- default sorting = Portfolio Weight descending

## 12.3 Table behavior

- full row clickable
- hover subtly highlights row
- investment name left aligned
- numeric data right aligned
- sticky column header
- header click sorts
- no zebra striping
- clicking a row navigates to Investment Detail

## 12.4 Sparklines

Do **not** show sparklines in the Holdings table in V1.

## 12.5 Current vs historical positions

Portfolio page shows **current holdings only**.

The Investments section supports:

```text
Current | Closed | All
```

---

# 13. Investments Page

Purpose:

Provide a searchable/filterable analytical inventory of all investments, including closed positions.

Default tabs:

```text
Current | Closed | All
```

Current should be default.

Selecting an investment navigates to Investment Detail.

This page should remain analytical rather than decorative.

---

# 14. Investment Detail — Signature Experience

The Investment Detail page is the hero feature of Alpha.

It should show the history of **the user's relationship with the investment**, not merely company/security information.

Core hierarchy:

```text
Portfolio
    ↓
Investment
    ↓
Transactions / Lots
    ↓
Individual investment decision
```

---

# 15. Investment Detail Header

Example:

```text
ALLIANZ SE
ALV · XETRA · Insurance

€352.40                 +1.24% today

24 shares
€8,457.60 current value
```

Daily market movement should be visible but **subtle**, not dominant.

Alpha is not primarily a real-time market-watching application.

---

# 16. Investment Detail KPIs

Required:

- Total Return — € and %
- Annualized Return
- Current Value
- Current Deployed Capital
- Realized Gain
- Unrealized Gain
- Dividends
- Yield on Cost
- Average Purchase Price
- Quantity

Quantity and average purchase price may be secondary rather than hero KPIs.

Suggested arrangement:

```text
YOUR INVESTMENT

Total Return             +€2,991   +45.4%
Annualized Return                   +9.7%

Current Value            €8,457
Current Deployed         €6,590
Average Purchase Price   €...
Quantity                  24
Realized Gain            €...
Unrealized Gain          €1,867
Dividends                €1,124
Yield on Cost            6.2%
```

---

# 17. Investment Detail Chart

## 17.1 Chart mode

Support a toggle:

```text
Price | Position Value
```

Default:

**Price**

### Price mode

Shows security price over time and transaction decision points.

### Position Value mode

Shows value of the user's position over time, with deployed capital where appropriate.

## 17.2 Transaction markers

Visible by default:

- BUY
- SELL

Dividend markers:

- hidden by default
- optionally toggleable

Suggested semantics:

```text
▲ BUY
▼ SELL
◆ DIVIDEND
```

Use color and shape, not color alone.

## 17.3 Historical state tooltip

Hovering the chart should expose the user's portfolio state at the selected historical point.

Example:

```text
24 JUN 2023

Price                    €221.40
Your shares                    24
Position value            €5,313
Deployed capital           €4,820
Unrealized return          +10.2%

BUY
10 shares @ €221.00
```

This historical-state tooltip is a key analytical differentiator.

---

# 18. Transaction / Lot Drawer

Clicking a transaction marker opens a **right-side analytical drawer**.

Do not navigate to a dedicated transaction page.

Example:

```text
PURCHASE

24 June 2023
10 × €221.00

Capital deployed          €2,210
Value now                 €3,524
Gain                     +€1,314
Return                     +59.5%
Annualized Return          14.2%
Dividends                    €182
Yield on Cost               8.2%
```

Drawer behavior:

- desktop: right-side slide-in
- remains contextually attached to chart
- close via button, Escape, or click-away where appropriate
- keyboard focus trapped while open
- chart context remains visible beneath

---

# 19. Purchase Lots Table

Below the investment chart:

```text
PURCHASE LOTS

Date          Qty      Buy Price     Deployed      Value       Return     Ann. Return
12 Mar 2020     8       €164.20      €1,314       €2,819       +114%        +16.2%
18 Oct 2021     6       €198.10      €1,189       €2,114        +78%        +11.4%
24 Jun 2023    10       €221.00      €2,210       €3,524        +59%        +14.2%
```

Filtering:

```text
Open | Closed | All
```

Default:

**Open**

Closed/sold lots must remain available for historical analysis.

---

# 20. Annual Performance Grid

The Investment Detail page should include a calendar-year security-performance table/grid below the primary chart and lot analysis.

This is intentionally below the initial viewport so the page remains readable.

Example:

```text
ANNUAL PERFORMANCE

             2020    2021    2022    2023    2024    2025    2026 YTD
Allianz      +8.2%  +18.7%  -11.4%  +23.1%  +14.8%   +7.4%   +12.1%
MSCI World   +6.3%  +31.1%  -13.0%  +19.6%  +26.6%   +...     +...
Difference   +1.9    -12.4    +1.6    +3.5   -11.8    ...      ...
```

## 20.1 Calculation definition

For completed calendar years:

**security price performance = year-end price / previous year-end price − 1**

Use the last available trading price on or immediately before December 31 where December 31 is not a trading day.

For current year:

**YTD = latest available price / previous year-end price − 1**

This grid describes the **security's calendar-year market performance**, independent of the user's purchases/sales.

It must not be mislabeled as the user's personal investment return.

## 20.2 Visual treatment

Use restrained heatmap-like cues only.

- muted green backgrounds for positive values
- muted red backgrounds for negative values
- subtle intensity
- never a bright trading-terminal heatmap

## 20.3 Personal annual investment return

Desired in the future, but **not V1**.

Future capability:

```text
2024

Allianz stock performance       +14.8%
Your Allianz investment         +12.6%
```

This must account for the user's actual cash flows and should use a clearly defined methodology.

---

# 21. Dividends

Dividend analytics are a **major analytical area**, not merely a supporting metric.

V1 should include a dedicated Dividends destination.

Dividend information should also appear contextually in:

- Portfolio KPIs
- Investment Detail KPIs
- transaction/lot drawer where relevant
- Yield on Cost
- optional chart series / markers

Do not make dividend markers permanently visible on the price chart.

---

# 22. Transactions

Transactions require two representations.

## 22.1 Default ledger view

Example:

```text
Date         Asset       Type    Qty     Price       Total
12 Mar 2020  Allianz     BUY      8      €164.20    €1,313.60
```

## 22.2 Analytical expansion

Selecting/clicking a transaction should expose analytical performance of that decision.

Example:

```text
12 MAR 2020

ALLIANZ
Bought 8 shares @ €164.20

Invested          €1,313.60
Value today       €2,819.20
Return              +114%
```

The ledger remains the default for efficiency.

Analytical detail should use the same drawer pattern as Investment Detail where practical.

---

# 23. Data Lineage and Calculation Transparency

Alpha should make calculated metrics explainable.

Required pattern:

```text
How is this calculated?
```

Example:

```text
Current Deployed Capital
€6,590

Derived from:
12 Mar 2020 BUY     €1,313
18 Oct 2021 BUY     €1,189
24 Jun 2023 BUY     €2,210
...
```

This is a core trust feature.

Requirements:

- calculation details must reflect actual underlying transactions
- do not show invented explanations
- formulas should be discoverable without cluttering the primary UI
- tooltips provide concise summaries
- deeper breakdowns may use drawer/popover/detail panel

---

# 24. Tooltips and Financial Education

Use subtle info affordances for complex metrics.

Example:

```text
Annualized Return  9.7%  ⓘ
```

Tooltip:

```text
Annualized return reflects the compound annual rate of return based on the applicable cash-flow methodology.
```

Rules:

- concise first-level explanation
- optional “Learn more” later
- do not turn every label into an info icon
- use only where the metric is materially ambiguous

---

# 25. Return Semantics

The UI must never conflate:

- total return
- annualized return
- security price performance
- portfolio return
- benchmark performance
- realized gain
- unrealized gain
- personal cash-flow-aware return

Where methodologies differ, labels and tooltips must make that explicit.

Do not add a global return-method selector in V1.

The product chooses the appropriate metric for the context.

---

# 26. Loading, Empty and Error States

## 26.1 Loading

Use skeleton states.

Do not use a generic full-page spinner except where unavoidable.

Skeletons should preserve the intended page layout.

## 26.2 Empty states

Use polished instructional empty states.

Example:

```text
No transactions yet

Import your broker transactions to start
analyzing your investment decisions.

[ Import transactions ]
```

Do not represent missing data as zero when zero would be misleading.

## 26.3 Errors

Prefer inline contextual errors.

Example:

```text
Historical price unavailable for 12 Mar 2017
Retry
```

Avoid generic blocking modal errors.

---

# 27. Login Screen

Include login design in V1.

Direction:

- extremely minimal
- premium
- large whitespace
- centered or balanced split-screen layout
- optional subtle analytical visual on right for large screens

Example:

```text
              α Alpha

      Understand your investments.

           [ Sign in ]

Analyze every investment.
Measure every decision.
```

The login page must not look like a generic Supabase demo screen.

---

# 28. Import

Import remains accessible in V1 navigation, but the fully polished multi-step import experience is **later / not part of the UI redesign scope**.

Future experience:

```text
1  Select broker
2  Upload documents
3  Review detected transactions
4  Confirm import
```

Do not overbuild this flow as part of the first visual implementation.

---

# 29. Settings

Settings exists as a destination, but **no significant Settings redesign is required now**.

Potential later groups:

- General
- Accounts
- Data
- Appearance

Do not invest V1 redesign effort here before the core analytical experience is complete.

---

# 30. Global Search

**V2**

Desired future behavior:

- command/search access
- direct search for investment names/tickers
- keyboard shortcut such as `⌘K` / `Ctrl+K`
- direct navigation to Investment Detail

Do not implement in V1.

---

# 31. Responsive Design

## 31.1 Breakpoint priorities

Optimize explicitly for:

- Primary: 1920×1080
- Excellent: ≥1440px
- Good: 1024–1439px
- Mobile: <768px
- tablets handled adaptively

The desktop experience is primary, but mobile must be genuinely excellent.

---

# 32. Mobile Navigation

Use bottom navigation.

Suggested:

```text
Portfolio   Investments   Dividends   More
```

Under More:

- Transactions
- Import
- Settings

Keep navigation simple.

---

# 33. Mobile Portfolio KPI Layout

Do not compress all nine desktop metrics into a horizontal grid.

Suggested first view:

```text
Portfolio Value
€487,430
+€55,216 · +12.8%

Annualized     This Year
+9.7%          +11.8%

[ View all metrics ]
```

Use an expandable section/sheet for secondary metrics.

---

# 34. Mobile Holdings

Do not horizontally squeeze the desktop table.

Convert holdings to compact analytical rows/cards.

Example:

```text
ALLIANZ                         8.9%
€43,210

Return          Ann. Return
+€11,770        +8.7%
+37.4%

Deployed €31,440
```

Tap navigates to Investment Detail.

---

# 35. Content Width

Use a hybrid layout:

- overview content can be constrained for readability
- analytical charts and tables may expand to use available width

Do not force all pages into a narrow fixed-width container.

---

# 36. Table Density

Balanced density.

Suggested row heights:

- holdings: ~48px
- transaction-heavy tables: ~44px

Avoid both cramped terminal density and oversized consumer-fintech spacing.

---

# 37. Accessibility

Target:

**WCAG AA**

Requirements:

- sufficient text/background contrast
- keyboard navigation
- visible focus state
- screen-reader-friendly labels
- reduced-motion support
- do not communicate gain/loss by color alone
- chart alternatives/tooltips accessible where technically practical
- drawer focus management
- semantic HTML tables

Accessibility is a V1 requirement.

---

# 38. Recommended Front-End Stack

Preferred UI stack:

- React + TypeScript
- Tailwind CSS
- shadcn/ui
- Radix primitives
- Lucide icons
- Geist font

Charts:

- Recharts for general analytical charts
- TradingView Lightweight Charts for core financial/security timelines if it materially improves interaction quality
- Apache ECharts only if later advanced visualizations require it

Do not introduce multiple chart libraries without a clear reason.

---

# 39. Component Architecture

Create reusable primitives rather than page-specific styling.

Suggested components:

```text
AppShell
Sidebar
PageHeader
AccountSelector
Metric
MetricGroup
PerformanceValue
PeriodSelector
BenchmarkSelector
ChartLegend
PortfolioPerformanceChart
InvestmentPriceChart
HoldingsTable
InvestmentTable
TransactionTable
LotsTable
AnnualPerformanceGrid
ReturnBadge
InfoTooltip
CalculationBreakdown
TransactionDrawer
EmptyState
InlineError
Skeleton
MobileBottomNav
```

Avoid a generic `Card` wrapper around every component.

---

# 40. Suggested Semantic Tokens

Example starting point:

```css
:root {
  --bg-app: ...;
  --bg-surface: ...;
  --bg-subtle: ...;

  --text-primary: ...;
  --text-secondary: ...;
  --text-muted: ...;

  --border-subtle: ...;
  --border-strong: ...;

  --accent: #3157D5;
  --accent-hover: #2748B8;
  --accent-subtle: #EEF2FF;

  --positive: ...;
  --positive-subtle: ...;
  --negative: ...;
  --negative-subtle: ...;

  --chart-portfolio: ...;
  --chart-deployed: ...;
  --chart-dividend: ...;
  --chart-benchmark: ...;

  --radius-sm: ...;
  --radius-md: 8px;
  --radius-lg: ...;

  --shadow-overlay: ...;

  --sidebar-expanded: ...;
  --sidebar-collapsed: ...;
}
```

Do not scatter hard-coded colors across components.

---

# 41. Visual QA Principles

Before considering the redesign complete, verify:

- page does not look like a generic shadcn demo
- KPI hierarchy is visually obvious
- Portfolio Value is unmistakably primary
- charts dominate appropriately without overwhelming the page
- holdings table is readable at 1920×1080
- all financial columns align cleanly
- gains/losses use consistent semantics
- account filtering is visually obvious
- desktop sidebar feels premium and compact
- empty/loading/error states match the visual system
- Investment Detail clearly feels more analytical than a broker page
- transaction markers are easy to understand
- transaction drawer feels attached to the selected decision
- yearly return grid is readable but visually secondary
- mobile is purpose-designed, not a shrunk desktop layout

---

# 42. V1 / V2 / Future Scope

## V1

### Brand / system
- α Alpha visual identity
- light-first design
- Geist
- design tokens
- responsive shell
- collapsible left sidebar
- accessibility foundations

### Portfolio
- nine defined KPI metrics using hierarchy
- Portfolio Value hero
- Portfolio + Deployed chart
- dividend line toggle
- 1M / 3M / YTD / 1Y / 3Y / 5Y / 10Y / MAX
- benchmark selector
- MSCI World default
- S&P 500 and DAX
- normalized benchmark comparison
- holdings table
- multiple-account selector

### Investments
- Current / Closed / All
- Investment Detail
- Price / Position Value chart toggle
- buy/sell markers
- optional dividend markers
- historical-state tooltip
- transaction analytical drawer
- lot table
- Open / Closed / All
- Annual Performance grid
- benchmark row and difference row

### Dividends
- dedicated navigation destination
- dividend analytics integrated across relevant screens

### Transactions
- ledger
- analytical transaction expansion

### UX quality
- skeleton loading
- polished empty states
- inline errors
- calculation transparency
- concise metric tooltips
- login screen
- mobile bottom navigation
- mobile-specific KPI and holding layouts

## V1-ready architecture / later

- dark mode
- German localization
- additional brokers/accounts
- richer Import workflow
- settings expansion
- configurable base currency if desired later

## V2

- global investment search / command palette
- direct navigation via search
- richer keyboard shortcuts

## Future

- personal calendar-year return per security including actual cash flows
- deeper alpha / risk analytics
- advanced performance attribution
- richer data-source transparency
- advanced heatmaps / multi-dimensional analytics if justified

---

# 43. Implementation Strategy

The requested implementation approach is:

**Implement the full redesign in one coordinated pass.**

However, Codex must still structure the work internally so the design system is defined first and reused everywhere.

Recommended internal sequence:

1. Establish tokens, typography, spacing, base components.
2. Implement AppShell + sidebar + header.
3. Implement Portfolio page.
4. Implement Investment Detail.
5. Implement Investments list.
6. Implement Dividends.
7. Implement Transactions.
8. Implement login.
9. Implement mobile/responsive behavior.
10. Run visual consistency and accessibility pass.

Do not ship partially redesigned screens with mixed old/new design language.

---

# 44. Non-Negotiable Product Rules

1. **Do not turn every KPI into a card.**
2. **Do not use bright trading-terminal colors.**
3. **Do not make today’s market move visually more important than the user’s investment performance.**
4. **Do not show transaction markers on the portfolio-level chart.**
5. **Do show transaction markers on investment-level charts.**
6. **Do not conflate security price return with personal investment return.**
7. **Do not hide methodology when a metric is derived/calculated.**
8. **Do not use green as a generic product accent. Green is reserved for positive financial semantics.**
9. **Do not display non-EUR monetary values in V1 user-facing analytics.**
10. **Do not squeeze desktop tables into mobile layouts.**
11. **Do not make the interface look like a generic shadcn/template dashboard.**
12. **Do maintain the analytical drill-down: Portfolio → Investment → Decision/Lot.**
13. **Do prioritize the question: “Which of my decisions created my return?”**
14. **Do preserve transaction-derived, reproducible analytics.**
15. **Do use `α` alone for the benchmark-relative KPI.**

---

# 45. Acceptance Criteria

The redesign is successful when a user can:

- open Alpha and understand portfolio value and return in seconds
- distinguish current deployed capital from current market value
- see realized and unrealized performance separately
- understand dividend contribution
- see annualized, YTD and last-365-day returns
- compare portfolio performance with MSCI World, S&P 500 or DAX
- identify the largest holdings and their performance
- open any investment and see the user's actual transaction history on the price chart
- inspect the historical portfolio state at any point on the chart
- click a buy/sell decision and analyze the performance of that decision
- analyze individual open and closed lots
- see calendar-year security performance versus benchmark
- understand how calculated metrics were derived
- use the primary workflows comfortably on a phone
- experience a visually consistent, premium analytical product across the entire application

---

# 46. Core Design Summary for Codex

If a design decision is ambiguous, optimize for this sentence:

> **Alpha should feel like Linear structure + Mercury restraint + Koyfin analytical depth + TradingView-quality chart interaction — built around the unique idea that every investment decision can be measured.**

The visual hierarchy should communicate:

```text
Portfolio
    ↓
Investment
    ↓
Decision
    ↓
Return
```

The UI is successful only if analytical power is obvious **without making the product feel dense or intimidating**.
