drop view if exists public.latest_provider_market_prices;
drop view if exists public.market_dividend_coverage;
drop view if exists public.market_price_coverage;

create view public.market_price_coverage
with (security_invoker = true)
as
select
  user_id,
  portfolio_id,
  security_key,
  provider,
  count(*)::integer as price_count,
  min(price_date) as first_price_date,
  max(price_date) as latest_price_date,
  max(updated_at) as latest_updated_at
from public.market_prices
group by
  user_id,
  portfolio_id,
  security_key,
  provider;

create view public.market_dividend_coverage
with (security_invoker = true)
as
select
  user_id,
  portfolio_id,
  security_key,
  provider,
  count(*)::integer as dividend_count,
  min(ex_dividend_date) as first_ex_dividend_date,
  max(ex_dividend_date) as latest_ex_dividend_date,
  max(updated_at) as latest_updated_at
from public.market_dividends
group by
  user_id,
  portfolio_id,
  security_key,
  provider;

create view public.latest_provider_market_prices
with (security_invoker = true)
as
select distinct on (user_id, portfolio_id, security_key, provider)
  id,
  user_id,
  portfolio_id,
  security_key,
  security_name,
  isin,
  ticker,
  provider,
  provider_symbol,
  price_date,
  close_price,
  adjusted_close_price,
  currency,
  created_at,
  updated_at
from public.market_prices
order by user_id, portfolio_id, security_key, provider, price_date desc, created_at desc;
