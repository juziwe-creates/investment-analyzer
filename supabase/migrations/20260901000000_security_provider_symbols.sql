create table if not exists public.security_provider_symbols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  security_key text not null,
  provider text not null,
  provider_symbol text not null,
  source text not null default 'manual'
    check (source in ('manual', 'derived', 'api_search', 'import', 'system')),
  notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, portfolio_id, security_key, provider)
);

create index if not exists security_provider_symbols_user_provider_idx
  on public.security_provider_symbols (user_id, portfolio_id, provider, security_key);

drop trigger if exists security_provider_symbols_set_updated_at on public.security_provider_symbols;

create trigger security_provider_symbols_set_updated_at
  before update on public.security_provider_symbols
  for each row execute function public.set_updated_at();

alter table public.security_provider_symbols enable row level security;

drop policy if exists "Users can manage their security provider symbols"
  on public.security_provider_symbols;

create policy "Users can manage their security provider symbols"
  on public.security_provider_symbols for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
