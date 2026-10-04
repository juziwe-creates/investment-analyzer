# Portfolio and Investment History Follow-up Specification

Status: DRAFT FOR FEEDBACK

This document is an analysis and requirements draft only. It does not authorize implementation, financial-rule changes, database changes, or deployment. Additional screenshots, bugs, and product feedback should be appended before the package is approved for development.

## Source Evidence

The initial screenshot shows the Dashboard Portfolio Performance chart in Value mode with:

- visible range text: November 20, 2007 through January 25, 2016;
- visible x-axis labels only through approximately 2012;
- a navigator rail that continues beyond the captured viewport;
- Value and Economic Value controls at the left;
- Portfolio Value, Priced Holdings Value (partial), MSCI World Counterfactual, and Current Deployed Capital series;
- explanatory text clipped at the right edge; and
- no visible right-side dividend or zoom controls.

The screenshot viewport is approximately 969 pixels wide. The device, browser, browser zoom level, sidebar state, and exact page scroll position are not yet known.

## Finding PF-01: Portfolio Chart Exceeds Its Visible Container

Severity: High usability defect

Confidence: High for the symptom; provisional for the technical cause

### Observed symptoms

- The stated date range ends in 2016, but the visible plot stops around 2012.
- The chart, navigator, legend, and disclosure text appear to continue beyond the right edge.
- Controls normally positioned on the right side of the toolbar are not visible.
- Disclosure text is clipped instead of wrapping within the card.
- The page therefore does not expose the complete selected range or all chart controls without horizontal movement.

### Provisional technical interpretation

One or more ancestors of `TimeSeriesChart` is likely being sized by wider content rather than by the available main-column width. The chart initializes with an internal width of 960 pixels and later uses `ResizeObserver`, but its SVG is intended to remain fluid through `width: 100%`. The defect may therefore involve flex/grid minimum sizing, a wide descendant elsewhere on the Dashboard, sidebar/main-column interaction, or an incorrect measured container width rather than the SVG view box alone.

This interpretation must be confirmed with browser measurements before code changes. Do not assume that reducing the chart's internal view-box width is the correct fix.

## Required Responsive Behavior

1. The Dashboard must never create document-level horizontal overflow at supported viewport widths.
2. Portfolio Performance must fit the available main-content width after accounting for the sidebar and page padding.
3. The chart must render the complete selected viewport from its left boundary through its right boundary.
4. The navigator track and both selection handles must remain inside the same visible chart card.
5. Value/Economic Value, cumulative-dividend, zoom, and reset controls must remain reachable.
6. Toolbars may wrap onto additional rows when space is limited. They must not force the chart wider.
7. Legends and explanatory text must wrap naturally within the card. They must not be truncated or require page-level horizontal scrolling.
8. The chart should resize after sidebar, viewport, orientation, or container-size changes without changing the selected date range.
9. Tables or other wide Dashboard descendants may use a deliberately local horizontal scroller, but they must not enlarge the Dashboard or chart container.
10. No fix may introduce an internal horizontal scrollbar for the chart itself.

## Date-Viewport Integrity

The visible date-range label, plotted range, navigator selection, hover behavior, and zoom/pan state must describe the same interval.

- If the label says November 20, 2007 through January 25, 2016, the right chart boundary must represent January 25, 2016.
- X-axis ticks do not need to print both exact boundary dates, but the plotted geometry must cover both boundaries.
- Resizing must not reset, expand, truncate, or pan the active time range.
- Benchmark observations remain secondary samples and must not change the navigation universe.
- Switching Value/Economic Value or benchmark selections must preserve the active viewport.

## Financial Semantics Preserved Pending Feedback

The screenshot alone does not establish a calculation error. The following current rules remain unchanged in this draft:

- Portfolio Value is withheld on dates where at least one open holding lacks a historical price.
- Priced Holdings Value (partial) shows only holdings with available prices and must remain explicitly labeled as partial.
- Current Deployed Capital includes the remaining acquisition cost of all open lots, including unpriced lots.
- Value excludes actual dividends and realized sale proceeds.
- Economic Value uses the separately approved dividend and realized-cash semantics.
- A total-return benchmark may embed benchmark dividends; no synthetic dividend cash is added again.
- Counterfactual benchmark values, FIFO matching, price lookup, currency handling, and missing-data rules must not be modified as part of a responsive-layout fix.

If the relative line values in the screenshot are believed to be wrong, that must be logged as a separate financial-correctness finding with a concrete date, expected value, actual value, and transaction/price evidence.

## Content and Hierarchy Review

