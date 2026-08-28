drop view if exists public.user_securities;

create view public.user_securities
with (security_invoker = true)
as
select
  user_id,
  portfolio_id,
  security_key,
  (array_agg(security_name order by trade_date desc, created_at desc))[1] as security_name,
  (array_agg(isin order by trade_date desc, created_at desc) filter (where isin is not null))[1] as isin,
  (array_agg(wkn order by trade_date desc, created_at desc) filter (where wkn is not null))[1] as wkn,
  (array_agg(ticker order by trade_date desc, created_at desc) filter (where ticker is not null))[1] as ticker,
  (array_agg(exchange order by trade_date desc, created_at desc) filter (where exchange is not null))[1] as exchange,
  (
    array_agg(security_currency order by trade_date desc, created_at desc)
    filter (where security_currency is not null)
  )[1] as security_currency,
  (
    array_agg(asset_type order by trade_date desc, created_at desc)
    filter (where asset_type is not null)
  )[1] as asset_type,
  count(*) as transaction_count,
  min(trade_date) as first_trade_date,
  max(trade_date) as last_trade_date
from (
  select
    transactions.*,
    coalesce(isin, ticker, security_name) as security_key
  from public.transactions
) keyed_transactions
group by
  user_id,
  portfolio_id,
  security_key;
