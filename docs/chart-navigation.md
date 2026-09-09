# Historical Chart Navigation

Implemented from the user-approved `CODEX_ALPHA_TIME_ZOOM_PAN_SPEC.md` on 2026-09-09. This is the detailed interaction supplement to `ui-ux-spec.md`; it does not amend analytics methodologies.

## Scope And Invariants

- Portfolio Performance and Capital Deployment share one `TimeViewportProvider`.
- Investment Detail Price and Position Value use the same implementation and retain the viewport, dividend preference, and selected decision when switching modes.
- The viewport changes rendering only. Current values, ownership, lots, dividends, annual calculations, and presentation-mode scaling are unaffected.
- Complete daily-resolution derived history is sent to the client. Existing weekly/monthly source observations remain available without inventing daily observations. Daily/Weekly/Monthly UI controls are removed.
- Price history reads paginate past Supabase's 1,000-row response limit, ordered by date and ID and protected by existing session/RLS. Partial reads on error are withheld.

## Controls

- Presets: 1M, 3M, YTD, 1Y, 3Y, 5Y, 10Y, MAX. End dates refer to the latest available observation, not the machine clock. Calendar-month subtraction clamps month ends correctly.
- Plus scales duration by 0.70; minus divides by 0.70, centered on the viewport. Reset restores MAX.
- Desktop horizontal pointer drag pans after a 5 CSS pixel threshold. A drag cannot activate a transaction marker.
- Ctrl/Cmd-wheel, including browser trackpad pinch wheel events, zooms around the pointer. Ordinary wheel scrolling is not prevented.
- Touch pointers support two-finger midpoint pinch and one-finger horizontal pan. `touch-action: pan-y` retains native vertical page scrolling; direction locking yields predominantly vertical gestures to the browser.
- Focused chart keyboard: plus/equal and minus zoom, arrows pan 10%, Home restores MAX. Shortcuts are not global.
- A 48px full-history overview provides selection drag, independently resizable handles, and click-to-recenter. Handles support arrow keys and expose accessible date values. Hidden below the small-screen breakpoint.
- Tooltips and labels describe each zoom control. Unusable controls are disabled at full range/minimum history. Empty histories have no navigator; at most five observations retain the full range.

## Range And Rendering Rules

- Clamp to complete available history and retain at least five actual observations. On irregular history, the minimum window expands to include five source dates; it is not a fixed five-calendar-day cutoff.
- Presets are highlighted only for an exact match; when multiple clamped presets match the full range, MAX is highlighted.
- Valid `from`/`to` URL dates initialize the range. Invalid dates, reversed dates, or incomplete pairs fall back to MAX. Out-of-range dates are clamped.
- A 250ms idle debounce uses native history replacement, preserving other query parameters and the URL hash without Next.js navigation. Refresh restores the range. Account/security context changes may clamp or reset it.
- Both axes use the visible viewport. Price axes do not force zero; all enabled series contribute to the 5% Y-axis padding. X labels adapt to duration and width, typically 5-8 on desktop and fewer on narrow screens.
- Pixel-budget decimation preserves first/last observations and per-series bucket extrema. Tooltip lookup uses the undecimated observations via binary search.
- Drawing uses boundary intersections for continuous series; these interpolated boundary coordinates are never reported as source observations in tooltips. Capital Deployment is drawn as step-held ledger totals, including after its last transaction while the shared portfolio viewport extends further.
- Missing history remains disclosed, not changed to zero. No historical prices are generated or fetched from a provider by viewport gestures.
- Investment marker dates are exact and clipped to the viewport. The decision drawer is nonmodal for this chart so navigating the chart does not close the decision. Other existing drawers remain modal.

## Verification

- Automated viewport tests: boundaries, 0.70 zoom, anchored dates, irregular minimum observations, sparse/empty data, calendar presets, invalid URL handling, and multi-series extrema preservation.
- Existing analytics, market-currency, and presentation-mode regression tests remain in the test suite.
- Browser checks with 6,600 synthetic daily observations: synchronized presets/zoom/pan, keyboard pan/zoom, navigator resize, refresh restoration, dividend toggle, marker drawer, mode switch with drawer open, three-point/empty states, and 390px responsive layout.
- Native physical trackpad and two-finger touchscreen gestures still require device QA; the available browser test surface cannot synthesize those gestures. No real portfolio data or API credits were used for fixture checks.

No database migration or environment-variable change is required.

## Provider Currency Labels

The configured EODHD and Alpha Vantage feeds are treated as EUR for analytics and display. Their API responses can carry an original/listing currency label even when the quote values used by this EUR portfolio are already EUR. This is a presentation/interpretation correction only: stored source rows remain unchanged, transaction currencies are unaffected, and no FX conversion is performed.