The chart currently presents several concepts at once: value mode, benchmark methodology, missing-price disclosure, dividend treatment, and viewport controls. Once clipping is fixed, a later design pass should assess whether the hierarchy remains understandable.

Potential refinements for feedback, not yet approved requirements:

- keep the mode selector and primary controls in one responsive toolbar;
- place missing-data status near the affected partial series rather than in a long paragraph;
- keep benchmark methodology collapsed by default;
- shorten the visible dividend-treatment explanation while retaining the full methodology in expandable details; and
- ensure visually distinct styles for unavailable complete value, partial priced value, benchmark value, and deployed capital.

## Accessibility Requirements

- All controls must remain keyboard reachable at every supported width.
- Wrapped controls must preserve a logical focus order.
- Zoom and reset controls require their existing accessible names and visible focus states.
- Color must not be the only distinction between complete, partial, benchmark, and deployed-capital series.
- Clipped off-screen content must not remain focusable outside the visible viewport.
- Responsive behavior must work at 200% browser zoom without document-level horizontal scrolling, except where a data table has an explicitly scoped local scroller.

## Acceptance Tests

### Layout verification

Verify authenticated Dashboard screenshots at minimum widths of 390, 768, 969, 1024, and 1440 pixels.

- `document.documentElement.scrollWidth` must not exceed its client width because of Dashboard content.
- The Portfolio Performance card, toolbar, SVG, navigator, legend, and disclosures must remain inside the main-content boundary.
- The rightmost chart/navigator boundary and all controls must be visible.
- Text must wrap without overlap or clipping.
- Sidebar-expanded and sidebar-collapsed states must both pass where applicable.

### Interaction verification

- Zoom, pan, reset, navigator drag, and pointer hover remain functional after resize.
- The displayed range remains unchanged across a pure resize.
- Value/Economic Value switching retains the viewport.
- Benchmark selection retains the viewport.
- The cumulative-dividends control remains operable at every test width.

### Regression verification

- Existing time-viewport unit tests continue to pass.
- Add a browser regression for the 969-pixel evidence case.
- Add a container-width regression so a wide table or sibling cannot increase the chart's measured width.
- Confirm no changes to generated portfolio, partial-value, deployed-capital, dividend, or benchmark numbers.

## Open Questions

1. Is horizontal clipping/overflow the primary bug intended by the screenshot?
2. Which device, browser, browser zoom, and sidebar state produced the screenshot?
3. Was the browser page horizontally scrolled when the screenshot was taken?
4. Should the legend remain fully expanded on small screens, or may it become a compact expandable key?
5. Are any line values financially incorrect, separate from the visible layout defect?
6. Should the long missing-price and dividend-treatment disclosures remain inline, or move into a compact status/details pattern?

## Feedback Log

### Entry 1

- Evidence: initial Dashboard Portfolio Performance screenshot.
- Confirmed symptom: chart content is visibly clipped beyond the right edge.
- Provisional classification: responsive width containment and viewport-integrity defect.
- Implementation status: not started by explicit user instruction.

## Finding IH-01: Position Value Disappears Before Recent Price History

Severity: High analytical clarity defect; financial correctness remains undetermined

Confidence: High for the rendering symptom and navigator defect; unresolved for the underlying data cause

### Source evidence

The second screenshot shows Investment History in Value mode for August 25, 2010 through September 8, 2026.

- Current Deployed Capital is visible from the first purchase onward.
- MSCI World Counterfactual is visible across the full period.
- The blue Position Value line is absent from approximately 2010 through 2024.
- The blue line begins only around 2024 and continues through 2026.
- Buy and sell markers exist during the period where Position Value is absent.
- The navigator draws the missing blue period close to zero rather than visibly marking it unavailable.
- No prominent status explains the first available investment-price date or the unavailable interval.

### Current implementation behavior

`investmentHistory` uses only rows returned by `readMarketHistory` for the selected `security_key`. For each chart date, Position Value is:

```text
open quantity × latest security price on or before the chart date
```

If open quantity is positive but no prior security price exists, Position Value is `null`. The SVG path correctly breaks on null values. This means the missing blue line can be an honest representation of unavailable historical prices.

The navigator does not preserve that meaning. Its overview currently converts a null primary-series value to zero. Consequently, the overview visually states that Position Value was approximately zero when the application actually does not know the value.

### Affected investment and revised classification

The user confirmed that the screenshot is for Allianz and that historical Allianz values are available. Therefore, a genuine absence of historical source prices is no longer the leading explanation.

