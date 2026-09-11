alter table public.organizer_edition_entitlements
  drop constraint if exists organizer_edition_entitlements_source_check;

alter table public.organizer_edition_entitlements
  add constraint organizer_edition_entitlements_source_check
  check (source in ('system', 'stripe', 'manual_payment', 'admin', 'legacy_admin'));

alter table public.organizer_edition_payments
  add column if not exists payment_channel text not null default 'stripe',
  add column if not exists recorded_by uuid references auth.users(id) on delete set null,
  add column if not exists stripe_invoice_id text,
  add column if not exists invoice_storage_path text,
  add column if not exists invoice_original_name text,
  add column if not exists invoice_uploaded_at timestamptz,
  add column if not exists invoice_uploaded_by uuid references auth.users(id) on delete set null;

alter table public.organizer_edition_payments
  add constraint organizer_edition_payments_channel_check
  check (payment_channel in ('stripe', 'bank_transfer')),
  add constraint organizer_edition_payments_invoice_metadata_check
  check (
    (invoice_storage_path is null and invoice_original_name is null and invoice_uploaded_at is null and invoice_uploaded_by is null)
    or
    (invoice_storage_path is not null and invoice_original_name is not null and invoice_uploaded_at is not null and invoice_uploaded_by is not null)
  ),
  add constraint organizer_edition_payments_bank_transfer_check
  check (
    payment_channel <> 'bank_transfer'
    or (
      status = 'paid'
      and currency = 'eur'
      and paid_at is not null
      and recorded_by is not null
      and amount_subtotal is not null
      and amount_tax is not null
      and amount_total = amount_subtotal + amount_tax
      and stripe_checkout_session_id is null
      and stripe_checkout_url is null
      and stripe_payment_intent_id is null
      and stripe_customer_id is null
      and stripe_invoice_id is null
    )
  );

create unique index if not exists organizer_edition_payments_stripe_invoice_idx
  on public.organizer_edition_payments(stripe_invoice_id)
  where stripe_invoice_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organizer-invoices', 'organizer-invoices', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.recalculate_organizer_edition_entitlement(p_edition_id uuid)
returns public.organizer_edition_entitlements
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  entitlement_row public.organizer_edition_entitlements;
  next_tier text := 'visibility';
  next_channel text;
  has_essential boolean := false;
  has_complete boolean := false;
  has_signature boolean := false;
begin
  select * into entitlement_row
  from public.organizer_edition_entitlements
  where edition_id = p_edition_id
  for update;

  if entitlement_row.id is null then
    insert into public.organizer_edition_entitlements (edition_id)
    values (p_edition_id)
    returning * into entitlement_row;
  end if;

  if entitlement_row.status = 'active' and entitlement_row.source in ('admin', 'legacy_admin') then
    return entitlement_row;
  end if;

  select exists (
    select 1 from public.organizer_edition_payments
    where edition_id = p_edition_id and status = 'paid'
      and purchase_kind = 'essential_direct'
  ) into has_essential;

  select
    exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind in ('complete_direct', 'racebook'))
    or (has_essential and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'essential_to_complete'))
  into has_complete;

  select
    exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind in ('signature_direct', 'pro_direct'))
    or (
      exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'racebook')
      and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'pro_upgrade')
    )
    or (has_essential and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'essential_to_signature'))
    or (has_complete and exists (select 1 from public.organizer_edition_payments where edition_id = p_edition_id and status = 'paid' and purchase_kind = 'complete_to_signature'))
  into has_signature;

  next_tier := case when has_signature then 'signature' when has_complete then 'complete' when has_essential then 'essential' else 'visibility' end;

  if next_tier <> 'visibility' then
    select payment_channel into next_channel
    from public.organizer_edition_payments
    where edition_id = p_edition_id
      and status = 'paid'
      and case next_tier
        when 'essential' then to_tier = 'essential'
        when 'complete' then to_tier in ('complete', 'racebook')
        when 'signature' then to_tier in ('signature', 'pro')
        else false
      end
    order by paid_at desc nulls last, created_at desc
    limit 1;
  end if;

  update public.organizer_edition_entitlements
  set tier = next_tier,
      source = case
        when next_tier = 'visibility' then 'system'
        when next_channel = 'bank_transfer' then 'manual_payment'
        else 'stripe'
      end,
      status = 'active',
      activated_at = case when next_tier = 'visibility' then null else coalesce(activated_at, timezone('utc', now())) end,
      revoked_at = case when next_tier = 'visibility' then timezone('utc', now()) else null end,
      updated_at = timezone('utc', now()),
      granted_by = null
  where edition_id = p_edition_id
  returning * into entitlement_row;

  if next_tier = 'visibility' then
    update public.races set racebook_is_live = false
    where edition_id = p_edition_id and racebook_is_live = true;
  end if;
  return entitlement_row;
