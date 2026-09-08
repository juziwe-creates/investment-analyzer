# Scaled Portfolio Presentation

Settings > More settings > Scale to 1 million deployed capital enables a read-only presentation.

The factor is 1,000,000 divided by current remaining cost basis across all accounts, using the existing dashboard lot methodology. It is independent of account, investment, date and pagination filters. Filtered subsets are therefore portions of the normalized portfolio, not independently normalized portfolios. It is recomputed from current records per request.

Transaction quantities, gross amounts and net amounts are multiplied by the same factor before analytics run. This scales costs, proceeds, fees/taxes included in amounts, dividends, holdings, ledger values, chart axes, tooltips and decision drawers together. Per-share prices, dates and percentage definitions remain unchanged. No rounding is applied before analytics.

All transformations are copies in request memory. No database writes, migrations, local storage, stored factor or stored scaled records are used. A session-only HttpOnly cookie holds the boolean preference. Cookies can survive browser session restoration depending on browser settings; signing out explicitly clears it. The preference applies to the browser, including other tabs on their next request.

React request caching deduplicates complete paginated transaction reads within a render. It does not share private data across users or requests. Existing Supabase authentication and RLS apply. Invalid/nonpositive deployed capital, non-EUR transactions and history read failures prevent activation. Calculation failures while active fail closed without revealing unscaled values.

Mode changes invalidate the Next route cache and reload the document. In presentation mode internal links use full navigations; restored browser back/forward pages reload. Email/account names and free-text transaction notes/references are suppressed. Imports and market-data administration are unavailable, transaction entry is hidden, and data-mutating server actions reject requests until the mode is disabled.

This is a visual presentation feature for the owner, not a public sharing link or an access-control boundary. Existing browser tabs/screenshots from before activation are unaffected until reloaded. Known real transaction sizes can reveal the common multiplier. Dates and investment identity remain visible intentionally.

## iOS Home Screen

The original supplied artwork is available through the App Router apple-icon.png convention, which emits apple-touch-icon metadata. Add Alpha using Safari > Share > Add to Home Screen. Existing home-screen shortcuts may need to be removed and added again to update cached artwork.
