-- Independent web/mobile race visibility checks.
-- Run manually in a privileged Supabase SQL editor or psql session after migrations.
-- Every data mutation is rolled back.

begin;

do $$
declare
  column_default text;
begin
  select columns.column_default
  into column_default
  from information_schema.columns
  where columns.table_schema = 'public'
    and columns.table_name = 'races'
    and columns.column_name = 'web_catalog_is_live';

  if column_default is distinct from 'false' then
    raise exception 'races.web_catalog_is_live must exist with a false default.';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'sync_race_web_catalog_visibility'
      and procedure_row.prosecdef
  ) then
    raise exception 'sync_race_web_catalog_visibility must remain SECURITY INVOKER.';
  end if;

  if has_function_privilege('anon', 'public.sync_race_web_catalog_visibility()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.sync_race_web_catalog_visibility()', 'EXECUTE') then
    raise exception 'Client roles must not execute the web visibility trigger function.';
  end if;
end $$;

create temp table _web_race_visibility_fixture (
  race_id uuid not null
) on commit drop;

insert into _web_race_visibility_fixture (race_id)
select race_row.id
from public.races race_row
where race_row.is_public = true
  and race_row.web_catalog_is_live = true
  and (
    race_row.event_id is null
    or exists (
      select 1
      from public.race_events event_row
      where event_row.id = race_row.event_id
        and event_row.is_live = true
    )
  )
  and (
    race_row.edition_id is null
    or exists (
      select 1
      from public.race_event_editions edition_row
      where edition_row.id = race_row.edition_id
        and edition_row.event_id = race_row.event_id
        and edition_row.is_visible = true
    )
  )
order by race_row.created_at
limit 1;

grant select on _web_race_visibility_fixture to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from _web_race_visibility_fixture) then
    raise exception 'Web visibility checks require at least one web-public race.';
  end if;
end $$;

set local role service_role;

update public.races
set is_live = false,
    racebook_preview_is_visible = false,
    racebook_is_live = false
where id = (select race_id from _web_race_visibility_fixture);

do $$
begin
  if not (
    select race_row.web_catalog_is_live
    from public.races race_row
    where race_row.id = (select race_id from _web_race_visibility_fixture)
  ) then
    raise exception 'Hiding a course from mobile must preserve web visibility.';
  end if;

  if exists (
    select 1
    from public.races race_row
    where race_row.id = (select race_id from _web_race_visibility_fixture)
      and race_row.is_live = true
  ) then
    raise exception 'The mobile is_live filter must exclude the web-only course.';
  end if;
end $$;

set local role anon;

do $$
begin
  if exists (
    select 1
    from public.races race_row
    where race_row.id = (select race_id from _web_race_visibility_fixture)
  ) then
    raise exception 'A masked web-only course must remain unavailable through direct client RLS.';
  end if;
end $$;

set local role service_role;

update public.races
set is_public = false
where id = (select race_id from _web_race_visibility_fixture);

do $$
begin
  if (
    select race_row.web_catalog_is_live
    from public.races race_row
    where race_row.id = (select race_id from _web_race_visibility_fixture)
  ) then
    raise exception 'A non-public course must not remain web-public.';
  end if;
end $$;

update public.races
set is_public = true,
    is_live = true,
    racebook_preview_is_visible = true,
    racebook_is_live = true
where id = (select race_id from _web_race_visibility_fixture);

update public.races
set is_live = false
where id = (select race_id from _web_race_visibility_fixture);

do $$
begin
  if not (
    select race_row.web_catalog_is_live
    from public.races race_row
    where race_row.id = (select race_id from _web_race_visibility_fixture)
  ) then
    raise exception 'Republishing to mobile must promote and preserve web visibility.';
  end if;
end $$;

rollback;
