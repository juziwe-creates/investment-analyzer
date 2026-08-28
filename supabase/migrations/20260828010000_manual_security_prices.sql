create table if not exists public.manual_security_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  security_key text not null,
  security_name text not null,
  isin text,
  ticker text,
  price numeric not null,
  currency text not null,
  price_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, portfolio_id, security_key)
);

create index if not exists manual_security_prices_user_portfolio_idx
  on public.manual_security_prices (user_id, portfolio_id);

create trigger manual_security_prices_set_updated_at
  before update on public.manual_security_prices
  for each row execute function public.set_updated_at();

alter table public.manual_security_prices enable row level security;

create policy "Users can manage manual security prices"
  on public.manual_security_prices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

