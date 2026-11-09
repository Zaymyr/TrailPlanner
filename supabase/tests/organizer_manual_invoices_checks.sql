-- Independent organizer invoice, settlement and feature-catalog checks.
-- Run after 20261109190500_separate_organizer_invoices_and_feature_grants.sql.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.organizer_invoices', 'SELECT')
    or has_table_privilege('authenticated', 'public.organizer_invoices', 'SELECT')
    or has_table_privilege('authenticated', 'public.organizer_feature_catalog', 'SELECT') then
    raise exception 'Organizer invoice and feature catalog tables must remain service-only.';
  end if;
  if not has_table_privilege('service_role', 'public.organizer_invoices', 'SELECT,INSERT,UPDATE') then
    raise exception 'service_role must manage organizer invoices.';
  end if;
  if has_function_privilege('authenticated', 'public.issue_admin_organizer_invoice(uuid,uuid,text,date,date,integer,integer,integer,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.settle_admin_organizer_invoice(uuid,uuid,timestamptz,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.update_admin_organizer_feature_catalog(uuid,text,boolean)', 'EXECUTE') then
    raise exception 'Authenticated clients must not issue or settle organizer invoices.';
  end if;
  if (select count(*) from public.organizer_feature_catalog) <> 14 then
    raise exception 'Expected fourteen giftable organizer features.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizer_feature_catalog' and column_name in ('unit_price_cents', 'currency')) then
    raise exception 'Giftable organizer features must not expose standalone prices.';
  end if;
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000096', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manual-invoice-admin@example.test', '', now(), '{"role":"admin"}', '{}', now(), now())
on conflict (id) do update set raw_app_meta_data = excluded.raw_app_meta_data;

create temp table _manual_invoice_fixture (edition_id uuid, invoice_id uuid, correction_id uuid, paid_invoice_id uuid) on commit drop;
with available_year as (
  select event_row.id event_id, candidate.year from public.race_events event_row
  cross join lateral (select year from generate_series(2090, 2099) year where not exists (select 1 from public.race_event_editions e where e.event_id = event_row.id and e.edition_year = year) limit 1) candidate
  limit 1
), edition as (
  insert into public.race_event_editions(event_id, edition_year, start_date, end_date, is_current)
  select event_id, year, make_date(year,6,1), make_date(year,6,2), false from available_year returning id
)
insert into _manual_invoice_fixture(edition_id) select id from edition;

set local role service_role;

do $$
declare valued_gift_rejected boolean := false;
begin
  begin
    perform public.issue_admin_organizer_invoice(
      (select edition_id from _manual_invoice_fixture), '10000000-0000-0000-0000-000000000096', 'essential',
      current_date, current_date + 30, 9900, 0, 9900,
      '{"lines":[{"description":"Pack Essentiel","unitPriceCents":9900,"discountCents":0,"netCents":9900,"offered":false},{"featureKey":"module.services","description":"Services","unitPriceCents":1250,"discountCents":1250,"netCents":0,"offered":true}]}'::jsonb,
      null
    );
  exception when check_violation then
    valued_gift_rejected := true;
  end;
  if not valued_gift_rejected then
    raise exception 'New organizer invoices must reject monetary values on gifted features.';
  end if;
end $$;

with issued as (
  select public.issue_admin_organizer_invoice(
    (select edition_id from _manual_invoice_fixture), '10000000-0000-0000-0000-000000000096', 'essential',
    current_date, current_date + 30, 34900, 29900, 5000,
    '{"customer":{"legalName":"Fixture"},"lines":[{"description":"Pack Essentiel","unitPriceCents":34900,"discountCents":29900,"netCents":5000,"offered":false},{"featureKey":"module.services","description":"Services","offered":true}]}'::jsonb, null
  ) row
)
update _manual_invoice_fixture set invoice_id = (select (row).id from issued);

