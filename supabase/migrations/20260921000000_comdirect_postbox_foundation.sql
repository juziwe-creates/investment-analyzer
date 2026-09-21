alter type public.import_row_status add value if not exists 'review';
alter type public.import_row_status add value if not exists 'ignored';

alter table public.source_documents
  add column if not exists import_run_id uuid references public.import_runs(id) on delete set null,
  add column if not exists external_document_id text,
  add column if not exists document_title text,
  add column if not exists document_date date,
  add column if not exists mime_type text,
  add column if not exists normalized_document_type text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists parser_name text,
  add column if not exists parser_version text,
  add column if not exists parse_status text not null default 'pending',
  add column if not exists updated_at timestamptz not null default now();

alter table public.source_documents
  drop constraint if exists source_documents_parse_status_check;
alter table public.source_documents
  add constraint source_documents_parse_status_check check (parse_status in (
    'pending', 'processing', 'imported', 'review', 'ignored_non_transactional', 'failed'
  ));

alter table public.import_runs
  add column if not exists documents_seen integer not null default 0,
  add column if not exists documents_new integer not null default 0,
  add column if not exists documents_imported integer not null default 0,
  add column if not exists documents_review integer not null default 0,
  add column if not exists documents_ignored integer not null default 0,
  add column if not exists documents_failed integer not null default 0,
  add column if not exists transactions_created integer not null default 0,
  add column if not exists cursor_state jsonb not null default '{}'::jsonb;

alter table public.import_rows
  add column if not exists source_document_id uuid references public.source_documents(id) on delete cascade,
  add column if not exists parser_name text,
  add column if not exists parser_version text,
  add column if not exists validation_result jsonb,
  add column if not exists transaction_fingerprint text;

alter table public.transactions
  add column if not exists source_event_type text,
  add column if not exists import_fingerprint text;

alter table public.transactions
  drop constraint if exists transactions_source_event_type_check;
alter table public.transactions
  add constraint transactions_source_event_type_check check (
    source_event_type is null or source_event_type in (
      'trade', 'cash_redemption', 'worthless_expiry', 'knock_out_redemption',
      'physical_exercise', 'instrument_adjustment'
    )
  );

create unique index if not exists source_documents_external_identity_idx
  on public.source_documents (user_id, broker, external_document_id)
  where external_document_id is not null;
create unique index if not exists source_documents_content_hash_idx
  on public.source_documents (user_id, content_hash)
  where content_hash is not null;
create index if not exists source_documents_import_run_idx
  on public.source_documents (import_run_id);
create index if not exists source_documents_parse_status_idx
  on public.source_documents (user_id, portfolio_id, parse_status, created_at desc);
create unique index if not exists transactions_import_fingerprint_idx
  on public.transactions (user_id, portfolio_id, broker, import_fingerprint)
  where import_fingerprint is not null;
create index if not exists import_rows_source_document_idx
  on public.import_rows (source_document_id);

drop trigger if exists source_documents_set_updated_at on public.source_documents;
create trigger source_documents_set_updated_at
  before update on public.source_documents
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('source-documents', 'source-documents', false, 15728640, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their source document objects"
  on storage.objects for select to authenticated
  using (bucket_id = 'source-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their source document objects"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'source-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their source document objects"
  on storage.objects for update to authenticated
  using (bucket_id = 'source-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'source-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their source document objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'source-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.import_comdirect_candidate(
  p_import_row_id uuid,
  p_candidate jsonb,
  p_fingerprint text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.import_rows%rowtype;
  v_run public.import_runs%rowtype;
  v_transaction_id uuid;
  v_component jsonb;
begin
  select * into v_row
  from public.import_rows
  where id = p_import_row_id
  for update;

  if v_row.id is null then
    raise exception 'Import row is unavailable';
  end if;

  select * into v_run
  from public.import_runs
  where id = v_row.import_run_id and user_id = auth.uid();

  if v_run.id is null then
    raise exception 'Import run is unavailable';
  end if;

  if v_row.status = 'imported' and v_row.transaction_id is not null then
    return v_row.transaction_id;
  end if;

  select id into v_transaction_id
  from public.transactions
  where user_id = v_run.user_id
    and portfolio_id = v_run.portfolio_id
    and broker = 'comdirect'
    and import_fingerprint = p_fingerprint
  limit 1;

  if v_transaction_id is not null then
    update public.import_rows
    set status = 'skipped', transaction_id = v_transaction_id,
        error_message = 'An identical comdirect transaction already exists.'
    where id = v_row.id;
    return v_transaction_id;
  end if;

  insert into public.transactions (
    user_id, portfolio_id, security_name, isin, wkn, ticker, exchange,
    security_currency, asset_type, type, trade_date, settlement_date,
    quantity, unit_price, gross_amount, net_amount, currency, broker,
    source_document_id, import_run_id, source_event_type, import_fingerprint
  ) values (
    v_run.user_id,
    v_run.portfolio_id,
    coalesce(nullif(p_candidate->>'securityName', ''), nullif(p_candidate->>'isin', ''), nullif(p_candidate->>'wkn', ''), 'Unknown security'),
    nullif(p_candidate->>'isin', ''),
    nullif(p_candidate->>'wkn', ''),
    nullif(p_candidate->>'ticker', ''),
    nullif(p_candidate->>'exchange', ''),
    nullif(p_candidate->>'currency', ''),
    nullif(p_candidate->>'assetType', ''),
    (p_candidate->>'type')::public.transaction_type,
    (p_candidate->>'tradeDate')::date,
    nullif(p_candidate->>'settlementDate', '')::date,
    nullif(p_candidate->>'quantity', '')::numeric,
    nullif(p_candidate->>'unitPrice', '')::numeric,
    nullif(p_candidate->>'grossAmount', '')::numeric,
    nullif(p_candidate->>'netAmount', '')::numeric,
    p_candidate->>'currency',
    'comdirect',
    v_row.source_document_id,
    v_run.id,
    nullif(p_candidate->>'sourceEventType', ''),
    p_fingerprint
  ) returning id into v_transaction_id;

  for v_component in
    select value from jsonb_array_elements(coalesce(p_candidate->'components', '[]'::jsonb))
  loop
    insert into public.transaction_components (
      transaction_id, component_type, amount, currency, description
    ) values (
      v_transaction_id,
      (v_component->>'type')::public.transaction_component_type,
      (v_component->>'amount')::numeric,
      v_component->>'currency',
      nullif(v_component->>'description', '')
    );
  end loop;

  update public.import_rows
  set status = 'imported', transaction_id = v_transaction_id, error_message = null
  where id = v_row.id;

  update public.source_documents
  set parse_status = 'imported'
  where id = v_row.source_document_id;

  update public.import_runs
  set rows_imported = coalesce(rows_imported, 0) + 1,
      documents_imported = documents_imported + 1,
      transactions_created = transactions_created + 1
  where id = v_run.id;

  return v_transaction_id;
end;
$$;

revoke all on function public.import_comdirect_candidate(uuid, jsonb, text) from public;
grant execute on function public.import_comdirect_candidate(uuid, jsonb, text) to authenticated;
