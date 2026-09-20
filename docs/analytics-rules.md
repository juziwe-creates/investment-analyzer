# Analytics Rules

> Status: this document records implemented formulas and approved analytics decisions, while explicitly identifying unresolved product choices. Existing behavior is not automatically an approved product rule.

# Purpose

This document records the formulas and analytics decisions currently used by Alpha.

The goal is to make every displayed number reproducible from source transactions and prices. If an analytics formula changes, this document should change in the same pull request or commit.

# Source Of Truth

Transactions are the source of truth.

Calculated models such as holdings, purchase lots, ownership status, dividends by lot, profitability, and portfolio development are derived from:

- `transactions`
- `transaction_components`
- `market_prices`
- `manual_security_prices`

Derived analytics should not be treated as master data.

# Security Identity

Analytics group transactions by a transaction-derived security key:

```text
security key = ISIN, else ticker, else security name
```

This keeps the MVP transaction-first and avoids requiring manually maintained securities.

# Lot Matching

## Default Engine Behavior

The underlying lot engine defaults to FIFO unless another lot matching method is passed.

```text
FIFO = first buy lot is sold first
```

This default still applies to older portfolio and dashboard calculations unless they explicitly opt into another method.

## Transaction Analytics And Stock Analytics

Transaction Analytics and Stock Analytics currently use LIFO.

```text
LIFO = latest buy lot is sold first
```

Reason:

- The Transaction Analytics ownership column should answer whether the shares from a specific buy transaction are still owned.
- The current product decision is to apply last-in, first-out for that ownership view.

Implication:

- If a user buys the same stock several times and later sells some shares, the newest buy lots are marked sold before older lots.
- Dividend allocation after the sell date uses only lots still open after LIFO sell allocation.

# Cost Basis

For a buy transaction:

```text
gross = transaction.gross_amount
     or transaction.quantity * transaction.unit_price

fees = absolute sum of fee, broker_fee, and exchange_fee components
```

Current formula:

```text
if explicit fee components exist:
  acquisition cost = abs(gross) + fees
else if no components exist and net_amount is an all-in debit at least as large as gross:
  acquisition cost = abs(net_amount)
else if gross_amount exists:
  acquisition cost = abs(gross)
else if net_amount exists:
  acquisition cost = abs(net_amount)
else:
  acquisition cost = abs(gross)
```

Transaction reads include the RLS-protected `transaction_components` relation. The net-debit fallback exists for historical imports that preserved an all-in purchase debit but no component detail. It is not used when any components exist, so a tax component is not silently reclassified as a fee. Presentation mode scales component cash in memory with the transaction.

Cost basis per share:

```text
cost basis per share = acquisition cost / original bought quantity
```

# Sale Proceeds

For a sell transaction:

```text
fees = absolute sum of fee, broker_fee, and exchange_fee components
```

Current formula:

```text
if gross_amount exists:
  sale proceeds = max(abs(gross_amount) - fees, 0)
else if net_amount exists:
  sale proceeds = abs(net_amount)
else:
  sale proceeds = max(quantity * unit_price - fees, 0)
```

When one sell transaction consumes multiple buy lots, sale proceeds are allocated proportionally by sold quantity:

```text
allocated sale proceeds =
  total sale proceeds * consumed quantity from lot / total sold quantity
```

# Ownership

Ownership is calculated per buy lot.

For Transaction Analytics, ownership uses LIFO sell allocation.

```text
remaining quantity = original bought quantity - quantity consumed by sells
```

Ownership status:

```text
Owned          = remaining quantity equals original quantity
Partially sold = remaining quantity is greater than 0 and below original quantity
Sold           = remaining quantity is 0
```

# Reference Price And Reference Value

Transaction Analytics displays a reference price and reference value.

## Still-Owned Or Partially-Owned Lots

For lots with remaining shares:

```text
reference price = latest available market or manual price
reference date = latest available price date
reference value = remaining quantity * reference price
```

If no current price exists:

```text
reference price = null
reference value = null
```

## Fully Sold Lots

For fully sold lots:

```text
reference date = date of the final sale allocation that closed the lot
reference price = total allocated sale proceeds / total sold quantity from the lot
reference value = total allocated sale proceeds
```

If a buy lot is sold across multiple sell transactions, the reference price is a weighted sale price derived from the allocated sale proceeds and sold quantity.

# Dividend Amount

For a dividend transaction:

```text
if gross_amount exists:
  dividend amount = abs(gross_amount)
else if net_amount exists:
  dividend amount = abs(net_amount)
else:
  dividend amount = abs(quantity * unit_price)
```

