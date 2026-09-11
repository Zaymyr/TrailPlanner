-- Keep the format-scoped publication authorization aligned with the server
-- route: active event organizers and trusted app-metadata admins are allowed.
create or replace function public.set_organizer_racebook_visibility(
  p_user_id uuid,
  p_race_id uuid,
  p_is_live boolean
)
returns public.races
language plpgsql
security invoker
set search_path = ''
as $$
declare
  race_row public.races;
  entitlement_tier text;
  updated_race public.races;
begin
  select *
  into race_row
  from public.races
  where id = p_race_id
  for update;

  if race_row.id is null then
    raise exception 'Race not found.';
  end if;

  if not exists (
    select 1
    from public.race_event_organizers organizer_row
    where organizer_row.event_id = race_row.event_id
      and organizer_row.user_id = p_user_id
      and organizer_row.revoked_at is null
  ) and not exists (
    select 1
    from auth.users user_row
    where user_row.id = p_user_id
      and (
        coalesce(user_row.raw_app_meta_data ->> 'role', '') = 'admin'
        or coalesce(user_row.raw_app_meta_data -> 'roles', '[]'::jsonb) ? 'admin'
      )
  ) then
    raise exception 'Organizer access required.';
  end if;

  if p_is_live then
    if coalesce(race_row.data_status, 'complete') = 'draft' then
      raise exception 'Race format is incomplete.';
    end if;

    if race_row.edition_id is null then
      raise exception 'Race edition is required.';
    end if;

    if not exists (
      select 1
      from public.race_event_editions edition_row
      where edition_row.id = race_row.edition_id
        and edition_row.is_visible
    ) then
      raise exception 'Race edition is hidden.';
    end if;

    select entitlement_row.tier
    into entitlement_tier
    from public.organizer_edition_entitlements entitlement_row
    where entitlement_row.edition_id = race_row.edition_id
      and entitlement_row.status = 'active';

    if entitlement_tier is null or entitlement_tier not in ('essential', 'complete', 'signature') then
      raise exception 'RaceBook entitlement required.';
    end if;
  end if;

  update public.races
  set is_live = p_is_live,
      racebook_preview_is_visible = true,
      racebook_is_live = p_is_live,
      racebook_publication_approved_at = case
        when p_is_live then coalesce(racebook_publication_approved_at, timezone('utc', now()))
        else racebook_publication_approved_at
      end,
      racebook_publication_approved_by = case
        when p_is_live then coalesce(racebook_publication_approved_by, p_user_id)
        else racebook_publication_approved_by
      end
  where id = p_race_id
  returning * into updated_race;

  return updated_race;
end;
$$;

revoke all on function public.set_organizer_racebook_visibility(uuid, uuid, boolean)
from public, anon, authenticated;
grant execute on function public.set_organizer_racebook_visibility(uuid, uuid, boolean)
to service_role;

-- A real bank transfer may replace an operational or complimentary grant,
-- even when the paid pack is lower. Ledger-backed rights still reject
-- duplicate or downgrade purchases.
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
  replaces_manual_grant boolean := false;
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

  replaces_manual_grant := current_entitlement.status = 'active'
    and current_entitlement.source in ('admin', 'complimentary', 'legacy_admin');

  if not replaces_manual_grant
    and private.organizer_tier_rank(current_entitlement.tier) > private.organizer_tier_rank(p_tier) then
    raise exception 'A bank transfer cannot downgrade a paid organizer edition.';
  end if;
  if not replaces_manual_grant
    and current_entitlement.tier = p_tier
    and current_entitlement.status = 'active' then
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

  if replaces_manual_grant then
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
