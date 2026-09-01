-- Sets the EODHD provider symbol for the EUR/Xetra Microsoft listing.
-- Run after migration 20260901000000_security_provider_symbols.sql.
-- This does not rewrite transactions; transactions remain the source facts.

begin;

with selected_user as (
  select id as user_id
  from public.profiles
  order by created_at asc
  limit 1
),
selected_portfolio as (
  select portfolios.id as portfolio_id, portfolios.user_id
  from public.portfolios
  join selected_user on selected_user.user_id = portfolios.user_id
  order by portfolios.created_at asc
  limit 1
),
microsoft_security as (
  select
    transactions.user_id,
    transactions.portfolio_id,
    coalesce(transactions.isin, transactions.ticker, transactions.security_name) as security_key
  from public.transactions
  join selected_portfolio
    on selected_portfolio.user_id = transactions.user_id
   and selected_portfolio.portfolio_id = transactions.portfolio_id
  where transactions.isin = 'US5949181045'
     or transactions.wkn = '870747'
     or transactions.security_name ilike '%Microsoft%'
  group by
    transactions.user_id,
    transactions.portfolio_id,
    coalesce(transactions.isin, transactions.ticker, transactions.security_name)
),
upserted_symbol as (
  insert into public.security_provider_symbols (
    user_id,
    portfolio_id,
    security_key,
    provider,
    provider_symbol,
    source,
    notes,
    resolved_at
  )
  select
    microsoft_security.user_id,
    microsoft_security.portfolio_id,
    microsoft_security.security_key,
    'eodhd',
    'MSF.XETRA',
    'manual',
    'Microsoft EUR/Xetra listing for WKN 870747 / ISIN US5949181045.',
    now()
  from microsoft_security
  on conflict (user_id, portfolio_id, security_key, provider)
  do update set
    provider_symbol = excluded.provider_symbol,
    source = excluded.source,
    notes = excluded.notes,
    resolved_at = excluded.resolved_at,
    updated_at = now()
  returning id
)
select count(*) as upserted_provider_symbols
from upserted_symbol;

commit;
