-- Structured RaceBook content constraints, privileges, atomic replacement and cascades.
-- Run after 20260907160043_add_structured_racebook_content.sql in a privileged test database.

begin;

do $$
declare table_name text;
begin
  foreach table_name in array array['race_edition_services', 'race_start_waves', 'race_awards'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || table_name)::regclass) then
      raise exception 'RLS must be enabled on %', table_name;
    end if;
    if has_table_privilege('authenticated', 'public.' || table_name, 'insert,update,delete') then
      raise exception 'Authenticated clients must not mutate %', table_name;
    end if;
    if not has_table_privilege('service_role', 'public.' || table_name, 'select,insert,update,delete') then
      raise exception 'service_role must manage %', table_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('race_edition_services', 'race_start_waves', 'race_awards')
      and roles && array['anon'::name, 'authenticated'::name]
      and coalesce(qual, '') ilike '%race_event_editions%'
  ) then
    raise exception 'Client policies must not reference service-role-only race_event_editions.';
  end if;

  if has_function_privilege('anon', 'public.replace_race_start_waves(uuid,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.replace_race_start_waves(uuid,jsonb)', 'execute')
    or not has_function_privilege('service_role', 'public.replace_race_start_waves(uuid,jsonb)', 'execute') then
    raise exception 'replace_race_start_waves execution must remain service-role-only.';
  end if;
end $$;

create temp table _structured_fixture as
select r.id race_id, r.edition_id
from public.races r
where r.edition_id is not null
limit 1;

do $$ begin
  if not exists (select 1 from _structured_fixture) then
    raise exception 'Checks require one format attached to an edition.';
  end if;
end $$;

select public.replace_race_start_waves((select race_id from _structured_fixture), '[{"name":"SAS 1","start_time":"06:00","eligibility_type":"bib_range","bib_number_min":1,"bib_number_max":200,"order_index":0}]');
select public.replace_race_awards((select race_id from _structured_fixture), '[{"category_key":"scratch","category_label":"Scratch","audience":"mixed","place_from":1,"place_to":3,"podium_time":"16:00","order_index":0}]');
select public.replace_race_edition_services((select edition_id from _structured_fixture), '[{"service_type":"restaurant","name":"Test","address":"1 rue du Trail","latitude":45,"longitude":6,"order_index":0}]');

do $$ begin
  if (select organizer_details #>> '{schedule,startTime}' from public.races where id = (select race_id from _structured_fixture)) <> '06:00:00' then
    raise exception 'First SAS must synchronize schedule.startTime.';
  end if;

  perform public.replace_race_start_waves((select race_id from _structured_fixture), '[]'::jsonb);
  if (select organizer_details #>> '{schedule,startTime}' from public.races where id = (select race_id from _structured_fixture)) <> '06:00:00' then
    raise exception 'Removing the last SAS must preserve schedule.startTime for manual editing.';
  end if;

  begin
    insert into public.race_awards(race_id, category_key, category_label, audience, place_from, place_to, podium_time)
    values ((select race_id from _structured_fixture), 'custom', 'Invalid', 'mixed', 3, 1, '17:00');
    raise exception 'Expected reversed places to fail.';
  exception when check_violation then null;
  end;
  begin
    insert into public.race_edition_services(edition_id, service_type, name, address)
    values ((select edition_id from _structured_fixture), 'accommodation', 'Invalid', 'Not geocoded');
    raise exception 'Expected non-geocoded accommodation to fail.';
  exception when check_violation then null;
  end;
end $$;

rollback;
