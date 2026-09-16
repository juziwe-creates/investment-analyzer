# Analytics Universe Continuation

## Checkpoint 1

Branch: `codex/analytics-universe`, uploaded to GitHub. Current-state Core/Universe implemented and synthetic browser QA completed. Do not restart or redesign completed work. The GitHub connector's draft-PR request timed out during permission review; PR creation is not confirmed.

## Remaining Mission Work

| Requested behavior | Reason / current substitute | Next step |
| --- | --- | --- |
| Historical timeline, play/scrub/speed/Today | Explicitly checkpoint 2; current state only | Adapt shared incremental inventory/history into compact snapshots retaining transaction/dividend dates; do not call per-lot XIRR per frame/date |
| Gold dividend flows | Depends on playback; no provider events substituted | Project actual received canonical cash events and add bounded batching/curved particle paths |
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

Review the uploaded checkpoint-1 branch/preview before merging. Historical work starts when the user requests checkpoint 2: adapt the shared history engine to compact snapshots, preserving exact transaction/dividend dates, then add bounded received-dividend flows. Address existing dependency security findings separately before production rollout.