do $$
declare mutation_rejected boolean := false; deletion_rejected boolean := false;
begin
  if exists (select 1 from public.organizer_edition_entitlements where edition_id = (select edition_id from _manual_invoice_fixture) and tier <> 'visibility') then
    raise exception 'Issuing an invoice must not activate organizer rights.';
  end if;
  begin update public.organizer_invoices set net_total = 1 where id = (select invoice_id from _manual_invoice_fixture); exception when others then mutation_rejected := true; end;
  begin delete from public.organizer_invoices where id = (select invoice_id from _manual_invoice_fixture); exception when others then deletion_rejected := true; end;
  if not mutation_rejected or not deletion_rejected then raise exception 'Issued invoice legal facts must be immutable and deletion-protected.'; end if;
end $$;

with corrected as (
  select public.issue_admin_organizer_invoice(
    (select edition_id from _manual_invoice_fixture), '10000000-0000-0000-0000-000000000096', 'essential',
    current_date, current_date + 45, 34900, 34900, 0, '{"customer":{"legalName":"Corrected Fixture"},"lines":[{"description":"Pack Essentiel","unitPriceCents":34900,"discountCents":34900,"netCents":0,"offered":true}]}'::jsonb,
    (select invoice_id from _manual_invoice_fixture)
  ) row
)
update _manual_invoice_fixture set correction_id = (select (row).id from corrected);

with issued_for_settlement as (
  select public.issue_admin_organizer_invoice(
    (select edition_id from _manual_invoice_fixture), '10000000-0000-0000-0000-000000000096', 'complete',
    current_date, current_date + 30, 69900, 19900, 50000,
    '{"customer":{"legalName":"Settlement Fixture"},"lines":[{"description":"Pack Complet","unitPriceCents":69900,"discountCents":19900,"netCents":50000,"offered":false}]}'::jsonb, null
  ) row
)
update _manual_invoice_fixture set paid_invoice_id = (select (row).id from issued_for_settlement);

select public.settle_admin_organizer_invoice(
  (select paid_invoice_id from _manual_invoice_fixture),
  '10000000-0000-0000-0000-000000000096',
  now(),
  'TEST-SETTLEMENT'
);

-- Repeating the same transition is intentionally idempotent.
select public.settle_admin_organizer_invoice(
  (select paid_invoice_id from _manual_invoice_fixture),
  '10000000-0000-0000-0000-000000000096',
  now(),
  'IGNORED-SECOND-SETTLEMENT'
);

do $$
begin
  if not exists (select 1 from public.organizer_invoices where id = (select invoice_id from _manual_invoice_fixture) and document_status = 'replaced') then
    raise exception 'A correction must retain and replace the original invoice.';
  end if;
  if not exists (select 1 from public.organizer_invoices where id = (select correction_id from _manual_invoice_fixture) and invoice_type = 'corrective' and net_total = 0 and paid_at is null) then
    raise exception 'Expected a zero-net corrective invoice with no settlement.';
  end if;
  if not exists (select 1 from public.organizer_invoices where id = (select paid_invoice_id from _manual_invoice_fixture) and paid_at is not null and payment_reference = 'TEST-SETTLEMENT') then
    raise exception 'Expected the positive invoice to be settled exactly once.';
  end if;
  if exists (select 1 from public.organizer_edition_entitlements where edition_id = (select edition_id from _manual_invoice_fixture) and tier <> 'visibility') then
    raise exception 'Settling an invoice must not activate organizer rights.';
  end if;
end $$;

select public.set_admin_organizer_edition_capability_grant(
  (select edition_id from _manual_invoice_fixture), '10000000-0000-0000-0000-000000000096', 'module.services', true
);

do $$
begin
  if not exists (select 1 from public.organizer_edition_capability_grants where edition_id = (select edition_id from _manual_invoice_fixture) and capability_key = 'module.services' and status = 'active') then
    raise exception 'Expected an individually gifted organizer feature.';
  end if;
end $$;

rollback;
