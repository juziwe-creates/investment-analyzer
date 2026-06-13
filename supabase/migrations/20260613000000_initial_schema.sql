create extension if not exists "pgcrypto";

create type public.transaction_type as enum ('buy', 'sell', 'dividend', 'fee', 'tax');
create type public.transaction_component_type as enum (
  'fee',
  'tax',
  'withholding_tax',
  'exchange_fee',
  'broker_fee',
  'other'
);
create type public.source_type as enum (
  'manual',
  'csv',
  'comdirect',
  'trade_republic',
  'interactive_brokers'
);
create type public.source_document_type as enum (
  'csv',
  'broker_statement',
  'postbox_document',
  'manual_entry',
  'api_payload'
);
create type public.import_status as enum (
  'pending',
  'processing',
  'completed',
  'completed_with_errors',
  'failed'
);
create type public.import_row_status as enum ('pending', 'imported', 'skipped', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  base_currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.securities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  isin text unique,
  wkn text,
  ticker text,
  exchange text,
  currency text,
  asset_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  document_type public.source_document_type not null,
  source_type public.source_type not null,
  storage_path text,
  original_filename text,
  content_hash text,
  broker text,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  source_document_id uuid references public.source_documents(id) on delete set null,
  source_type public.source_type not null,
  broker text,
  status public.import_status not null default 'pending',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_total integer,
  rows_imported integer,
  rows_failed integer,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  security_id uuid references public.securities(id) on delete restrict,
  type public.transaction_type not null,
  trade_date date not null,
  settlement_date date,
  quantity numeric,
  unit_price numeric,
  gross_amount numeric,
  net_amount numeric,
  currency text not null,
  external_id text,
  broker text,
  source_document_id uuid references public.source_documents(id) on delete set null,
  import_run_id uuid references public.import_runs(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transaction_components (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  component_type public.transaction_component_type not null,
  amount numeric not null,
  currency text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.import_runs(id) on delete cascade,
  row_number integer,
  raw_payload jsonb not null,
  normalized_payload jsonb,
  status public.import_row_status not null default 'pending',
  transaction_id uuid references public.transactions(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.prices (
  id uuid primary key default gen_random_uuid(),
  security_id uuid not null references public.securities(id) on delete cascade,
  price_date date not null,
  close_price numeric not null,
  currency text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (security_id, price_date, source)
);

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  snapshot_date date not null,
  invested_capital numeric not null,
  portfolio_value numeric not null,
  capital_gain numeric not null,
  dividend_income numeric not null,
  currency text not null,
  calculation_version text,
  created_at timestamptz not null default now(),
  unique (portfolio_id, snapshot_date, calculation_version)
);

create index transactions_user_portfolio_trade_date_idx
  on public.transactions (user_id, portfolio_id, trade_date);
create index transactions_portfolio_security_trade_date_idx
  on public.transactions (portfolio_id, security_id, trade_date);
create index transactions_import_run_idx on public.transactions (import_run_id);
create index transactions_source_document_idx on public.transactions (source_document_id);
create index prices_security_price_date_idx on public.prices (security_id, price_date desc);
create index import_runs_user_portfolio_started_at_idx
  on public.import_runs (user_id, portfolio_id, started_at desc);
create index import_rows_import_run_row_number_idx
  on public.import_rows (import_run_id, row_number);
create index portfolio_snapshots_portfolio_snapshot_date_idx
  on public.portfolio_snapshots (portfolio_id, snapshot_date);
create index source_documents_user_uploaded_at_idx
  on public.source_documents (user_id, uploaded_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

create trigger securities_set_updated_at
  before update on public.securities
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;

  insert into public.portfolios (user_id, name)
  values (new.id, 'Default Portfolio')
  on conflict (user_id, name) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.securities enable row level security;
alter table public.source_documents enable row level security;
alter table public.import_runs enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_components enable row level security;
alter table public.import_rows enable row level security;
alter table public.prices enable row level security;
alter table public.portfolio_snapshots enable row level security;

create policy "Users can view their profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can manage their portfolios"
  on public.portfolios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authenticated users can read securities"
  on public.securities for select
  to authenticated
  using (true);

create policy "Authenticated users can insert securities"
  on public.securities for insert
  to authenticated
  with check (true);

create policy "Users can manage source documents"
  on public.source_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage import runs"
  on public.import_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage transactions"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage transaction components"
  on public.transaction_components for all
  using (
    exists (
      select 1
      from public.transactions
      where transactions.id = transaction_components.transaction_id
        and transactions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.transactions
      where transactions.id = transaction_components.transaction_id
        and transactions.user_id = auth.uid()
    )
  );

create policy "Users can manage import rows"
  on public.import_rows for all
  using (
    exists (
      select 1
      from public.import_runs
      where import_runs.id = import_rows.import_run_id
        and import_runs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.import_runs
      where import_runs.id = import_rows.import_run_id
        and import_runs.user_id = auth.uid()
    )
  );

create policy "Authenticated users can read prices"
  on public.prices for select
  to authenticated
  using (true);

create policy "Authenticated users can insert prices"
  on public.prices for insert
  to authenticated
  with check (true);

create policy "Users can manage portfolio snapshots"
  on public.portfolio_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

