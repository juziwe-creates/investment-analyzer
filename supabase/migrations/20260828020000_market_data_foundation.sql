create table if not exists public.market_data_sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  security_key text,
  provider text not null,
  provider_symbol text,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'completed_with_errors', 'failed')),
  prices_imported integer not null default 0,
  dividends_imported integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  security_key text not null,
  security_name text not null,
  isin text,
  ticker text,
  provider text not null,
  provider_symbol text not null,
  price_date date not null,
  open_price numeric,
  high_price numeric,
  low_price numeric,
  close_price numeric not null,
  adjusted_close_price numeric,
  volume numeric,
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, portfolio_id, security_key, provider, price_date)
);

create table if not exists public.market_dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  security_key text not null,
  security_name text not null,
  isin text,
  ticker text,
  provider text not null,
  provider_symbol text not null,
  ex_dividend_date date not null,
  declaration_date date,
  record_date date,
  payment_date date,
  amount_per_share numeric not null,
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (
    user_id,
    portfolio_id,
    security_key,
    provider,
    ex_dividend_date,
    amount_per_share
  )
);

create index if not exists market_data_sync_runs_user_created_idx
  on public.market_data_sync_runs (user_id, created_at desc);

create index if not exists market_prices_user_security_date_idx
  on public.market_prices (user_id, portfolio_id, security_key, price_date desc);

create index if not exists market_prices_provider_symbol_date_idx
  on public.market_prices (provider, provider_symbol, price_date desc);

create index if not exists market_dividends_user_security_date_idx
  on public.market_dividends (user_id, portfolio_id, security_key, ex_dividend_date desc);

create trigger market_prices_set_updated_at
  before update on public.market_prices
  for each row execute function public.set_updated_at();

create trigger market_dividends_set_updated_at
  before update on public.market_dividends
  for each row execute function public.set_updated_at();

alter table public.market_data_sync_runs enable row level security;
alter table public.market_prices enable row level security;
alter table public.market_dividends enable row level security;

create policy "Users can manage market data sync runs"
  on public.market_data_sync_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage market prices"
  on public.market_prices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage market dividends"
  on public.market_dividends for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop view if exists public.latest_market_prices;

create view public.latest_market_prices
with (security_invoker = true)
as
select distinct on (user_id, portfolio_id, security_key)
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
order by user_id, portfolio_id, security_key, price_date desc, created_at desc;
