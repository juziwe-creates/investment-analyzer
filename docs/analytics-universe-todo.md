# Analytics Universe Continuation

## Checkpoint 1

Branch: `codex/analytics-universe`. Current-state Core/Universe implemented; verification checkpoint before the usage allowance runs low. Do not restart or redesign completed work.

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
- Remaining QA: numeric canvas-pixel assertion (browser read-only DOM API does not expose canvas context), tablet/50-holding visual run, physical orbit/trackpad, fullscreen, reduced-motion and forced WebGL-loss flows. Do not claim these passed. Desktop screenshots confirm nonblank 3D, but frame-rate target has not been measured.
- npm audit reports 8 existing vulnerabilities (1 moderate, 6 high, 1 critical including Next.js). All affected package versions/paths are unchanged from the pre-mission lockfile. A separate security upgrade is recommended before production rollout; no automatic unrelated upgrade performed.
- Browser warnings: upstream Three.Clock deprecation and GPU shader floating-point precision warnings; no observed browser error.

## Exact Next Step

Resume with the remaining QA above and review the scene before merging. Historical work starts only after the user requests checkpoint 2. Next implementation phase then adapts the shared history engine to compact snapshots, preserving exact transaction/dividend dates.
