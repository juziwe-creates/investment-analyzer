# Analytics Universe Continuation

## Checkpoint 1

Branch: `codex/analytics-universe`, uploaded to GitHub. Current-state Core/Universe implemented and synthetic browser QA completed. Do not restart or redesign completed work. The GitHub connector's draft-PR request timed out during permission review; PR creation is not confirmed.

## Remaining Mission Work

| Requested behavior | Reason / current substitute | Next step |
| --- | --- | --- |
| Historical timeline, play/scrub/speed/Today | Implemented in checkpoint 2 | Reconcile preview history with actual account records; test long real-world histories |
| Gold dividend flows | Implemented from actual recorded transactions, bounded to 8 concurrent flows | Optional cumulative Core memory remains deferred; further visual polish after user testing |
| Sector enrichment | No sector fields in current schema/read model; all unknowns use Other | Add optional enrichment behind resolveSector using approved existing metadata, without a paid API or per-render network call |
| Company logos | No reliable existing source; intentional ticker/name monograms | Add cached/local logo metadata only when source and licensing are agreed |
| Precise particle-to-sphere morph, internal particles, parallax | Simplified to procedural materials/rings, scale/position interpolation and continuous camera reveal | Optional polish after timeline is correct |
| Return / dividend / annualized detail metrics | Unresolved semantics; only current value, weight, quantity, FIFO remaining basis and unrealized gain shown | Revisit approved definitions, not invent formulas for visualization |
| Phone 3D | Intentional accessible HTML fallback under 640px | Profile actual phones before enabling simplified 3D |

## Verification

- 59 unit tests pass. `npm run typecheck`, `npm run lint`, `npm run build` and `git diff --check` passed. Production build includes the authenticated `/analytics` route and excludes the temporary fixture.
- Synthetic-only local browser QA at 1440x1000 and 390x844: Core and Universe render; mode transition, HTML holding selection, detail values/link, phone fallback and no horizontal overflow verified. No live customer data or DB writes used. Temporary fixture removed before commit.
- Resumed synthetic QA: 50 holdings at 1440x1000 and 1024x900; direct sphere click, detail value/link, pointer orbit, camera reset, fullscreen entry/exit, and 390x844 phone fallback all verified. Phone renders no WebGL canvas and has no horizontal overflow.
- A temporary test-only UI sampled the rendered WebGL framebuffer: Core had >208,000 non-background pixels and Universe >93,000 at desktop size. Pixel hashes changed with ordinary motion. Reduced-motion Core and Universe each produced identical hashes across a two-second sample. After switching reduced motion to demand rendering, screenshots confirmed the scene and labels still settle correctly. Test UI removed before commit.
- Short local animation-callback samples: Core 102 frames/2.016s; 50-holding Universe 108 frames/2.016s (about 51/54 fps). This is a synthetic development-browser observation, not a production/GPU frame-time guarantee.
- Forced WEBGL_lose_context displayed the contained fallback; selecting an unpriced holding still worked and disclosed missing valuation. Escape closes detail and returns focus to the selector. Fullscreen keyboard containment added for the in-page fallback.
- Remaining device QA: physical touch/trackpad, screen-reader testing, rejected/unsupported native Fullscreen API path, and production-account reconciliation. Synthetic reduced-motion preference injection is verified; no OS settings were changed.
- npm audit reports 8 existing vulnerabilities (1 moderate, 6 high, 1 critical including Next.js). All affected package versions/paths are unchanged from the pre-mission lockfile. A separate security upgrade is recommended before production rollout; no automatic unrelated upgrade performed.
- Browser warnings: upstream Three.Clock deprecation and GPU shader floating-point precision warnings; no observed browser error.

## Exact Next Step

Review checkpoint 2 in the branch preview: open alpha analytics, choose Load history, enter Universe, play/scrub, inspect a partial/full sale, and use Today. No migration or provider sync is needed. Reconcile historical snapshot dates with Portfolio development and actual received dividends. Complete reduced-motion playback, fullscreen timeline keyboard, authenticated server-action error/presentation mismatch, and physical device QA before merging to production. Address existing dependency security findings separately before production rollout.

## Checkpoint 2 Verification

- Preserves checkpoint 1; adds lazy authenticated history, shared-engine compact inventory snapshots, timeline controls, stable historical placement, closed-position transitions, and bounded dividend flows. No database or provider writes and no new dependency.
- 66 unit tests pass, including 7 new history tests: sampling/event dates, FIFO inventory versus full lot calculation, unchanged existing timeline results for FIFO/LIFO, missing/FX/incomplete-data handling, presentation scaling/future exclusion, playback bounds and event batching.
- Typecheck, lint, 66 tests, production build and staged diff checks passed. Build required network access for the existing Geist font and removal of stale generated dev types referencing the deleted fixture. The final 19-route build excludes the fixture.
- Synthetic browser QA: 1440x1000 desktop; earliest snapshot shows 20 shares, partial sale 10 shares with correct remaining cost, full sale removes the option and detail; Today restores current state. Forward playback progresses through dates; recorded dividend notices and warm-gold sphere pulses visible. A temporary WebGL readback measured 13,954 non-background pixels and up to 340 gold-colored pixels during early playback (not a particle-only count or performance benchmark). No captured browser errors; upstream Three.Clock deprecation remains.
- Verified 2x selection and dividend toggle. At 390x844 the HTML timeline/explorer remains usable, no canvas is mounted, and document width equals scroll width (375 CSS pixels excluding scrollbar). A temporary test-output overflow was isolated to the fixture, not app controls.
- Browser opening initially timed out due network IO suspension; a fresh test tab succeeded after the local route responded. Synthetic fixture removed and test server stopped before commit. No customer data used.
- Remaining verification: full reduced-motion playback, dense-flow curve animation inspection, 0.5x wall-clock timing, physical devices, real authenticated history/presentation checks and live-account reconciliation. These are not claimed as completed. Usage checkpoint reached after browser testing; preserve this work on continuation.