# Dividend Allocation

Dividends are allocated to buy lots of the same security.

Eligibility:

```text
lot buy date <= dividend date
and lot remaining quantity > 0 on dividend date
```

Allocation formula:

```text
allocated dividend =
  total dividend amount * lot remaining quantity / total eligible remaining quantity
```

Important consequence:

- Lots already sold before the dividend date do not receive that dividend.
- With LIFO analytics, the sell rule can change which lots remain eligible for future dividends.

# Canonical Value, Cost, And Total-Return Semantics

These definitions are authoritative for the shared lot engine and actual-versus-benchmark purchase-lot and holding comparisons.

```text
current market value = remaining quantity * current market price
economic reference value = current market value + attributed sale proceeds + attributed dividends
total gain = economic reference value - original acquisition cost
total return percent = total gain / original acquisition cost * 100
```

- Portfolio Value and current market value exclude dividends and sale proceeds.
- Dividends never reduce original acquisition cost, remaining acquisition cost, or Current Deployed Capital.
- Recorded dividends use the factual gross amount when present, otherwise net amount, otherwise factual quantity times unit price. No additional tax multiplier is applied in this canonical comparison model.
- XIRR preserves each dividend as a positive cash flow on its actual transaction date. It does not move dividends to the valuation date or assume actual reinvestment.
- A fully closed lot has zero current market value; its economic reference value is sale proceeds plus attributed dividends.
- `referenceValue` in legacy Transaction Analytics remains a valuation/sale reference and is not the canonical economic reference value.

For benchmark comparisons:

```text
actual economic reference value = current market value + actual sale proceeds + actual dividends
benchmark economic reference value = current virtual benchmark value + benchmark exit proceeds
```

Total-return/performance benchmark levels already embed benchmark-methodology dividend reinvestment, so no synthetic benchmark dividend cash flow is added. Price-index benchmarks exclude dividends. The stored benchmark `series_type` determines which disclosure is shown.

# Dividend Tax Assumption

Transaction Analytics and Stock Analytics use a fixed after-tax dividend factor:

```text
after-tax dividend = allocated dividend * 0.71575
```

This means the app currently assumes:

```text
71.575% of the dividend is retained after tax
```

This is an MVP assumption, not personalized tax advice.

# Personal Dividend Yield (Approved UI Refinement)

The 2026-09 UI refinement specification adds a separate calendar-year metric named **Personal Dividend Yield**. It does not replace the existing lot yield or canonical Total Return. The subsequent CR-02 payment-date yield and CR-05 investment Yield on Cost below have different denominators; the calendar-year chart retains this approved average-cost definition.

`Personal Dividend Yield (%) = 100 * actual gross dividends in the year / time-weighted average active acquisition cost`.

- Active acquisition cost is remaining cost basis from the shared lot engine, after each buy/sell. Sale proceeds and market prices are not the denominator.
- Weight each basis by its active UTC calendar days. A transaction applies on its event date; same-day ordering matches the shared engine. Divide accumulated basis-days by all days from January 1 to December 31 (365/366), including zero-capital days before the first purchase.
- For the current year, stop at today inclusive and divide by elapsed calendar days only. Label it `YYYY YTD`; do not annualize. Future transactions are excluded from this metric.
- Portfolio uses its existing FIFO basis policy. Selection buy-row metrics and Investment Detail continue using the existing LIFO Purchase Lots policy. This refinement does not silently resolve the cross-view policy difference.
- Numerator uses only canonical `gross_amount`. A net-only dividend makes that year's gross yield unavailable, not estimated. Zero cost, incomplete buy history (including oversells or dividends without eligible holdings), and mixed currencies also withhold the metric. An incomplete inventory remains flagged for later years rather than assuming later purchases repair it.
- Example: unchanged EUR100 + EUR200 acquisition cost and EUR30 annual gross dividends gives exactly 10.0%.

Investment History's Price mode uses factual gross dividend cash divided by eligible shares at the event, derived by the same lot inventory engine. No eligible shares or missing gross cash means no per-share value. Net cash is separately labeled only when factual. Position mode cumulatively sums canonical dividend cash using the existing gross, else net, else factual quantity-times-price convention; missing cash makes the running total unavailable. It starts at zero before the first payment and groups same-day running totals at the final total for drawing. No provider dividend events are used.

These functions operate on the already account/security-filtered and, when enabled, presentation-scaled input. They persist no derived values. Scaling multiplies cost and cash together, preserving yield percentages and per-share dividends.

# Current Dividend Yield

## Approved CR-02 Payment-Date Yield