end;
$$;

create or replace function public.record_admin_organizer_bank_transfer(
  p_edition_id uuid,
  p_admin_id uuid,
  p_tier text,
  p_paid_at timestamptz,
  p_amount_subtotal integer,
  p_amount_tax integer,
  p_invoice_storage_path text default null,
  p_invoice_original_name text default null
)
returns public.organizer_edition_payments
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_entitlement public.organizer_edition_entitlements;
  created_payment public.organizer_edition_payments;
begin
  if p_tier not in ('essential', 'complete', 'signature') then
    raise exception 'Invalid paid organizer edition tier.';
  end if;
  if p_paid_at is null or p_paid_at > timezone('utc', now()) + interval '1 minute' then
    raise exception 'Invalid bank transfer date.';
  end if;
  if p_amount_subtotal is null or p_amount_tax is null or p_amount_subtotal < 0 or p_amount_tax < 0
    or p_amount_subtotal::bigint + p_amount_tax::bigint > 2147483647 then
    raise exception 'Invalid bank transfer amounts.';
  end if;
  if (p_invoice_storage_path is null) <> (p_invoice_original_name is null) then
    raise exception 'Incomplete invoice metadata.';
  end if;

  select * into current_entitlement
  from public.organizer_edition_entitlements
  where edition_id = p_edition_id
  for update;

  if current_entitlement.id is null then
    insert into public.organizer_edition_entitlements (edition_id)
    values (p_edition_id)
    returning * into current_entitlement;
  end if;

  if private.organizer_tier_rank(current_entitlement.tier) > private.organizer_tier_rank(p_tier) then
    raise exception 'A bank transfer cannot downgrade an organizer edition.';
  end if;
  if current_entitlement.tier = p_tier
    and current_entitlement.status = 'active'
    and current_entitlement.source not in ('admin', 'legacy_admin') then
    raise exception 'This organizer edition tier is already active.';
  end if;

  insert into public.organizer_edition_payments (
    edition_id,
    purchase_kind,
    from_tier,
    to_tier,
    status,
    payment_channel,
    recorded_by,
    amount_subtotal,
    amount_tax,
    amount_total,
    currency,
    paid_at,
    invoice_storage_path,
    invoice_original_name,
    invoice_uploaded_at,
    invoice_uploaded_by
  ) values (
    p_edition_id,
    p_tier || '_direct',
    'visibility',
    p_tier,
    'paid',
    'bank_transfer',
    p_admin_id,
    p_amount_subtotal,
    p_amount_tax,
    p_amount_subtotal + p_amount_tax,
    'eur',
    p_paid_at,
    p_invoice_storage_path,
    p_invoice_original_name,
    case when p_invoice_storage_path is null then null else timezone('utc', now()) end,
    case when p_invoice_storage_path is null then null else p_admin_id end
  ) returning * into created_payment;

  if current_entitlement.source in ('admin', 'legacy_admin') then
    update public.organizer_edition_entitlements
    set tier = 'visibility',
        source = 'system',
        status = 'active',
        activated_at = null,
        revoked_at = timezone('utc', now()),
        granted_by = null,
        updated_at = timezone('utc', now())
    where edition_id = p_edition_id;
  end if;

  perform public.recalculate_organizer_edition_entitlement(p_edition_id);
  return created_payment;
end;
$$;

revoke all on function public.record_admin_organizer_bank_transfer(uuid, uuid, text, timestamptz, integer, integer, text, text)
from public, anon, authenticated;
grant execute on function private.organizer_tier_rank(text) to service_role;
grant execute on function public.record_admin_organizer_bank_transfer(uuid, uuid, text, timestamptz, integer, integer, text, text)
to service_role;

comment on column public.organizer_edition_payments.payment_channel is
  'Commercial channel shown to organizers: Stripe checkout or direct bank transfer.';
comment on column public.organizer_edition_payments.invoice_storage_path is
  'Private organizer-invoices object path for an administrator-uploaded PDF.';
comment on function public.record_admin_organizer_bank_transfer(uuid, uuid, text, timestamptz, integer, integer, text, text) is
  'Records a paid direct organizer offer by bank transfer and atomically recalculates its edition entitlement.';