From the product perspective this is a UI/read-path defect: available historical facts are not represented by the blue Position Value series. The technical fault may still occur before SVG rendering, for example while selecting, joining, deduplicating, or transforming price rows. The implementation package must trace the values end to end rather than applying a cosmetic line fix.

### Unresolved technical root cause

Before implementation, inspect the selected investment's actual records and determine which of these cases applies:

1. Earlier Allianz prices exist under a different `security_key`, ISIN, WKN, ticker, portfolio, or provider-symbol identity than the Investment Detail route uses.
2. Historical manual/imported Allianz prices exist in a different source while Investment Detail reads only `market_prices`.
3. Deduplication or provider precedence removes the intended historical Allianz rows.
4. The read query returns the rows correctly, but timeline generation drops them.
5. Timeline values exist, but responsive chart rendering drops or clips the blue path.

No fallback price, interpolation, benchmark-derived price, purchase price, or zero value may be introduced merely to make the line continuous.

## Required Diagnostic Evidence for IH-01

For the affected investment, capture without exposing private values in logs or screenshots:

- canonical `security_key` used by its transactions;
- earliest purchase date and every identity variant present in transactions;
- count, minimum date, maximum date, provider, provider symbol, and currency of matching `market_prices` rows;
- equivalent coverage for manual historical-price storage, if applicable;
- first chart date with a non-null price and Position Value;
- whether a prior-or-same-date quote exists for each transaction date; and
- whether presentation mode changes identity or price coverage.

The technical defect must then be classified as one of:

- **Identity mismatch:** prices exist but are not joined to this investment;
- **Read-path omission:** the relevant price source is not loaded;
- **Calculation defect:** loaded prices do not produce the expected value; or
- **Rendering defect:** calculated values exist but the line is not drawn.

The user-confirmed existence of Allianz history means the final result must not be closed as a general data-coverage limitation unless record-level inspection contradicts that confirmation and the discrepancy is explained.

## Required Missing-Price Behavior

These requirements apply even when missing history is legitimate:

1. Never render an unavailable Position Value as zero.
2. The navigator must preserve unavailable intervals rather than drawing a false zero-valued history.
3. The chart must state the first available price date when an owned position predates price coverage.
4. The legend or nearby status must make clear that the absent line means unavailable valuation, not zero shares or zero value.
5. Hovering an unavailable interval should show owned quantity, deployed capital, and `Position Value: Unavailable` where the interaction model permits it.
6. Benchmark and deployed-capital lines may remain visible, but they must not imply that actual Position Value is complete.
7. Economic Value must also remain unavailable while its required market-value component is unavailable. Dividends or sale proceeds must not conceal the missing valuation component.
8. Once the first valid price exists, prior-or-same-date carry-forward behavior may continue under the approved price rules. Prices must never be carried backward before their first observation.
9. Closed-position dates may show zero Position Value only when quantity is factually zero, not when price is missing.
10. Any identity repair must preserve transaction facts and use an explicit provider/security mapping rather than rewriting historical transactions casually.
11. For Allianz, Position Value must begin on the first date at which both positive owned quantity and an eligible prior-or-same-date Allianz price exist.

## Acceptance Tests for IH-01

### Data and calculation tests

- Open quantity with no prior quote produces `null`, never zero.
- The first valid quote starts Position Value on exactly that quote date.
- A later quote carries forward only to later dates, never backward.
- A fully closed position produces factual zero even without a later quote.
- Historical rows under the canonical identity are all read across pagination boundaries.
- Any approved manual and provider-price precedence is deterministic and tested.

### Chart tests

- The primary SVG path has a gap for null values.
- The navigator does not substitute zero for null values.
- The UI discloses the unavailable interval and first available price date.
- Value and Economic Value modes communicate the same missing market-price interval consistently.
- Benchmark selection, zoom, pan, resize, and mode switching do not manufacture or remove Position Value observations.

### Entry 2

- Evidence: Investment History screenshot spanning 2010–2026.
- Confirmed symptom: blue Position Value is absent until approximately 2024.
- Confirmed presentation defect: navigator visually maps unavailable primary values to zero.
- Pending classification: historical price coverage, identity/read-path issue, calculation issue, or rendering issue.
- Implementation status: not started by explicit user instruction.

### Entry 3

- User confirmation: the affected investment is Allianz.
- User confirmation: historical Allianz values are available.
- Revised classification: application UI/read-path bug, not an accepted missing-data outcome.
- Remaining technical investigation: identity matching, source selection, deduplication, timeline transformation, and SVG rendering.
- Implementation status: not started by explicit user instruction.