Investment History Price shows adjacent, independent dividend/share and personal-yield bars. At each canonical payment, personal yield is `100 * calendar-year-to-date dividend cash / active remaining acquisition cost at that payment`. The numerator resets each January 1. Cost comes from the shared ledger with Investment Detail's existing LIFO matching and event ordering, not lifetime purchases or sale proceeds. Missing cash, incomplete buy history, zero cost, and mixed currencies produce unavailable values. No tax conversion is invented.

Dividend cash follows the existing factual convention: absolute gross amount, otherwise absolute net amount, otherwise known quantity times known unit price. Tooltips distinguish gross/net facts; this is not a claim that gross equals after-tax receipts. Dividend/share requires factual gross cash and eligible held shares. Canonical transaction IDs connect both bars to the existing Decision Drawer.

The tallest visible dividend/share bar and cumulative-dividend value use at most half the plot height. This changes axis domains only, recalculated from the viewport, not cash or analytical results. Price uses two independent right axes (cash/share and percentage); Position Value uses one (cumulative cash). Neither mode also renders dividend markers.

## Approved CR-05 Investment Yield on Cost

`calculateYieldOnCost` is authoritative for investment-level Yield on Cost. For an as-of date in year Y, use all factual dividend cash in Y-1 divided by remaining acquisition cost at the final dividend event in Y-1, multiplied by 100. Sales before that event reduce cost using LIFO, consistent with Investment Detail. Later purchases or sales, including later events on the same date, do not change that denominator. Each investment is calculated separately from its complete account-filtered history.

Example: EUR120 dividends with EUR2,000 active cost at September's final payment gives 6%, even after a EUR1,000 December purchase. EUR100 dividends after a sale leaves EUR1,000 acquisition cost gives 10%.

With no payment in Y-1, return 0% only when the complete history has positive valid acquisition cost at year end. A zero/missing denominator, unknown cash, incomplete inventory, or mixed currencies returns null. No Infinity/NaN or estimated tax values. Presentation scaling changes cash and costs together, preserving ratios; nothing derived is stored.

Investment Detail, Dashboard holdings, Transactions' investment-context metric, and Dividends use this same investment-level result and label its reference year. It is not a payment yield or per-lot allocation. Portfolio-wide and per-lot aggregation remain undefined and are not fabricated.

## Existing Lot Current Dividend Yield

Transaction Analytics currently uses the latest dividend allocation for the buy lot.

```text
latest dividend per share =
  latest allocated dividend amount / quantity held by the lot at that dividend date
```

Current dividend yield:

```text
current dividend yield =
  latest dividend per share / cost basis per share
```

Displayed as a percentage:

```text
current dividend yield percent =
  current dividend yield * 100
```

Notes:

- This is a yield-on-cost metric.
- It uses the latest actual allocated dividend payment.
- It is not currently annualized unless the latest dividend payment itself represents an annual dividend.
- If no dividend has been allocated to the lot, the value is missing.

# Accumulated Dividends

Accumulated dividends tax free:

```text
sum of all allocated dividends for the buy lot
```

Accumulated dividends after tax:

```text
accumulated dividends tax free * 0.71575
```

# Transaction Raw Profitability

Transaction Analytics calculates raw profitability per buy lot.

For still-owned or partially-owned lots:

```text
total economic value =
  current value of remaining shares
  + allocated sale proceeds
  + accumulated after-tax dividends
```

For fully sold lots:

```text
total economic value =
  allocated sale proceeds
  + accumulated after-tax dividends
```

Raw profit:

```text
raw profit = total economic value - original cost basis
```

Raw return:

```text
raw return percent = raw profit / original cost basis * 100
```

# Annualized Transaction Return

Annualized transaction return uses XIRR over lot-level cash flows.

The app finds the annual return rate `r` where:

```text
sum(cash flow / (1 + r) ^ years since first cash flow) = 0
```

Year fraction:

```text
years since first cash flow =
  days between first cash flow date and cash flow date / 365.25
```

Cash flows:

```text
buy date:       -original cost basis
dividend dates: +allocated dividend * 0.71575
sell dates:     +allocated sale proceeds
latest price:   +current value of remaining shares, if still owned
```

For fully sold lots:

```text
no latest price terminal value is added
```

The final positive cash flow is the sale proceeds on the sale date.

For still-owned or partially-owned lots:

```text
terminal value = remaining quantity * latest available price
terminal date = latest available price date
```

If a lot still has remaining shares but no latest price, annualized return is missing because the terminal value is incomplete.

# Stock Analytics

Stock Analytics aggregates the same buy-lot results by security key.

It does not average transaction-level annualized returns.

