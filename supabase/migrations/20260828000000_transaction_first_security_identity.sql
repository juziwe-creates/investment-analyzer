alter table public.transactions
  add column if not exists security_name text,
  add column if not exists isin text,
  add column if not exists wkn text,
  add column if not exists ticker text,
  add column if not exists exchange text,
  add column if not exists security_currency text,
  add column if not exists asset_type text;

update public.transactions
set security_name = coalesce(security_name, 'Unknown security')
where security_name is null;

alter table public.transactions
  alter column security_name set not null;

create index if not exists transactions_user_isin_idx
  on public.transactions (user_id, isin)
  where isin is not null;

create index if not exists transactions_user_ticker_idx
  on public.transactions (user_id, ticker)
  where ticker is not null;

create index if not exists transactions_user_security_name_idx
  on public.transactions (user_id, security_name);

drop view if exists public.user_securities;

create view public.user_securities
with (security_invoker = true)
as
select
  user_id,
  portfolio_id,
  coalesce(isin, ticker, security_name) as security_key,
  security_name,
  isin,
  wkn,
  ticker,
  exchange,
  security_currency,
  asset_type,
  count(*) as transaction_count,
  min(trade_date) as first_trade_date,
  max(trade_date) as last_trade_date
from public.transactions
group by
  user_id,
  portfolio_id,
  coalesce(isin, ticker, security_name),
  security_name,
  isin,
  wkn,
  ticker,
  exchange,
  security_currency,
  asset_type;

