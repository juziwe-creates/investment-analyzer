# Analytics Universe

## Authority And Scope

Implements the approved `CODEX_MISSION_ALPHA_ANALYTICS.md` as staged work. Product and UI specs explicitly allow this new primary destination and dark cinematic exception. Checkpoint 1 covers Core and current-state Universe (mission phases A-C), fullscreen and accessibility/fallback foundations. Checkpoint 2 adds historical playback and actual recorded-dividend flows.

## Data Boundary

- `/analytics` remains inside the authenticated application shell. `loadUniverse` verifies authentication and account ownership through existing RLS reads, and fails contextually on any read error.
- Reuses `presentationTransactions`, `buildCurrentAnalytics` (Portfolio FIFO), and `buildInvestmentLedger` completeness checks. No new financial engine, persistent cache, API calls or database changes.
- Only current open holdings are projected into a serializable model. Future-dated transactions and quotes are excluded. Latest quotes may be stale; their dates are shown. If the latest stored quote is future-dated, this checkpoint withholds it rather than loading full history to find a previous quote.
- Existing provider currency normalization remains unchanged. Non-EUR transaction/manual-price currencies withhold monetary values. Missing quotes remain null; a priced subset is explicitly labeled and weights withheld. Incomplete inventory withholds aggregate value, cost basis and gain, with a warning.
- No Total Return, realized gain, annualized return, yield, or tax assumptions are introduced. Halos use the sign of existing unrealized gain. Cost basis is labeled remaining cost basis and follows Portfolio, not the LIFO Investment Detail context.
- Presentation mode transforms source transactions before this projection; only scaled quantities/cash reach the client. Account names are anonymized as elsewhere. No derived visualization data is saved.

## Visual And Interaction Contract

- Core mode opens first: glass/metal sphere, Alpha mark, slow internal ring motion, real portfolio value and explicit Enter Universe action.
- Mode changes smoothly shrink/reveal the Core and interpolate holding spheres outward, with a continuous camera pullback. No shader morph or external environment image.
- Sphere radius is cube-root relative to maximum value, clamped to 0.45-1.65 scene units. Missing value uses a neutral 0.65-unit placeholder, never a zero valuation. A common scaling factor leaves relative geometry unchanged.
- Sector anchors are fixed; hashed grid slots with deterministic collision resolution prevent overlap within clusters. Unknown metadata resolves to Other. Adding a hash-colliding holding can move subsequent collided slots, but reordering input or changing value cannot reshuffle the universe.
- Hover shows values and highlights; selection focuses the camera and opens an HTML detail pane. Empty canvas clears selection. Drag orbits, wheel zooms with bounds, Reset restores framing. User input cancels camera choreography.
- An HTML select and expandable holdings list expose the same information to keyboard and assistive-technology users. Selection focuses the nonmodal detail; closing (including Escape) returns focus to the selector. Fullscreen confines keyboard traversal to visible scene controls.
- Fullscreen uses the browser API with an in-page immersive fallback. Escape/exit controls remain available.
- Under 640px, a purpose-designed non-WebGL holdings explorer is used. Tablet/desktop use capped DPR 1.5, reused geometry, procedural lighting, no postprocessing. Reduced motion skips camera interpolation and idle movement, rendering on demand instead of continuously. A short settling-frame allowance ensures HTML labels project updated world matrices.
- WebGL creation errors, context loss and scene render errors are contained. Data errors do not break navigation.

## Historical Playback

- History loads only after **Load history**, through an authenticated server action with account ownership/RLS checks. The current scene does not wait for full price history. Failed loads are retryable. A presentation-cookie mismatch requires reload before any history is returned.
- `buildPortfolioTimeline` optionally emits per-security inventory snapshots from its existing incremental FIFO lots and latest-at-or-before quote map. Existing chart output is unchanged without the optional projection. No per-date XIRR is calculated. The existing ledger supplies completeness and actual dividend facts.
- Exact transaction dates, the last available price date per calendar month, and today's date are retained. All intervening quotes still feed the engine. Future transactions/quotes are excluded; invalid numeric/negative quotes are ignored. No price is invented or fetched from a provider.
- History follows Portfolio development's stored market series (`adjusted_close_price ?? close_price`) and EUR normalization. It does not backfill manual current quotes into past history. **Today** restores the original current model, including existing manual-quote behavior; it may differ from the last historical snapshot. Missing prices remain null/neutral with warnings; old valid prices carry forward with their dates visible.
- Identities are serialized once, with compact numeric rows for open holdings at each snapshot. Scaled presentation transactions enter the engine on the server; no raw quantities or cash are returned or persisted. Snapshots remain in component memory, not local storage or the database.
- Play/Pause, date scrubber, 0.5x/1x/2x and Today are available on desktop and the mobile HTML fallback. Playback targets 30 seconds at 1x, suspends progression in hidden tabs, and caps financial UI updates at 12.5 Hz. The displayed date/amounts are the last sampled snapshot, never interpolated financial values. Scrubbing pauses playback and does not emit dividends.
- Historical placement uses the union of historical holding identities and a fixed historical maximum valuation. Radius eases toward each snapshot target; closed positions shrink away and their labels/options disappear. Selection is cleared when the position closes. Camera framing does not restart on each price snapshot.
- Gold pulses and curved flows use received transaction events, not provider/reference dividends. Amounts follow existing `dividendFacts`: absolute gross, else net, else recorded quantity times unit payment, otherwise unknown. This is explicitly not a new net-of-tax calculation. All crossed payments are grouped per security; each notice retains their count and amount (unknown propagates). Visuals cap at eight concurrent flows/24 particles. Events without a historical sphere or known positive cash have no fabricated flow. The Dividends toggle disables the effects.
- Reduced motion has no moving particles or dividend-color accent and snaps sphere/camera changes. Optional cumulative gold memory is deferred.
- A presentation/account context change remounts the entire experience, discarding loaded history and ignoring pending results from the old session. Turning dividend effects off clears the current pulse; re-enabling cannot replay it. Pausing preserves the last published playhead, not an unrendered fractional step.
- Fullscreen entry focuses the experience and exit restores prior focus. The focus loop excludes buttons inside collapsed holdings lists, including browsers that still report layout rectangles for them. A detail removed by a full sale returns lost keyboard focus to the holdings selector; sold spheres cannot be selected while shrinking away. The date output is not a live announcement during playback.

## Dependency Isolation

Only this route imports the client experience. `next/dynamic` loads the Three.js / React Three Fiber / Drei scene with SSR disabled. Other routes do not import scene modules. React/React DOM are pinned to the existing 19.2.7 versions for Fiber 9 compatibility, not upgraded. No new key, logo network call or paid service.

## Validation

Pure tests cover cube-root sizing/clamps, sector fallback, deterministic collision-separated placement for 100 holdings, context URLs, model projection, missing values, currency/inventory guards and presentation scale invariance. Browser smoke tests and final check results are recorded in `analytics-universe-todo.md`.
