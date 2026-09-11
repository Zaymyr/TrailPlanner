alter table public.organizer_edition_entitlements
  drop constraint if exists organizer_edition_entitlements_source_check;

alter table public.organizer_edition_entitlements
  add constraint organizer_edition_entitlements_source_check
  check (source in ('system', 'stripe', 'manual_payment', 'admin', 'complimentary', 'legacy_admin'));

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

  if entitlement_row.status = 'active'
    and entitlement_row.source in ('admin', 'complimentary', 'legacy_admin') then
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

create or replace function public.set_admin_organizer_edition_grant(
  p_edition_id uuid,
  p_admin_id uuid,
  p_tier text,
  p_origin text
)
returns public.organizer_edition_entitlements
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  entitlement_row public.organizer_edition_entitlements;
begin
  if p_tier not in ('visibility', 'essential', 'complete', 'signature') then
    raise exception 'Invalid organizer edition tier.';
  end if;
  if p_origin not in ('admin', 'complimentary', 'stripe', 'manual_payment') then
    raise exception 'Invalid organizer edition grant origin.';
  end if;

  if p_tier = 'visibility' then
    insert into public.organizer_edition_entitlements (edition_id, tier, source, status, activated_at, revoked_at, granted_by)
    values (p_edition_id, 'visibility', 'system', 'active', null, timezone('utc', now()), p_admin_id)
    on conflict (edition_id) do update set
      tier = 'visibility', source = 'system', status = 'active', activated_at = null,
      revoked_at = timezone('utc', now()), granted_by = p_admin_id,
      updated_at = timezone('utc', now())
    returning * into entitlement_row;

    update public.races set racebook_is_live = false
    where edition_id = p_edition_id and racebook_is_live = true;
    return entitlement_row;
  end if;

  if p_origin in ('admin', 'complimentary') then
    insert into public.organizer_edition_entitlements (edition_id, tier, source, status, activated_at, revoked_at, granted_by)
    values (p_edition_id, p_tier, p_origin, 'active', timezone('utc', now()), null, p_admin_id)
    on conflict (edition_id) do update set
      tier = excluded.tier, source = excluded.source, status = 'active',
      activated_at = excluded.activated_at, revoked_at = null,
      granted_by = excluded.granted_by, updated_at = timezone('utc', now())
    returning * into entitlement_row;
    return entitlement_row;
  end if;

  insert into public.organizer_edition_entitlements (edition_id)
  values (p_edition_id)
  on conflict (edition_id) do update set
    source = 'system', tier = 'visibility', status = 'active', activated_at = null,
    revoked_at = timezone('utc', now()), granted_by = null,
    updated_at = timezone('utc', now());

  entitlement_row := public.recalculate_organizer_edition_entitlement(p_edition_id);
  if entitlement_row.tier <> p_tier or entitlement_row.source <> p_origin then
    raise exception 'No matching paid organizer transaction exists for this tier and origin.';
  end if;
  return entitlement_row;
end;
$$;

revoke all on function public.set_admin_organizer_edition_grant(uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.set_admin_organizer_edition_grant(uuid, uuid, text, text)
to service_role;

comment on function public.set_admin_organizer_edition_grant(uuid, uuid, text, text) is
  'Lets a trusted admin set an operational or complimentary grant, or restore a ledger-backed Stripe/bank-transfer entitlement.';
comment on column public.organizer_edition_entitlements.source is
  'Effective publication origin: system, Stripe, bank transfer, admin operation, complimentary grant, or legacy admin grant.';

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
    and current_entitlement.source not in ('admin', 'complimentary', 'legacy_admin') then
    raise exception 'This organizer edition tier is already active.';
  end if;

  insert into public.organizer_edition_payments (
    edition_id, purchase_kind, from_tier, to_tier, status, payment_channel, recorded_by,
    amount_subtotal, amount_tax, amount_total, currency, paid_at,
    invoice_storage_path, invoice_original_name, invoice_uploaded_at, invoice_uploaded_by
  ) values (
    p_edition_id, p_tier || '_direct', 'visibility', p_tier, 'paid', 'bank_transfer', p_admin_id,
    p_amount_subtotal, p_amount_tax, p_amount_subtotal + p_amount_tax, 'eur', p_paid_at,
    p_invoice_storage_path, p_invoice_original_name,
    case when p_invoice_storage_path is null then null else timezone('utc', now()) end,
    case when p_invoice_storage_path is null then null else p_admin_id end
  ) returning * into created_payment;

  if current_entitlement.source in ('admin', 'complimentary', 'legacy_admin') then
    update public.organizer_edition_entitlements
    set tier = 'visibility', source = 'system', status = 'active', activated_at = null,
        revoked_at = timezone('utc', now()), granted_by = null,
        updated_at = timezone('utc', now())
    where edition_id = p_edition_id;
  end if;

  perform public.recalculate_organizer_edition_entitlement(p_edition_id);
  return created_payment;
end;
$$;

revoke all on function public.record_admin_organizer_bank_transfer(uuid, uuid, text, timestamptz, integer, integer, text, text)
from public, anon, authenticated;
grant execute on function public.record_admin_organizer_bank_transfer(uuid, uuid, text, timestamptz, integer, integer, text, text)
to service_role;
