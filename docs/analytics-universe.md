# Analytics Universe

## Authority And Scope

Implements the approved `CODEX_MISSION_ALPHA_ANALYTICS.md` as staged work. Product and UI specs explicitly allow this new primary destination and dark cinematic exception. Checkpoint 1 covers Core and current-state Universe (mission phases A-C), fullscreen, accessibility/fallback foundations and verification. History and dividends remain checkpoint 2, not simulated in this release.

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
- An HTML select and expandable holdings list expose the same information to keyboard and assistive-technology users. Selection focuses the nonmodal detail; closing returns focus to the selector.
- Fullscreen uses the browser API with an in-page immersive fallback. Escape/exit controls remain available.
- Under 640px, a purpose-designed non-WebGL holdings explorer is used. Tablet/desktop use capped DPR 1.5, reused geometry, procedural lighting, no postprocessing. Reduced motion skips camera interpolation and idle movement.
- WebGL creation errors, context loss and scene render errors are contained. Data errors do not break navigation.

## Dependency Isolation

Only this route imports the client experience. `next/dynamic` loads the Three.js / React Three Fiber / Drei scene with SSR disabled. Other routes do not import scene modules. React/React DOM are pinned to the existing 19.2.7 versions for Fiber 9 compatibility, not upgraded. No new key, logo network call or paid service.

## Validation

Pure tests cover cube-root sizing/clamps, sector fallback, deterministic collision-separated placement for 100 holdings, context URLs, model projection, missing values, currency/inventory guards and presentation scale invariance. Browser smoke tests and final check results are recorded in `analytics-universe-todo.md`.