Instead, it combines all cash flows for that stock and runs one XIRR calculation:

```text
stock annualized return =
  XIRR(all buy, dividend, sell, and terminal value cash flows for that stock)
```

Cash flows included:

```text
all buy lots:        -cost basis
all dividends:       +allocated dividend * 0.71575
all sells:           +allocated sale proceeds
open remaining lots: +latest value
```

If the stock has any open shares without a current/latest price, stock annualized return is missing.

# Portfolio Development

Portfolio Development is a time series derived from transactions and historical prices.

For each chart date:

```text
open lots = buy lots after applying sells up to that date
portfolio value = sum(open quantity * latest price at or before chart date)
current deployed capital = sum(remaining cost basis of open lots)
investment gain/loss = portfolio value - priced current deployed capital
lifetime deployed capital = cumulative acquisition cost of all buys up to that date
dividends collected = cumulative dividend amount up to that date
```

If some open lots have no historical price at a chart date:

```text
priced current deployed capital excludes unpriced lots
portfolio value excludes unpriced lots
missing price securities are reported
```

This avoids showing missing prices as fake losses.

CR-04 clarification: the chart's Current Deployed Capital series always shows full remaining acquisition cost, including unpriced lots, so price arrival cannot create a false capital deployment event. Priced acquisition cost still underlies the separately calculated unrealized gain. Complete Portfolio Value is withheld when any open holding lacks a historical price; a separately labeled partial line may show only priced holdings. Fully closed positions retain their zero-capital event. Capital and cumulative dividends step at exact transaction dates, without event-dropping decimation. Portfolio Value never includes cumulative dividends.

# Capital Deployment

Capital Deployment is based on transaction cash movements:

```text
capital deployed starts at 0
buy transaction:      capital deployed += acquisition cost
sell transaction:     capital deployed -= sale proceeds
dividend transaction: dividends collected += dividend amount
```

The chart displays cumulative net capital deployed and cumulative dividends collected.

# Missing Data Rules

Missing prices should not be silently converted to zero for profitability.

Current behavior:

- Open lots with no current price have missing current value.
- Annualized return is missing when an open lot has no terminal price.
- Portfolio charts report incomplete pricing rather than treating missing value as a loss.
- User-facing aggregate analytics are withheld when non-EUR transaction or valuation currencies are present and no approved FX conversion is available. The UI reports the unsupported currencies instead of adding unlike currencies or changing only the symbol.

# Stored Benchmark History and Annual Comparison

- Read shared `public.benchmark_prices` through the authenticated Supabase session, ordered and paginated by `price_date`. Never use security-specific `market_prices` for benchmarks. Missing S&P 500 history is unavailable, with no substitute index.
- The initial normalized-value chart is superseded by the approved counterfactual EUR portfolio below. Annual benchmark comparison remains unchanged.
- Annual security and benchmark returns share the existing method: last stored level in a calendar year divided by the last stored level in the immediately preceding calendar year, minus one. Security levels prefer adjusted close; benchmark levels use stored close. The current year is labeled YTD. This is observation-based, not a claim that an exact December 31 close exists; YTD series can have different latest observation dates.
- Annual difference = security percentage return minus benchmark percentage return, displayed in percentage points. Missing prior-year data produces Unavailable, never a zero or a multi-year return labeled annual.
- No alpha metric, TWR, FX transformation, data import or benchmark writes are introduced.

# Counterfactual Benchmark V2 (Approved 2026-09-19)

The user approved retaining each view's current lot matching and using the existing recorded-dividend return model for new comparison views. These decisions authorize labeled current-model comparisons; the final portfolio headline Total Return and alpha remain separate open definitions.

