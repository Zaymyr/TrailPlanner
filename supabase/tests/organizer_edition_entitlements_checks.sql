-- Organizer commercial entitlement transition checks.
-- Run after 20260911073318_add_organizer_manual_payments_and_invoices.sql in a privileged SQL session.

begin;

do $$
begin
  if exists (
    select 1
    from public.races race_row
    where race_row.event_id is not null
      and race_row.race_date is not null
      and race_row.edition_id is null
  ) then
    raise exception 'Every dated event format must be attached to a canonical edition.';
  end if;

  if exists (
    select 1
    from public.races race_row
    join public.race_event_editions edition_row on edition_row.id = race_row.edition_id
    where race_row.event_id is distinct from edition_row.event_id
      or (
        race_row.race_date is not null
        and extract(year from race_row.race_date)::smallint is distinct from edition_row.edition_year
      )
  ) then
    raise exception 'Format and edition event/year membership must remain consistent.';
  end if;
end $$;

create temp table _organizer_offer_fixture (edition_id uuid not null) on commit drop;

with available_year as (
  select event_row.id as event_id, candidate.year
  from public.race_events event_row
  cross join lateral (
    select year
    from generate_series(2090, 2100) as year
    where not exists (
      select 1 from public.race_event_editions existing
      where existing.event_id = event_row.id and existing.edition_year = year
    )
    limit 1
  ) candidate
  limit 1
), inserted as (
  insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current)
  select event_id, year, make_date(year, 6, 1), make_date(year, 6, 2), false
  from available_year
  returning id
)
insert into _organizer_offer_fixture select id from inserted;

do $$
begin
  if not exists (select 1 from _organizer_offer_fixture) then
    raise exception 'Organizer offer checks require a race event with one free edition year between 2090 and 2100.';
  end if;
end $$;

insert into public.organizer_edition_payments (
  edition_id, purchase_kind, from_tier, to_tier, status, amount_subtotal, currency
)
select edition_id, 'racebook', 'visibility', 'racebook', 'paid', 19900, 'eur'
from _organizer_offer_fixture;

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'complete' then
    raise exception 'Expected a legacy RaceBook transaction to map to Complete.';
  end if;
end $$;

insert into public.organizer_edition_payments (
  edition_id, purchase_kind, from_tier, to_tier, status, amount_subtotal, currency
)
select edition_id, 'pro_upgrade', 'racebook', 'pro', 'paid', 10000, 'eur'
from _organizer_offer_fixture;

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'signature' then
    raise exception 'Expected a legacy paid upgrade to activate Signature.';
  end if;
end $$;

update public.organizer_edition_payments
set status = 'refunded', invalidated_at = now()
where edition_id = (select edition_id from _organizer_offer_fixture)
  and purchase_kind = 'pro_upgrade';

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'complete' then
    raise exception 'Expected refunded legacy upgrade to return to Complete.';
  end if;
end $$;

update public.organizer_edition_payments
set status = 'refunded', invalidated_at = now()
where edition_id = (select edition_id from _organizer_offer_fixture)
  and purchase_kind = 'racebook';

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'visibility' then
    raise exception 'Expected refunded base payment to return to Visibility.';
  end if;
end $$;

insert into public.organizer_edition_payments (
  edition_id, purchase_kind, from_tier, to_tier, status, amount_subtotal, currency
)
select edition_id, 'pro_direct', 'visibility', 'pro', 'paid', 29900, 'eur'
from _organizer_offer_fixture;

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'signature' then
    raise exception 'Expected a legacy paid direct Pro transaction to activate Signature.';
  end if;
end $$;

update public.organizer_edition_payments
set status = 'refunded', invalidated_at = now()
where edition_id = (select edition_id from _organizer_offer_fixture)
  and purchase_kind = 'pro_direct';

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'visibility' then
    raise exception 'Expected refunded direct Pro to return to Visibility.';
  end if;
end $$;

insert into public.organizer_edition_payments (
  edition_id, purchase_kind, from_tier, to_tier, status, amount_subtotal, currency
)
select edition_id, 'essential_direct', 'visibility', 'essential', 'paid', 9900, 'eur'
from _organizer_offer_fixture;

insert into public.organizer_edition_payments (
  edition_id, purchase_kind, from_tier, to_tier, status, amount_subtotal, currency
)
select edition_id, 'essential_to_signature', 'essential', 'signature', 'paid', 25000, 'eur'
from _organizer_offer_fixture;

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'signature' then
    raise exception 'Expected a valid Essential plus Signature upgrade path to activate Signature.';
  end if;
