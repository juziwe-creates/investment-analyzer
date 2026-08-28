# Ideas

This file captures raw and semi-structured product ideas for later review. Ideas here are not committed roadmap items yet.

# Inbox

## Portfolio Development Stacked Chart

Status: unreviewed

Problem:

- The first analytics view should make it easy to understand how the portfolio developed over time.
- A single current profitability number is useful, but it does not show when capital was invested, when gains appeared, or how portfolio value changed across market cycles.

Idea:

- Add a portfolio development chart with time on the x-axis and money on the y-axis.
- The time interval should be configurable, for example daily, weekly, monthly, quarterly, or yearly.
- Show invested capital as the first stacked area.
- Show investment gain as the second stacked area on top of invested capital.
- Investment gain for a date means total security market value on that date minus overall invested capital on that date.
- The stacked total therefore represents portfolio market value on that date.

User Value:

- Users can see whether portfolio growth came from adding capital or from investment performance.
- Users can understand how their invested capital changed over time.
- Users can visually connect market gains and losses to the portfolio timeline.
- This creates a natural first dashboard graph once historical prices are available.

Potential Display Behavior:

- Allow the user to switch chart interval without changing the underlying stored daily prices.
- Use daily data as the base when available, then aggregate for wider chart intervals.
- Show invested capital and investment gain as distinct colors in a stacked area chart.
- Support negative investment gain by showing losses below the invested-capital baseline or with a clear alternate visual treatment.
- Consider adding tooltips with date, invested capital, investment gain, portfolio value, and total return percentage.

Open Questions:

- Should invested capital mean total buy cost basis minus sell proceeds, or cumulative net cash invested?
- Should dividends be shown as a third stacked area, a separate line, or excluded from the first version?
- Should taxes and fees be included in invested capital from the beginning?
- Should the chart use trade date or settlement date?
- How should missing historical prices be filled: previous close, nearest close, or gap?

Implementation Notes:

- This should be derived from transactions plus historical market prices.
- Store daily historical prices, then aggregate to the selected chart interval at query/calculation time.
- The first version can use FIFO lot state per date to calculate holdings and value.
- The calculation should remain traceable back to transactions and price rows.

## Obfuscated Portfolio Presentation Mode

Status: unreviewed

Problem:

- Users may want to show their portfolio analytics to friends, family, or peers without exposing their actual portfolio value, transaction sizes, income, or net worth.
- A simple screenshot or live demo currently reveals sensitive financial scale even when the user only wants to discuss portfolio composition, investment behavior, or relative performance.

Idea:

- Add a presentation mode that obfuscates absolute financial values while preserving relative analytics.
- In this mode, transaction quantities and derived money values would be multiplied by a session-specific factor.
- The factor should remain stable within a single presentation session so charts, tables, and derived metrics remain internally consistent.
- A new factor could be generated for each session so repeated demos do not reveal the real scale over time.

User Value:

- Users can show portfolio composition without revealing actual value.
- Users can discuss profitability per transaction while hiding real position sizes.
- Users can demonstrate how their investment volume and behavior changed over time without exposing actual invested capital.
- Users can share decision-quality insights while protecting privacy.

Potential Display Behavior:

- Preserve percentages such as gain percentage, yield on cost, allocation percentage, and annualized return.
- Obfuscate absolute values such as quantity, cost basis, current value, invested capital, dividends received, and portfolio value.
- Clearly indicate that presentation mode is active so the user does not confuse obfuscated values with real values.

Open Questions:

- Should the multiplier apply to quantities only, monetary values only, or both?
- Should the multiplier be random per session, user-configurable, or selected from privacy levels?
- Should dates remain exact, be rounded, or optionally shifted to protect timing privacy?
- Should rare holdings or very small positions be hidden because composition alone may reveal sensitive information?
- Should exported screenshots and reports automatically inherit presentation mode?

Implementation Notes:

- Prefer applying obfuscation in a presentation/view layer rather than modifying stored transactions.
- Never persist obfuscated transactions as canonical data.
- The random factor should be stable for the active presentation session and discarded afterward unless the user explicitly saves a presentation profile.
- This feature should be designed carefully so derived metrics stay mathematically coherent.