- Every source purchase lot creates benchmark units equal to its authoritative original acquisition cost divided by the last stored benchmark level on or before the purchase date. The source transaction ID stays attached. Exact dated sale quantities come from the shared engine's allocation trace.
- Every partial or full sale closes original benchmark units multiplied by allocated sale quantity / original quantity. Actual sale proceeds never determine benchmark withdrawals. Multiple exits retain their own dates and benchmark proceeds.
- Dashboard and Current Holdings retain FIFO; Investment Detail, its Position Value chart and Purchase Lots retain LIFO. The methodology disclosure names the active rule. Comparisons across these views can differ after sales.
- Entry, exit and valuation levels use the latest prior-or-same period date; the actual source observation date must also not be in the future. EUR benchmark levels carry forward between observations and after the latest stored point, with observation dates disclosed. No rebase occurs during zoom or pan.
- Charts show remaining benchmark units times the dated level, in EUR. They include exact purchase/exit dates and weekly observations. Withdrawn proceeds are excluded from position charts. Price mode retains its existing price and dividend overlays.
- Lot and holding benchmark comparisons use Economic Reference Value as their headline monetary performance comparison. Actual Economic Reference Value includes remaining market value, attributed exit proceeds, and recorded dividends. Benchmark Economic Reference Value includes current virtual benchmark value and counterfactual exit proceeds.
- Current market value and sale proceeds remain separately visible as informational components. They are not presented as equivalent to the total-return benchmark outcome.
- Current Holdings current values include remaining positions; gain and returns include all historical lots for each still-held security, including earlier closed lots. Gain = economic reference value - original acquisition costs. Return = gain / original acquisition costs. Benchmark gain uses counterfactual exit proceeds and no invented dividend cash.
- Actual dividends retain the existing gross-first, otherwise net, otherwise factual quantity-times-price convention, with no additional 0.71575 multiplier. The new comparison does not alter the separate legacy after-tax analytics.
- XIRR reuses the shared 365.25-day solver. Benchmark flows are negative original cost, positive dated counterfactual exits, and remaining value at the actual current valuation date. Closed lots have no terminal flow. Holding XIRR combines lot cash flows, never averages rates.
- Differences are actual minus benchmark. Monetary differences are EUR; rate differences are percentage points. Both original acquisition cost and remaining cost are shown, separately from current value and total reference value.
- Series metadata distinguishes net total return, total return/performance index and price index. Total-return benchmark dividends are labeled embedded; price-index dividends are labeled excluded. Benchmark Yield on Cost remains unavailable without factual dividend cash. No synthetic cash dividends are added to total-return levels.
- Missing entry history remains unavailable permanently for that purchase; future observations cannot repair its entry. Valid lots remain visible. Aggregates with incomplete lot coverage are withheld and disclosed, never shown as complete partial sums. Non-EUR comparisons are withheld.
- New models are calculated server-side in memory. The dashboard shares its comparison calculation within the request; viewport gestures reuse the generated timeline and make no database or provider calls. Presentation-scaled inputs scale benchmark units and money consistently while preserving return percentages.

# Benchmark Navigation And Fidelity Fix (Approved 2026-09-20)

- Benchmark observations are secondary rendering samples. Dashboard navigation dates come only from portfolio development, deployment and annual primary data. Investment Detail navigation dates come only from investment prices, transaction markers and purchase dates. Benchmark selection cannot change full range, presets, minimum zoom, pan constraints or navigator width.
- Counterfactual entry, exit and valuation calculations consume every canonical benchmark row loaded from `benchmark_prices`. Daily history therefore takes effect automatically where installed. Matching remains the latest observation on or before the decision date, and `observation_date` must never be later than the decision date. Weekly-only history retains the same prior-observation behavior.
- Rendering may decimate dense daily history, but calculation history is not downsampled. Benchmark overlay points retain their own observation resolution and never rebase during viewport gestures.
- Purchase Lots → Benchmark Comparison exposes a calculation trace for each source lot: transaction identity, purchase quantity and price, acquisition cost, benchmark metadata, entry observation and lag, virtual units, proportional exits, valuation, remaining units, reference value, Total Return and XIRR differences. Entry observations more than three calendar days before purchase are flagged as stale.
- The trace is diagnostic and derived in memory. It is not persisted and does not alter the approved economic methodology, actual analytics, taxes, FIFO/LIFO policies or final α definition.

# Current Open Decisions

The following are unresolved and must not be silently decided during UI implementation:

1. **Portfolio Total Return after partial/full sales** - exact treatment of realized gains and correct denominator/methodology.
2. **Realized Gain** - exact portfolio and investment-level definition.
3. **Lot matching policy** - current behavior differs between the FIFO engine default and LIFO analytical views; one deliberate rule, or explicitly approved context-specific rules, is required.
4. **Legacy after-tax analytics** - whether the fixed `0.71575` assumption in Transaction Analytics and Stock Analytics should remain. Canonical lot/holding benchmark comparisons use recorded gross-first dividend cash without an additional multiplier.
5. **Yield on Cost aggregation** - investment-level is approved above; portfolio-wide and per-lot variants still need definitions.
6. **EUR / FX** - user-facing V1 analytics require EUR, so multi-currency valuation requires a defined methodology rather than currency relabeling.
7. **YTD and last-365-day return** - exact return methodology.

Additional future decisions include corporate actions such as splits, spin-offs, and stock dividends, and whether the fixed `0.71575` dividend factor should ever become a user setting if after-tax analytics are approved.
