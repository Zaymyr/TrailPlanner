-- Durable race slug redirect checks.
-- Run manually in a privileged Supabase SQL editor or psql session after migrations.
-- The script renames one existing public race and rolls back every change.

begin;

do $$
begin
  if not (
    select c.relrowsecurity
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'race_slug_redirects'
  ) then
    raise exception 'race_slug_redirects must have RLS enabled.';
  end if;

  if not has_table_privilege('anon', 'public.race_slug_redirects', 'SELECT')
    or not has_table_privilege('authenticated', 'public.race_slug_redirects', 'SELECT') then
    raise exception 'Client roles must be able to resolve visible public race redirects.';
  end if;

  if has_table_privilege('anon', 'public.race_slug_redirects', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.race_slug_redirects', 'INSERT,UPDATE,DELETE') then
    raise exception 'Client roles must not mutate race_slug_redirects.';
  end if;

  if not has_table_privilege('service_role', 'public.race_slug_redirects', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'service_role must manage race_slug_redirects.';
  end if;

  if has_function_privilege('anon', 'public.rename_race_slug(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.rename_race_slug(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.record_race_slug_redirect()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.record_race_slug_redirect()', 'EXECUTE') then
    raise exception 'Client roles must not execute race slug mutation functions.';
  end if;

  if not has_function_privilege('service_role', 'public.rename_race_slug(uuid,text)', 'EXECUTE') then
    raise exception 'service_role must execute rename_race_slug.';
  end if;

  if exists (
    select 1
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname in ('rename_race_slug', 'record_race_slug_redirect')
      and procedure_row.prosecdef
  ) then
    raise exception 'Race slug functions must remain SECURITY INVOKER.';
  end if;
end $$;

create temp table _race_slug_redirect_fixture (
  race_id uuid not null,
  original_slug text not null,
  first_slug text not null,
  second_slug text not null
) on commit drop;

insert into _race_slug_redirect_fixture (race_id, original_slug, first_slug, second_slug)
select
  race_row.id,
  race_row.slug,
  'slug-redirect-sql-check-' || substr(md5(clock_timestamp()::text || race_row.id::text), 1, 12),
  'slug-redirect-sql-check-' || substr(md5(clock_timestamp()::text || race_row.id::text), 13, 12)
from public.races as race_row
where race_row.is_live = true
  and race_row.is_public = true
  and (
    race_row.event_id is null
    or exists (
      select 1
      from public.race_events as event_row
      where event_row.id = race_row.event_id
        and event_row.is_live = true
    )
  )
order by race_row.created_at
limit 1;

grant select on _race_slug_redirect_fixture to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from _race_slug_redirect_fixture) then
    raise exception 'Race slug redirect checks require at least one visible public race.';
  end if;
end $$;

set local role service_role;

select public.rename_race_slug(
  (select race_id from _race_slug_redirect_fixture),
  (select first_slug from _race_slug_redirect_fixture)
);

select public.rename_race_slug(
  (select race_id from _race_slug_redirect_fixture),
  (select second_slug from _race_slug_redirect_fixture)
);

do $$
begin
  if (
    select count(*)
    from public.race_slug_redirects as redirect_row
    where redirect_row.race_id = (select race_id from _race_slug_redirect_fixture)
      and redirect_row.old_slug in (
        (select original_slug from _race_slug_redirect_fixture),
        (select first_slug from _race_slug_redirect_fixture)
      )
  ) <> 2 then
    raise exception 'Every former slug must remain mapped after chained renames.';
  end if;

  if (
    select race_row.slug
    from public.races as race_row
    where race_row.id = (select race_id from _race_slug_redirect_fixture)
  ) is distinct from (select second_slug from _race_slug_redirect_fixture) then
    raise exception 'rename_race_slug must update the canonical race slug.';
  end if;
end $$;

do $$
begin
  insert into public.races
  select (
    pg_catalog.jsonb_populate_record(
      null::public.races,
      pg_catalog.to_jsonb(source_race)
        || pg_catalog.jsonb_build_object(
          'id', gen_random_uuid(),
          'slug', (select original_slug from _race_slug_redirect_fixture)
        )
    )
  ).*
  from public.races as source_race
  where source_race.id = (select race_id from _race_slug_redirect_fixture);

  raise exception 'Expected INSERT reuse of a reserved old slug to fail.';
exception
  when unique_violation then
    if sqlerrm not like 'Race slug "%" is reserved by an existing redirect.' then
      raise;
    end if;
end $$;

set local role anon;

do $$
begin
  if (
    select count(*)
    from public.race_slug_redirects as redirect_row
    where redirect_row.old_slug in (
      (select original_slug from _race_slug_redirect_fixture),
      (select first_slug from _race_slug_redirect_fixture)
    )
  ) <> 2 then
    raise exception 'anon must resolve redirects for a visible public race.';
  end if;
end $$;

set local role service_role;

update public.races
set is_live = false
where id = (select race_id from _race_slug_redirect_fixture);

set local role anon;

do $$
begin
  if exists (
    select 1
    from public.race_slug_redirects as redirect_row
    where redirect_row.race_id = (select race_id from _race_slug_redirect_fixture)
  ) then
    raise exception 'Redirects for hidden races must not be visible to anon.';
  end if;
end $$;

set local role service_role;

do $$
begin
  perform public.rename_race_slug(
    (select race_id from _race_slug_redirect_fixture),
    (select original_slug from _race_slug_redirect_fixture)
  );
  raise exception 'Expected reuse of a reserved old slug to fail.';
exception
  when unique_violation then
    if sqlerrm not like 'Race slug "%" is reserved by an existing redirect.' then
      raise;
    end if;
end $$;

rollback;
