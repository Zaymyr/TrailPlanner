-- Organizer import session / draft format checks.
-- Run manually in a privileged Supabase SQL editor or psql session after migrations.
-- The script reuses one existing event edition, creates rollback-only import state,
-- exercises service-role RPC access, and rolls back every fixture.

begin;

do $$
begin
  if not (
    select c.relrowsecurity
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'organizer_import_sessions'
  ) then
    raise exception 'organizer_import_sessions must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.organizer_import_sessions', 'SELECT')
    or has_table_privilege('authenticated', 'public.organizer_import_sessions', 'SELECT') then
    raise exception 'Client roles must not receive organizer_import_sessions privileges.';
  end if;

  if not has_table_privilege('service_role', 'public.organizer_import_sessions', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'service_role must manage organizer_import_sessions.';
  end if;

  if has_function_privilege('anon', 'public.confirm_organizer_import_formats(uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.confirm_organizer_import_formats(uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.apply_organizer_import_field_patches(uuid,jsonb,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.apply_organizer_import_field_patches(uuid,jsonb,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.configure_organizer_import_cleanup_cron()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.configure_organizer_import_cleanup_cron()', 'EXECUTE') then
    raise exception 'Client roles must not execute organizer import functions.';
  end if;

  if not has_function_privilege('service_role', 'public.confirm_organizer_import_formats(uuid,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.apply_organizer_import_field_patches(uuid,jsonb,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.configure_organizer_import_cleanup_cron()', 'EXECUTE') then
    raise exception 'service_role must execute organizer import RPCs.';
  end if;
end $$;

create temp table _organizer_import_fixture (
  event_id uuid not null,
  edition_id uuid not null,
  session_id uuid,
  invalid_session_id uuid,
  race_id uuid
) on commit drop;

insert into _organizer_import_fixture (event_id, edition_id)
select edition_row.event_id, edition_row.id
from public.race_event_editions as edition_row
order by edition_row.created_at
limit 1;

do $$
begin
  if not exists (select 1 from _organizer_import_fixture) then
    raise exception 'Organizer import checks require at least one race_event_editions row.';
  end if;
end $$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000099',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'organizer-import-session-check@example.test',
  '',
  now(),
  '{"role":"admin"}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do update
set raw_app_meta_data = excluded.raw_app_meta_data,
    updated_at = excluded.updated_at;

set local role service_role;

with inserted_session as (
  insert into public.organizer_import_sessions (
    event_id,
    edition_id,
    created_by,
    source_manifest,
    discovery_snapshot,
    expires_at
  )
  select
    event_id,
    edition_id,
    '10000000-0000-0000-0000-000000000099',
    '{"url":"https://example.test/race","formatUrls":[],"documents":[]}'::jsonb,
    '{"candidateCount":1}'::jsonb,
    timezone('utc', now()) + interval '1 hour'
  from _organizer_import_fixture
  returning id
)
update _organizer_import_fixture
set session_id = inserted_session.id
from inserted_session;

with confirmed as (
  select public.confirm_organizer_import_formats(
    (select session_id from _organizer_import_fixture),
    '[{"formatKey":"candidate-1","candidateKeys":["candidate-1"],"mode":"create","name":"Import SQL Check 42K"}]'::jsonb
  ) as payload
)
update _organizer_import_fixture
set race_id = (confirmed.payload -> 'formats' -> 0 ->> 'raceId')::uuid
from confirmed;

do $$
declare
  imported_race public.races;
  stored_candidate_key text;
begin
  select race_row.*
  into imported_race
  from public.races as race_row
  where race_row.id = (select race_id from _organizer_import_fixture);

  select session_row.confirmed_formats -> 0 -> 'candidateKeys' ->> 0
  into stored_candidate_key
  from public.organizer_import_sessions as session_row
  where session_row.id = (select session_id from _organizer_import_fixture);

  if imported_race.id is null
    or imported_race.data_status <> 'draft'
    or imported_race.missing_required_fields <> array['distance_km', 'elevation_gain_m']::text[]
    or imported_race.distance_km <> 0
    or imported_race.elevation_gain_m <> 0
    or imported_race.race_date is null
    or imported_race.gpx_path not like 'organizer/%'
    or imported_race.gpx_storage_path is not null
    or imported_race.is_live
    or imported_race.racebook_is_live
    or stored_candidate_key is distinct from 'candidate-1' then
    raise exception 'Confirmed incomplete format must be a hidden draft with explicit sentinels.';
  end if;
end $$;

with inserted_invalid_session as (
  insert into public.organizer_import_sessions (event_id, edition_id, created_by, expires_at)
  select
    event_id,
    edition_id,
    '10000000-0000-0000-0000-000000000099',
    timezone('utc', now()) + interval '1 hour'
  from _organizer_import_fixture
  returning id
)
update _organizer_import_fixture
set invalid_session_id = inserted_invalid_session.id
from inserted_invalid_session;

do $$
begin
  perform public.confirm_organizer_import_formats(
    (select invalid_session_id from _organizer_import_fixture),
    '[{"formatKey":"invalid","mode":"create","name":"Invalid","unexpected":true}]'::jsonb
  );
  raise exception 'Expected unknown confirmation key to be rejected.';
exception
  when sqlstate '22023' then
    null;
end $$;

do $$
declare
  apply_result jsonb;
  imported_race public.races;
begin
  select public.apply_organizer_import_field_patches(
    (select session_id from _organizer_import_fixture),
    '{}'::jsonb,
    jsonb_build_array(
      jsonb_build_object(
        'raceId', (select race_id from _organizer_import_fixture),
        'fields', jsonb_build_object(
          'distanceKm', 42.3,
          'elevationGainM', 1250,
          'elevationLossM', 1230,
          'aidStations', jsonb_build_array(
            jsonb_build_object(
              'name', 'Ravito SQL 1',
              'distanceKm', 15.5,
              'waterRefill', true,
              'solidRefill', false
            ),
            jsonb_build_object(
              'name', 'Ravito SQL 2',
              'distanceKm', 31,
              'waterRefill', true,
              'assistanceAllowed', false
            )
          )
        ),
        'missingRequiredFields', '[]'::jsonb
      )
    )
  ) into apply_result;

  select race_row.*
  into imported_race
  from public.races as race_row
  where race_row.id = (select race_id from _organizer_import_fixture);

  if imported_race.data_status <> 'complete'
    or cardinality(imported_race.missing_required_fields) <> 0
    or imported_race.distance_km <> 42.3
    or imported_race.elevation_gain_m <> 1250
    or imported_race.is_live is not true
    or imported_race.is_public is not true
    or imported_race.racebook_is_live is not false then
    raise exception 'Completing an imported draft must restore catalog visibility only.';
  end if;

  if (apply_result ->> 'formatsUpdated')::integer <> 1
    or (apply_result ->> 'draftsRemaining')::integer <> 0
    or (apply_result ->> 'formatsCompleted')::integer <> 1 then
    raise exception 'Apply result counters are incorrect: %', apply_result;
  end if;

  if (
    select count(*)
    from public.race_aid_stations as station_row
    where station_row.race_id = imported_race.id
  ) <> 2 then
    raise exception 'Explicit aidStations patch must replace the station set atomically.';
  end if;
end $$;

do $$
begin
  update public.races
  set data_status = 'draft',
      missing_required_fields = array['distance_km']::text[],
      distance_km = 0,
      is_live = true
  where id = (select race_id from _organizer_import_fixture);

  raise exception 'Expected live draft constraint to reject the update.';
exception
  when check_violation then
    null;
end $$;

rollback;
