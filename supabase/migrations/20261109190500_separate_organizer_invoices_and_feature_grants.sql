-- Separate manual invoicing from organizer payments and entitlements, and
-- generalize complimentary access to every higher-tier feature.

create table public.organizer_feature_catalog (
  feature_key text primary key,
  label text not null,
  minimum_tier text not null check (minimum_tier in ('complete', 'signature')),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  is_active boolean not null default true,
  sort_order integer not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.organizer_feature_catalog (feature_key, label, minimum_tier, unit_price_cents, sort_order)
values
  ('module.services', 'Services & alentours', 'complete', 1250, 10),
  ('module.start_waves', 'SAS', 'complete', 1250, 20),
  ('module.awards', 'Podiums & récompenses', 'complete', 1250, 30),
  ('advanced.format_equipment', 'Matériel par format', 'complete', 1250, 40),
  ('advanced.format_bib_pickup', 'Dossard par format', 'complete', 1250, 50),
  ('advanced.format_access', 'Accès par format', 'complete', 1250, 60),
  ('capability.followers_notify', 'Notifications aux abonnés', 'complete', 1250, 70),
  ('capability.edition_duplicate', 'Duplication annuelle', 'complete', 1250, 80),
  ('module.branding', 'Identité visuelle', 'signature', 2500, 90),
  ('module.sponsors', 'Sponsors', 'signature', 2500, 100),
  ('module.relay', 'Relais', 'signature', 2500, 110),
  ('module.official_products', 'Produits officiels', 'signature', 2500, 120),
  ('capability.assisted_import', 'Import assisté', 'signature', 2500, 130),
  ('capability.racebook_analytics', 'Statistiques Livret coureur', 'signature', 2500, 140)
on conflict (feature_key) do nothing;

alter table public.organizer_feature_catalog enable row level security;
revoke all on table public.organizer_feature_catalog from public, anon, authenticated;
grant select, update on table public.organizer_feature_catalog to service_role;
create index organizer_feature_catalog_updated_by_idx on public.organizer_feature_catalog (updated_by) where updated_by is not null;

create table public.organizer_invoices (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.race_event_editions(id) on delete restrict,
  invoice_number text not null unique,
  invoice_sequence integer not null check (invoice_sequence > 0),
  invoice_issued_at timestamptz not null default now(),
  invoice_type text not null default 'standard' check (invoice_type in ('standard', 'corrective')),
  replaces_invoice_id uuid references public.organizer_invoices(id) on delete restrict,
  document_status text not null default 'active' check (document_status in ('active', 'replaced')),
  tier text not null check (tier in ('essential', 'complete', 'signature')),
  service_date date not null,
  due_date date not null,
  original_subtotal integer not null check (original_subtotal >= 0),
  discount_total integer not null check (discount_total >= 0),
  net_total integer not null check (net_total >= 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  legal_snapshot jsonb not null check (jsonb_typeof(legal_snapshot) = 'object'),
  invoice_storage_path text,
  invoice_original_name text,
  pdf_stored_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizer_invoices_amounts_check check (discount_total <= original_subtotal and net_total = original_subtotal - discount_total),
  constraint organizer_invoices_dates_check check (due_date >= service_date),
  constraint organizer_invoices_correction_check check ((invoice_type = 'standard' and replaces_invoice_id is null) or (invoice_type = 'corrective' and replaces_invoice_id is not null)),
  constraint organizer_invoices_pdf_check check ((invoice_storage_path is null and invoice_original_name is null and pdf_stored_at is null) or (invoice_storage_path is not null and invoice_original_name is not null and pdf_stored_at is not null)),
  constraint organizer_invoices_payment_check check ((paid_at is null and paid_by is null) or (paid_at is not null and paid_by is not null and net_total > 0))
);

create index organizer_invoices_edition_issued_idx on public.organizer_invoices (edition_id, invoice_issued_at desc);
create index organizer_invoices_created_by_idx on public.organizer_invoices (created_by) where created_by is not null;
create index organizer_invoices_paid_by_idx on public.organizer_invoices (paid_by) where paid_by is not null;
create unique index organizer_invoices_replaces_idx on public.organizer_invoices (replaces_invoice_id) where replaces_invoice_id is not null;

alter table public.organizer_invoices enable row level security;
revoke all on table public.organizer_invoices from public, anon, authenticated;
grant select, insert, update on table public.organizer_invoices to service_role;

create or replace function public.update_admin_organizer_feature_catalog(
  p_admin_id uuid,
  p_feature_key text,
  p_unit_price_cents integer,
  p_is_active boolean
)
returns public.organizer_feature_catalog
language plpgsql
security invoker
set search_path = ''
as $$
declare catalog_row public.organizer_feature_catalog;
begin
  if p_admin_id is null or p_unit_price_cents is null or p_unit_price_cents < 0 or p_is_active is null then
    raise exception 'Invalid organizer feature catalog update.' using errcode = '22023';
  end if;
  update public.organizer_feature_catalog
  set unit_price_cents = p_unit_price_cents, is_active = p_is_active,
      updated_by = p_admin_id, updated_at = now()
  where feature_key = p_feature_key
  returning * into catalog_row;
  if catalog_row.feature_key is null then
    raise exception 'Unknown organizer feature.' using errcode = '22023';
  end if;
  return catalog_row;
end;
$$;

alter table public.organizer_edition_capability_grants
  drop constraint if exists organizer_edition_capability_grants_capability_key_check;

update public.organizer_edition_capability_grants
set capability_key = 'capability.racebook_analytics'
where capability_key = 'racebook_analytics.view';

alter table public.organizer_edition_capability_grants
  add constraint organizer_edition_capability_grants_capability_key_check check (capability_key in (
    'module.services', 'module.start_waves', 'module.awards',
    'advanced.format_equipment', 'advanced.format_bib_pickup', 'advanced.format_access',
    'capability.followers_notify', 'capability.edition_duplicate',
    'module.branding', 'module.sponsors', 'module.relay', 'module.official_products',
    'capability.assisted_import', 'capability.racebook_analytics'
  ));

create or replace function public.set_admin_organizer_edition_capability_grant(
  p_edition_id uuid,
  p_admin_id uuid,
  p_capability_key text,
  p_enabled boolean
)
returns public.organizer_edition_capability_grants
language plpgsql
security invoker
set search_path = ''
as $$
declare
  grant_row public.organizer_edition_capability_grants;
  changed_at timestamptz := now();
begin
  if p_capability_key not in (
    'module.services', 'module.start_waves', 'module.awards',
    'advanced.format_equipment', 'advanced.format_bib_pickup', 'advanced.format_access',
    'capability.followers_notify', 'capability.edition_duplicate',
    'module.branding', 'module.sponsors', 'module.relay', 'module.official_products',
    'capability.assisted_import', 'capability.racebook_analytics'
  ) then raise exception 'Invalid organizer edition feature.' using errcode = '22023'; end if;
  if p_enabled is null then raise exception 'Feature enabled state is required.' using errcode = '22023'; end if;
  if p_admin_id is null then raise exception 'Administrator attribution is required.' using errcode = '22023'; end if;

  select * into grant_row from public.organizer_edition_capability_grants
  where edition_id = p_edition_id and capability_key = p_capability_key for update;
  if found and grant_row.status = (case when p_enabled then 'active' else 'revoked' end) then return grant_row; end if;
  if not found and not p_enabled then return null; end if;

  insert into public.organizer_edition_capability_grants (
    edition_id, capability_key, status, granted_by, granted_at, revoked_by, revoked_at, updated_at
  ) values (
    p_edition_id, p_capability_key, case when p_enabled then 'active' else 'revoked' end,
    case when p_enabled then p_admin_id else null end, case when p_enabled then changed_at else null end,
    case when p_enabled then null else p_admin_id end, case when p_enabled then null else changed_at end, changed_at
  ) on conflict (edition_id, capability_key) do update set
    status = excluded.status,
    granted_by = case when excluded.status = 'active' then excluded.granted_by else public.organizer_edition_capability_grants.granted_by end,
    granted_at = case when excluded.status = 'active' then excluded.granted_at else public.organizer_edition_capability_grants.granted_at end,
    revoked_by = excluded.revoked_by, revoked_at = excluded.revoked_at, updated_at = excluded.updated_at
  where public.organizer_edition_capability_grants.status is distinct from excluded.status
  returning * into grant_row;
  return grant_row;
end;
$$;

create or replace function public.issue_admin_organizer_invoice(
  p_edition_id uuid,
  p_admin_id uuid,
  p_tier text,
  p_service_date date,
  p_due_date date,
  p_original_subtotal integer,
  p_discount_total integer,
  p_net_total integer,
  p_legal_snapshot jsonb,
  p_replaces_invoice_id uuid default null
)
returns public.organizer_invoices
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  invoice_row public.organizer_invoices;
  replaced_row public.organizer_invoices;
  issued_at timestamptz := now();
  issued_year integer := extract(year from timezone('Europe/Paris', now()))::integer;
  next_sequence integer;
begin
  if p_admin_id is null or p_tier not in ('essential', 'complete', 'signature')
    or p_service_date is null or p_due_date is null or p_due_date < p_service_date
    or p_original_subtotal < 0 or p_discount_total < 0 or p_net_total < 0
    or p_discount_total > p_original_subtotal or p_net_total <> p_original_subtotal - p_discount_total
    or p_legal_snapshot is null or jsonb_typeof(p_legal_snapshot) <> 'object'
  then raise exception 'Invalid organizer invoice facts.' using errcode = '22023'; end if;

  if p_replaces_invoice_id is not null then
    select * into replaced_row from public.organizer_invoices where id = p_replaces_invoice_id for update;
    if replaced_row.id is null or replaced_row.edition_id <> p_edition_id or replaced_row.document_status <> 'active' or replaced_row.paid_at is not null then
      raise exception 'Only an active unpaid invoice can be corrected.' using errcode = '23514';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('organizer_invoice_' || issued_year::text));
  select greatest(
    coalesce((select max(invoice_sequence) from public.organizer_invoices where invoice_issued_at >= make_timestamptz(issued_year,1,1,0,0,0,'Europe/Paris') and invoice_issued_at < make_timestamptz(issued_year+1,1,1,0,0,0,'Europe/Paris')), 0),
    coalesce((select max(invoice_sequence) from public.organizer_edition_payments where invoice_issued_at >= make_timestamptz(issued_year,1,1,0,0,0,'Europe/Paris') and invoice_issued_at < make_timestamptz(issued_year+1,1,1,0,0,0,'Europe/Paris')), 0)
  ) + 1 into next_sequence;

  insert into public.organizer_invoices (
    edition_id, invoice_number, invoice_sequence, invoice_issued_at, invoice_type, replaces_invoice_id,
    tier, service_date, due_date, original_subtotal, discount_total, net_total, legal_snapshot, created_by
  ) values (
    p_edition_id, 'PY-' || issued_year::text || '-' || lpad(next_sequence::text, 6, '0'), next_sequence, issued_at,
    case when p_replaces_invoice_id is null then 'standard' else 'corrective' end, p_replaces_invoice_id,
    p_tier, p_service_date, p_due_date, p_original_subtotal, p_discount_total, p_net_total, p_legal_snapshot, p_admin_id
  ) returning * into invoice_row;

  if p_replaces_invoice_id is not null then
    update public.organizer_invoices set document_status = 'replaced', updated_at = issued_at where id = p_replaces_invoice_id;
  end if;
  return invoice_row;
end;
$$;

create or replace function public.settle_admin_organizer_invoice(p_invoice_id uuid, p_admin_id uuid, p_paid_at timestamptz, p_payment_reference text default null)
returns public.organizer_invoices
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare invoice_row public.organizer_invoices;
begin
  select * into invoice_row from public.organizer_invoices where id = p_invoice_id for update;
  if invoice_row.id is null or invoice_row.document_status <> 'active' or invoice_row.net_total = 0 then
    raise exception 'This invoice cannot be settled.' using errcode = '23514';
  end if;
  if invoice_row.paid_at is not null then return invoice_row; end if;
  if p_admin_id is null or p_paid_at is null or p_paid_at > now() + interval '1 minute' then
    raise exception 'Invalid settlement facts.' using errcode = '22023';
  end if;
  update public.organizer_invoices set paid_at = p_paid_at, paid_by = p_admin_id,
    payment_reference = nullif(btrim(p_payment_reference), ''), updated_at = now()
  where id = p_invoice_id returning * into invoice_row;
  return invoice_row;
end;
$$;

create or replace function private.protect_organizer_invoice()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then raise exception 'An issued organizer invoice cannot be deleted.'; end if;
  if new.invoice_number is distinct from old.invoice_number or new.invoice_sequence is distinct from old.invoice_sequence
    or new.invoice_issued_at is distinct from old.invoice_issued_at or new.invoice_type is distinct from old.invoice_type
    or new.replaces_invoice_id is distinct from old.replaces_invoice_id or new.edition_id is distinct from old.edition_id
    or new.tier is distinct from old.tier or new.service_date is distinct from old.service_date
    or new.due_date is distinct from old.due_date or new.original_subtotal is distinct from old.original_subtotal
    or new.discount_total is distinct from old.discount_total or new.net_total is distinct from old.net_total
    or new.currency is distinct from old.currency or new.legal_snapshot is distinct from old.legal_snapshot
    or new.created_by is distinct from old.created_by
  then raise exception 'Issued organizer invoice facts are immutable.'; end if;
  if old.document_status = 'replaced' and new.document_status <> 'replaced' then raise exception 'A replaced invoice cannot be restored.'; end if;
  if old.paid_at is not null and (new.paid_at is distinct from old.paid_at or new.paid_by is distinct from old.paid_by or new.payment_reference is distinct from old.payment_reference) then
    raise exception 'Invoice settlement facts are immutable.';
  end if;
  return new;
end;
$$;

create trigger protect_organizer_invoice_trigger before update or delete on public.organizer_invoices
for each row execute function private.protect_organizer_invoice();

revoke all on function public.issue_admin_organizer_invoice(uuid,uuid,text,date,date,integer,integer,integer,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.issue_admin_organizer_invoice(uuid,uuid,text,date,date,integer,integer,integer,jsonb,uuid) to service_role;
revoke all on function public.update_admin_organizer_feature_catalog(uuid,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.update_admin_organizer_feature_catalog(uuid,text,integer,boolean) to service_role;
revoke all on function public.settle_admin_organizer_invoice(uuid,uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function public.settle_admin_organizer_invoice(uuid,uuid,timestamptz,text) to service_role;
revoke all on function private.protect_organizer_invoice() from public, anon, authenticated;
grant execute on function private.protect_organizer_invoice() to service_role;

comment on table public.organizer_feature_catalog is 'Service-only prices for individually giftable organizer features.';
comment on table public.organizer_invoices is 'Immutable manual organizer invoices, corrections and settlement facts, independent from edition entitlements.';
