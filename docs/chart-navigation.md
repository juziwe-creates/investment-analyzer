# Historical Chart Navigation

Implemented from the user-approved `CODEX_ALPHA_TIME_ZOOM_PAN_SPEC.md` on 2026-09-09. This is the detailed interaction supplement to `ui-ux-spec.md`; it does not amend analytics methodologies.

## Scope And Invariants

- Portfolio Performance and Capital Deployment share one `TimeViewportProvider`.
- Investment Detail Price and Position Value use the same implementation and retain the viewport, dividend preference, and selected decision when switching modes.
- The viewport changes rendering only. Current values, ownership, lots, dividends, annual calculations, and presentation-mode scaling are unaffected.
- Complete daily-resolution derived history is sent to the client. Existing weekly/monthly source observations remain available without inventing daily observations. Daily/Weekly/Monthly UI controls are removed.
- Price history reads paginate past Supabase's 1,000-row response limit, ordered by date and ID and protected by existing session/RLS. Partial reads on error are withheld.

## Progressive History Loading

Portfolio metrics and holdings render before the historical query completes. Portfolio Performance and Capital Deployment share one history promise and show fixed-height loading placeholders while it is pending. A query failure is shown explicitly and does not erase current metrics.

The shared viewport receives complete dates when the streamed chart data arrives; presets remain disabled until then. URL `from`/`to` values survive early filter submissions and initialize the loaded viewport. Changing account/security context resets the deferred provider so previous context dates are not reused. Investment Detail continues supplying dates directly. Zoom and pan remain client-side and do not trigger provider requests.

The performance package passed an HTTP streaming fixture check: current content arrived at approximately 218 ms and deliberately delayed history at 6,298 ms. This is a synthetic local development check, not a production latency measurement. Interactive browser re-verification of deferred loading is outstanding because the automatic approval review system rejected the browser tool with a compatibility error. Earlier browser checks below predate this loading change.

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

### UI Refinements (2026-09)

- Shared series support independent left/right Y scales, per-series formatters, nullable values, and discrete bars/lollipops. Each scale fits only visible samples; discrete events are never interpolated. Stepped cash retains its prior known value at viewport boundaries. Exact event tooltips remain available using an enlarged pointer target.
- Capital Deployment adds an explicit Select period mode. Horizontal drag selects only while enabled; otherwise existing pan/zoom remains. Selection is a separate inclusive date range, can be adjusted with handles or native date fields, clips to the visible intersection, survives zoom/MAX, and can be cleared. Escape restores the prior range during an incomplete drag. Account/security remounts clear selection.
- The selected-period view includes BUY, SELL, and DIVIDEND ledger rows in the current account/security context. Buy amounts/reference values/returns/XIRR reuse the LIFO Purchase Lots read model; sale/dividend standalone returns remain unavailable. Rows open the existing nonmodal Decision Drawer. Desktop tables switch to readable cards below 1280px.
- Personal Dividend Yield uses annual observations on the right percentage axis, with factual gross dividends and weighted cost in the tooltip. Current-year observations are labeled YTD, not annualized. Data-quality reasons are disclosed. See `analytics-rules.md` for the exact method.
- The existing Investment History Dividends toggle controls both personal transaction markers and the right series/axis. Price mode shows discrete personal gross dividend/share events; Position Value shows stepped cumulative dividend cash. The toggle, viewport, and drawer survive Price/Position switching. No personal dividends means no dividend axis.
- AlphaProgress replaces major route/history and supported local action progress with the existing Alpha mark. Status text is at most four words, appears after 250 ms, and remains for at least 400 ms while mounted. Completed navigation/Suspense boundaries are never held back just to finish an animation. The 1.4-second gentle animation is disabled under reduced motion. No fake import or broker stages were added.
- Browser checks on 2,200 synthetic observations covered selection versus zoom, single-day inclusivity, keyboard pan with selection retained, drawer continuity, dividend modes/tooltips, and 1440/1024/390px layouts. No invalid SVG paths or horizontal viewport overflow were found at the checked sizes. Quick/long progress operations and the animation were checked; physical touchscreen/trackpad and OS reduced-motion device QA remain manual checks.

- Automated viewport tests: boundaries, 0.70 zoom, anchored dates, irregular minimum observations, sparse/empty data, calendar presets, invalid URL handling, and multi-series extrema preservation.
- Existing analytics, market-currency, and presentation-mode regression tests remain in the test suite.
- Browser checks with 6,600 synthetic daily observations: synchronized presets/zoom/pan, keyboard pan/zoom, navigator resize, refresh restoration, dividend toggle, marker drawer, mode switch with drawer open, three-point/empty states, and 390px responsive layout.
- Native physical trackpad and two-finger touchscreen gestures still require device QA; the available browser test surface cannot synthesize those gestures. No real portfolio data or API credits were used for fixture checks.

No database migration or environment-variable change is required.

## Provider Currency Labels

The configured EODHD and Alpha Vantage feeds are treated as EUR for analytics and display. Their API responses can carry an original/listing currency label even when the quote values used by this EUR portfolio are already EUR. This is a presentation/interpretation correction only: stored source rows remain unchanged, transaction currencies are unaffected, and no FX conversion is performed.
