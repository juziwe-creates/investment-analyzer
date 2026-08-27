# Ideas

This file captures raw and semi-structured product ideas for later review. Ideas here are not committed roadmap items yet.

# Inbox

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

