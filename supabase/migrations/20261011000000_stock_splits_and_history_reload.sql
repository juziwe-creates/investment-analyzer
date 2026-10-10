begin;

create table if not exists public.market_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  security_key text not null,
  provider text not null,
  provider_symbol text not null,
  split_date date not null,
  numerator numeric not null check (numerator > 0),
  denominator numeric not null check (denominator > 0),
  created_at timestamptz not null default now(),
  unique (user_id, portfolio_id, security_key, split_date)
);
alter table public.market_splits enable row level security;
drop policy if exists "Users can manage their stock splits" on public.market_splits;
create policy "Users can manage their stock splits" on public.market_splits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and exists (
    select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = auth.uid()
  ));
create index if not exists market_splits_owner_date_idx on public.market_splits (user_id, portfolio_id, split_date);
-- ON CONFLICT requires this identity even when the table was created earlier.
-- Existing duplicates cause an error and rollback; no split rows are removed.
do $$
begin
  if not exists (
    select 1 from pg_index i
    where i.indrelid = 'public.market_splits'::regclass and i.indisunique and i.indisvalid
      and i.indpred is null and i.indexprs is null and i.indnkeyatts = 4
      and (select array_agg(a.attname::text order by k.ordinality)
        from unnest(i.indkey) with ordinality k(attnum, ordinality)
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        where k.ordinality <= i.indnkeyatts
      ) = array['user_id', 'portfolio_id', 'security_key', 'split_date']
  ) then
    create unique index market_splits_identity_idx on public.market_splits (user_id, portfolio_id, security_key, split_date);
  end if;
end $$;
grant select, insert, update, delete on public.market_splits to authenticated;
grant all on public.market_splits to service_role;

-- Each replacement is one transaction: a failed insert rolls back the deletes.
-- Only the offline administration tool may invoke this operation.
create or replace function public.replace_security_market_history(
  p_user_id uuid, p_portfolio_id uuid, p_security_key text,
  p_prices jsonb, p_dividends jsonb, p_splits jsonb
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.portfolios where id = p_portfolio_id and user_id = p_user_id) then
    raise exception 'Portfolio owner mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_portfolio_id::text || ':' || p_security_key, 0));
  if p_prices is null or p_dividends is null or p_splits is null
     or jsonb_typeof(p_prices) <> 'array' or jsonb_array_length(p_prices) = 0
     or jsonb_typeof(p_dividends) <> 'array' or jsonb_typeof(p_splits) <> 'array' then
    raise exception 'A validated nonempty price history is required';
  end if;
  if exists (select 1 from jsonb_populate_recordset(null::public.market_prices, p_prices) r
    where r.user_id is distinct from p_user_id or r.portfolio_id is distinct from p_portfolio_id
      or r.security_key is distinct from p_security_key or r.provider is distinct from 'eodhd'
      or r.currency is distinct from 'EUR' or r.close_price is null or r.close_price <= 0 or r.price_date is null)
    or exists (select 1 from jsonb_populate_recordset(null::public.market_dividends, p_dividends) r
      where r.user_id is distinct from p_user_id or r.portfolio_id is distinct from p_portfolio_id
        or r.security_key is distinct from p_security_key or r.provider is distinct from 'eodhd')
    or exists (select 1 from jsonb_populate_recordset(null::public.market_splits, p_splits) r
      where r.user_id is distinct from p_user_id or r.portfolio_id is distinct from p_portfolio_id
        or r.security_key is distinct from p_security_key or r.provider is distinct from 'eodhd') then
    raise exception 'Replacement payload scope or values are invalid';
  end if;
  delete from public.market_prices where user_id = p_user_id and portfolio_id = p_portfolio_id and security_key = p_security_key;
  delete from public.market_dividends where user_id = p_user_id and portfolio_id = p_portfolio_id and security_key = p_security_key;
  delete from public.market_splits where user_id = p_user_id and portfolio_id = p_portfolio_id and security_key = p_security_key;
  insert into public.market_prices (user_id, portfolio_id, security_key, security_name, isin, ticker,
    provider, provider_symbol, price_date, open_price, high_price, low_price, close_price, adjusted_close_price, volume, currency)
    select user_id, portfolio_id, security_key, security_name, isin, ticker, provider, provider_symbol,
      price_date, open_price, high_price, low_price, close_price, adjusted_close_price, volume, currency
    from jsonb_populate_recordset(null::public.market_prices, p_prices);
  insert into public.market_dividends (user_id, portfolio_id, security_key, security_name, isin, ticker,
    provider, provider_symbol, ex_dividend_date, declaration_date, record_date, payment_date, amount_per_share, currency)
    select user_id, portfolio_id, security_key, security_name, isin, ticker, provider, provider_symbol,
      ex_dividend_date, declaration_date, record_date, payment_date, amount_per_share, currency
    from jsonb_populate_recordset(null::public.market_dividends, p_dividends);
  insert into public.market_splits (user_id, portfolio_id, security_key, provider, provider_symbol, split_date, numerator, denominator)
    select user_id, portfolio_id, security_key, provider, provider_symbol, split_date, numerator, denominator
    from jsonb_populate_recordset(null::public.market_splits, p_splits);
end $$;
revoke all on function public.replace_security_market_history(uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_security_market_history(uuid, uuid, text, jsonb, jsonb, jsonb) to service_role;

-- Reuses the existing shared benchmark table and its read-only client policies.
create or replace function public.replace_benchmark_history(p_benchmark_id text, p_rows jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_benchmark_id is null or p_rows is null or p_benchmark_id not in ('msci-world', 'sp-500', 'dax') or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'A supported benchmark and nonempty replacement are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('benchmark:' || p_benchmark_id, 0));
  if exists (select 1 from jsonb_populate_recordset(null::public.benchmark_prices, p_rows) r
    where r.benchmark_id is distinct from p_benchmark_id or r.currency is distinct from 'EUR'
      or r.close_price is null or r.close_price <= 0 or r.observation_date is distinct from r.price_date
      or r.frequency is distinct from 'daily' or r.provider is distinct from 'eodhd')
    or (select count(distinct r.series_type) from jsonb_populate_recordset(null::public.benchmark_prices, p_rows) r) <> 1 then
    raise exception 'Invalid benchmark scope, currency, dates or methodology';
  end if;
  if exists (select 1 from public.benchmark_prices old
    where old.benchmark_id = p_benchmark_id and old.series_type is distinct from p_rows->0->>'series_type') then
    raise exception 'Benchmark return methodology must match existing history';
  end if;
  delete from public.benchmark_prices where benchmark_id = p_benchmark_id;
  insert into public.benchmark_prices (benchmark_id, benchmark_name, price_date, observation_date, close_price,
    currency, frequency, series_type, is_derived, is_partial_period, provider, provider_symbol, source_type, source_notes)
    select benchmark_id, benchmark_name, price_date, observation_date, close_price, currency, frequency, series_type,
      is_derived, is_partial_period, provider, provider_symbol, source_type, source_notes
    from jsonb_populate_recordset(null::public.benchmark_prices, p_rows);
end $$;
revoke all on function public.replace_benchmark_history(text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_benchmark_history(text, jsonb) to service_role;

commit;
