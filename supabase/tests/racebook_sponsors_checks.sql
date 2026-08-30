-- RaceBook sponsor schema, privilege, limit and atomic click checks.
-- Run after 20260829204018_add_racebook_edition_sponsors.sql in a privileged SQL session.

begin;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.race_event_edition_sponsors'::regclass and relrowsecurity
  ) then
    raise exception 'RLS must be enabled on race_event_edition_sponsors.';
  end if;

  if has_table_privilege('anon', 'public.race_event_edition_sponsors', 'select')
    or has_table_privilege('authenticated', 'public.race_event_edition_sponsors', 'select') then
    raise exception 'Client roles must not read sponsor rows directly.';
  end if;

  if not has_table_privilege('service_role', 'public.race_event_edition_sponsors', 'select,insert,update,delete') then
    raise exception 'service_role must manage sponsor rows.';
  end if;
end $$;

create temp table _racebook_sponsor_fixture (edition_id uuid not null, race_id uuid not null) on commit drop;

insert into _racebook_sponsor_fixture (edition_id, race_id)
select race.edition_id, race.id
from public.races race
where race.edition_id is not null
limit 1;

do $$
begin
  if not exists (select 1 from _racebook_sponsor_fixture) then
    raise exception 'RaceBook sponsor checks require one race attached to an edition.';
  end if;
end $$;

delete from public.race_event_edition_sponsors
where edition_id = (select edition_id from _racebook_sponsor_fixture);

insert into public.race_event_edition_sponsors (
  edition_id, name, logo_url, website_url, is_active, show_on_loading, show_in_banner, position
)
select
  (select edition_id from _racebook_sponsor_fixture),
  'Loading sponsor ' || ordinal,
  'https://example.com/logo-' || ordinal || '.png',
  'https://example.com/sponsor-' || ordinal,
  true,
  true,
  true,
  ordinal - 1
from generate_series(1, 2) ordinal;

do $$
begin
  begin
    insert into public.race_event_edition_sponsors (
      edition_id, name, logo_url, is_active, show_on_loading, show_in_banner, position
    ) values (
      (select edition_id from _racebook_sponsor_fixture),
      'Forbidden third loading sponsor',
      'https://example.com/third.png',
      true,
      true,
      true,
      2
    );
    raise exception 'Expected the third loading sponsor to be rejected.';
  exception when check_violation then
    null;
  end;
end $$;

delete from public.race_event_edition_sponsors
where edition_id = (select edition_id from _racebook_sponsor_fixture);

insert into public.race_event_edition_sponsors (
  edition_id, name, logo_url, is_active, show_on_loading, show_in_banner, position
)
select
  (select edition_id from _racebook_sponsor_fixture),
  'Sponsor ' || ordinal,
  'https://example.com/logo-' || ordinal || '.png',
  false,
  false,
  false,
  ordinal - 1
from generate_series(1, 10) ordinal;

do $$
begin
  begin
    insert into public.race_event_edition_sponsors (
      edition_id, name, logo_url, is_active, show_on_loading, show_in_banner, position
    ) values (
      (select edition_id from _racebook_sponsor_fixture),
      'Forbidden eleventh sponsor',
      'https://example.com/eleventh.png',
      false,
      false,
      false,
      9
    );
    raise exception 'Expected the eleventh sponsor to be rejected.';
  exception when check_violation then
    null;
  end;
end $$;

delete from public.race_event_edition_sponsors
where edition_id = (select edition_id from _racebook_sponsor_fixture);

insert into public.race_event_edition_sponsors (
  id, edition_id, name, logo_url, website_url, is_active, show_on_loading, show_in_banner, position
) values (
  '7a110000-5999-4000-8000-000000000999',
  (select edition_id from _racebook_sponsor_fixture),
  'Atomic click sponsor',
  'https://example.com/atomic.png',
  'https://example.com/atomic',
  true,
  false,
  true,
  0
);

select public.increment_racebook_sponsor_click(
  '7a110000-5999-4000-8000-000000000999',
  (select race_id from _racebook_sponsor_fixture)
);

do $$
begin
  if (
    select click_count from public.race_event_edition_sponsors
    where id = '7a110000-5999-4000-8000-000000000999'
  ) <> 1 then
    raise exception 'Sponsor click increment must be atomic and aggregate-only.';
  end if;
end $$;

rollback;
