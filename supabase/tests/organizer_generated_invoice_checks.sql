-- Generated organizer invoice numbering, privilege, and immutability checks.
-- Run after 20260915100443_add_generated_organizer_invoices.sql in a privileged SQL session.

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '10000000-0000-0000-0000-000000000097',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'organizer-invoice-admin@example.test', '', now(),
  '{"role":"admin"}'::jsonb, '{}'::jsonb, now(), now()
);

create temp table _organizer_invoice_fixture (edition_id uuid not null, payment_id uuid not null) on commit drop;

with available_year as (
  select event_row.id as event_id, candidate.year
  from public.race_events event_row
  cross join lateral (
    select year
    from generate_series(2080, 2089) as year
    where not exists (
      select 1 from public.race_event_editions existing
      where existing.event_id = event_row.id and existing.edition_year = year
    )
    limit 1
  ) candidate
  limit 1
), inserted_edition as (
  insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current)
  select event_id, year, make_date(year, 6, 1), make_date(year, 6, 2), false
  from available_year
  returning id
), inserted_payment as (
  select payment.id, payment.edition_id
  from inserted_edition edition
  cross join lateral public.record_admin_organizer_bank_transfer_invoice(
    edition.id,
    '10000000-0000-0000-0000-000000000097',
    'essential',
    now() - interval '1 day',
    9900,
    '{"seller":{"legalName":"Pace Yourself"},"customer":{"legalName":"Fixture Organizer"},"service":{"category":"Prestations de services"}}'::jsonb
  ) payment
)
insert into _organizer_invoice_fixture (edition_id, payment_id)
select edition_id, id from inserted_payment;

do $$
declare
  mutation_rejected boolean := false;
  deletion_rejected boolean := false;
begin
  if not exists (
    select 1
    from public.organizer_edition_payments
    where id = (select payment_id from _organizer_invoice_fixture)
      and invoice_number ~ '^PY-[0-9]{4}-[0-9]{6}$'
      and invoice_sequence > 0
      and invoice_source = 'generated'
      and invoice_legal_snapshot -> 'customer' ->> 'legalName' = 'Fixture Organizer'
  ) then
    raise exception 'Expected a chronological invoice number and immutable legal snapshot.';
  end if;

  begin
    update public.organizer_edition_payments
    set amount_total = amount_total + 1
    where id = (select payment_id from _organizer_invoice_fixture);
  exception when others then mutation_rejected := true;
  end;
  if not mutation_rejected then raise exception 'Expected issued financial facts to be immutable.'; end if;

  begin
    delete from public.organizer_edition_payments
    where id = (select payment_id from _organizer_invoice_fixture);
  exception when others then deletion_rejected := true;
  end;
  if not deletion_rejected then raise exception 'Expected issued invoices to be deletion-protected.'; end if;

  if has_function_privilege('authenticated', 'public.issue_admin_organizer_invoice(uuid,uuid,jsonb)', 'execute') then
    raise exception 'Authenticated clients must not issue organizer invoices.';
  end if;
  if not has_function_privilege('service_role', 'public.issue_admin_organizer_invoice(uuid,uuid,jsonb)', 'execute') then
    raise exception 'The service role must issue organizer invoices.';
  end if;
  if has_function_privilege('authenticated', 'public.record_admin_organizer_bank_transfer_invoice(uuid,uuid,text,timestamptz,integer,jsonb)', 'execute') then
    raise exception 'Authenticated clients must not record and issue organizer invoices.';
  end if;
  if not has_function_privilege('service_role', 'public.record_admin_organizer_bank_transfer_invoice(uuid,uuid,text,timestamptz,integer,jsonb)', 'execute') then
    raise exception 'The service role must record and issue organizer invoices.';
  end if;
end $$;

rollback;