end $$;

update public.organizer_edition_payments
set status = 'disputed', invalidated_at = now()
where edition_id = (select edition_id from _organizer_offer_fixture)
  and purchase_kind = 'essential_direct';

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'visibility' then
    raise exception 'Expected a disputed base purchase to invalidate its dependent upgrade.';
  end if;
end $$;

select public.set_admin_organizer_edition_entitlement(
  (select edition_id from _organizer_offer_fixture),
  null,
  'signature'
);
select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if not exists (
    select 1
    from public.organizer_edition_entitlements
    where edition_id = (select edition_id from _organizer_offer_fixture)
      and tier = 'signature'
      and source = 'admin'
      and status = 'active'
  ) then
    raise exception 'Expected an active admin override to remain higher priority than refunded Stripe payments.';
  end if;
end $$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '10000000-0000-0000-0000-000000000098',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'organizer-manual-payment-admin@example.test',
  '',
  now(),
  '{"role":"admin"}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

select public.record_admin_organizer_bank_transfer(
  (select edition_id from _organizer_offer_fixture),
  '10000000-0000-0000-0000-000000000098',
  'signature',
  now() - interval '1 day',
  25000,
  5000
);

do $$
declare
  duplicate_rejected boolean := false;
  downgrade_rejected boolean := false;
  visibility_rejected boolean := false;
  future_date_rejected boolean := false;
begin
  if not exists (
    select 1
    from public.organizer_edition_entitlements
    where edition_id = (select edition_id from _organizer_offer_fixture)
      and tier = 'signature'
      and source = 'manual_payment'
      and status = 'active'
  ) then
    raise exception 'Expected an admin override to be converted to a real manual payment.';
  end if;

  if not exists (
    select 1
    from public.organizer_edition_payments
    where edition_id = (select edition_id from _organizer_offer_fixture)
      and payment_channel = 'bank_transfer'
      and amount_subtotal = 25000
      and amount_tax = 5000
      and amount_total = 30000
      and currency = 'eur'
      and status = 'paid'
  ) then
    raise exception 'Expected a paid EUR bank-transfer ledger row with a calculated total.';
  end if;

  begin
    perform public.record_admin_organizer_bank_transfer(
      (select edition_id from _organizer_offer_fixture),
      '10000000-0000-0000-0000-000000000098',
      'signature', now() - interval '1 day', 25000, 5000
    );
  exception when others then
    duplicate_rejected := true;
  end;
  if not duplicate_rejected then
    raise exception 'Expected a duplicate paid tier to be rejected.';
  end if;

  begin
    perform public.record_admin_organizer_bank_transfer(
      (select edition_id from _organizer_offer_fixture),
      '10000000-0000-0000-0000-000000000098',
      'complete', now() - interval '1 day', 10000, 2000
    );
  exception when others then
    downgrade_rejected := true;
  end;
  if not downgrade_rejected then
    raise exception 'Expected a manual-payment downgrade to be rejected.';
  end if;

  begin
    perform public.record_admin_organizer_bank_transfer(
      (select edition_id from _organizer_offer_fixture),
      '10000000-0000-0000-0000-000000000098',
      'visibility', now() - interval '1 day', 0, 0
    );
  exception when others then
    visibility_rejected := true;
  end;
  if not visibility_rejected then
    raise exception 'Expected Visibility to be rejected as a paid bank-transfer tier.';
  end if;

  begin
    perform public.record_admin_organizer_bank_transfer(
      (select edition_id from _organizer_offer_fixture),
      '10000000-0000-0000-0000-000000000098',
      'signature', now() + interval '1 day', 25000, 5000
    );
  exception when others then
    future_date_rejected := true;
  end;
  if not future_date_rejected then
    raise exception 'Expected a future bank-transfer date to be rejected.';
  end if;

  if has_function_privilege('authenticated', 'public.record_admin_organizer_bank_transfer(uuid,uuid,text,timestamptz,integer,integer,text,text)', 'execute') then
    raise exception 'Authenticated clients must not execute the bank-transfer RPC.';
  end if;
  if not has_function_privilege('service_role', 'public.record_admin_organizer_bank_transfer(uuid,uuid,text,timestamptz,integer,integer,text,text)', 'execute') then
    raise exception 'The service role must execute the bank-transfer RPC.';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'organizer-invoices'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types = array['application/pdf']
  ) then
    raise exception 'Expected a private 10 MB PDF-only organizer invoice bucket.';
  end if;
end $$;

rollback;
