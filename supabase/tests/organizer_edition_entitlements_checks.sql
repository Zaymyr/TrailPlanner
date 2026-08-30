-- Organizer commercial entitlement transition checks.
-- Run after 20260829115507_add_organizer_edition_offers.sql in a privileged SQL session.

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
select edition_id, 'racebook', 'visibility', 'racebook', 'paid', 9900, 'eur'
from _organizer_offer_fixture;

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'racebook' then
    raise exception 'Expected paid RaceBook transaction to activate RaceBook.';
  end if;
end $$;

insert into public.organizer_edition_payments (
  edition_id, purchase_kind, from_tier, to_tier, status, amount_subtotal, currency
)
select edition_id, 'pro_upgrade', 'racebook', 'pro', 'paid', 20000, 'eur'
from _organizer_offer_fixture;

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'pro' then
    raise exception 'Expected paid upgrade to activate Pro.';
  end if;
end $$;

update public.organizer_edition_payments
set status = 'refunded', invalidated_at = now()
where edition_id = (select edition_id from _organizer_offer_fixture)
  and purchase_kind = 'pro_upgrade';

select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'racebook' then
    raise exception 'Expected refunded upgrade to return to RaceBook.';
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
  if (select tier from public.organizer_edition_entitlements where edition_id = (select edition_id from _organizer_offer_fixture)) <> 'pro' then
    raise exception 'Expected a paid direct Pro transaction to activate Pro.';
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

select public.set_admin_organizer_edition_entitlement(
  (select edition_id from _organizer_offer_fixture),
  null,
  'pro'
);
select public.recalculate_organizer_edition_entitlement((select edition_id from _organizer_offer_fixture));

do $$
begin
  if not exists (
    select 1
    from public.organizer_edition_entitlements
    where edition_id = (select edition_id from _organizer_offer_fixture)
      and tier = 'pro'
      and source = 'admin'
      and status = 'active'
  ) then
    raise exception 'Expected an active admin override to remain higher priority than refunded Stripe payments.';
  end if;
end $$;

rollback;
