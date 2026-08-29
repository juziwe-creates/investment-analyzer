# Analytics Rules

# Purpose

This document records the formulas and analytics decisions currently used by Investment Analyzer.

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
if fees exist or gross_amount exists:
  acquisition cost = abs(gross) + fees
else if net_amount exists:
  acquisition cost = abs(net_amount)
else:
  acquisition cost = abs(gross)
```

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

# Current Dividend Yield

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

# Current Open Decisions

The following decisions should be revisited before analytics become broader or more formal:

- Whether LIFO should apply only to Transaction/Stock Analytics or to every analytics view.
- Whether current dividend yield should use latest dividend payment, trailing twelve months, or annualized expected dividend.
- Whether the fixed dividend tax factor `0.71575` should become a user setting.
- How to handle multiple currencies and FX rates.
- How to represent corporate actions such as splits, spin-offs, and stock dividends.
- Whether realized tax treatment should be separated from raw investment performance.
