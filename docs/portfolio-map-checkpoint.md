# Portfolio Map and chart fixes checkpoint

Branch: `codex/chart-fixes-portfolio-map` (not merged, pushed, or deployed).

## Implemented locally

- Dashboard and shared chart containers are width-constrained. A synthetic 969px Dashboard-style preview showed the plot, toolbar, and navigator inside the viewport without document-level horizontal overflow; a 390px preview also had no document overflow.
- The shared chart navigator now preserves null gaps instead of converting unavailable primary values to zero.
- Investment History identifies the first unavailable open-position date and the first valued open-position date; tooltips say `Unavailable` rather than displaying a dash for unknown market value.
- `/portfolio/map` is an optional route from Investments. It reuses current holdings, FIFO purchase lots, and the stored benchmark comparison engine. Portfolio, Sector, Performance, and Decision views are implemented with deterministic layouts, keyboard focus restoration, reduced-motion support, missing-data labels, and mobile list views. No financial calculations or database tables were added.
- Synthetic desktop and mobile previews were inspected locally, including Decision Map, Sector, Performance, and Escape behavior. Preview code and its temporary auth exception were removed.

## Still to resolve

1. **Allianz historical data:** The repository's manual monthly import lists Allianz (`DE0008404005`) starting 2024-01-31. The Investment Detail read path uses `public.market_prices` by `security_key`, then `investmentHistory` uses the latest prior-or-same-date quote. Without earlier rows under that key, the blue line correctly remains unavailable before 2024. Live Supabase rows were not readable from this checkout under RLS, so run the read-only query below to determine whether earlier prices exist under another identity or are absent. Do not backfill, interpolate, or rewrite transaction history based on this local evidence alone.
2. **Sector source:** The current schema and analytics do not store sector classification. Sector mode groups all unclassified holdings honestly; real clusters require a product choice between owner-editable metadata, a vetted provider classification, or an approved static mapping. No sector is guessed from a company name.
3. **Authenticated UI check:** The synthetic previews validate layout, not actual signed-in Dashboard or investment data. Verify both routes in a signed-in session before deployment.

## Read-only Allianz coverage query

Run in the Supabase SQL editor and inspect the output. It changes no rows.

```sql
select portfolio_id, security_key, isin, provider, provider_symbol,
       count(*) as observations, min(price_date) as first_date, max(price_date) as last_date
from public.market_prices
where security_key = 'DE0008404005'
   or isin = 'DE0008404005'
   or provider_symbol ilike 'ALV.%'
group by portfolio_id, security_key, isin, provider, provider_symbol
order by first_date, security_key;
```

If pre-2024 observations appear under a different `security_key`, investigate the identity mapping and adjust the read path with a test. If no pre-2024 observations exist, historical prices must be sourced/imported; a chart-only fix cannot restore them.

## Verification

- `npm test`: 116 passing.
- `npm run typecheck`: passing.
- `npm run lint`: passing.
- `npm run build`: passing; includes `/portfolio/map` and excludes the temporary preview route.
- Do not merge or deploy until the authenticated data and Sector-source gaps are resolved or explicitly accepted as V1 limitations.
