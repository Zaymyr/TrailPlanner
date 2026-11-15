-- Durable event-edition slug and redirect checks.
-- Run manually in a privileged Supabase SQL editor or psql session after migrations.
-- The script renames one existing edition and rolls back every change.

begin;

do $$
begin
  if not (
    select c.relrowsecurity
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'race_event_edition_slug_redirects'
  ) then
    raise exception 'race_event_edition_slug_redirects must have RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.race_event_edition_slug_redirects', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.race_event_edition_slug_redirects', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Client roles must not access event-edition slug redirects directly.';
  end if;

  if not has_table_privilege('service_role', 'public.race_event_edition_slug_redirects', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'service_role must manage event-edition slug redirects.';
  end if;

  if has_function_privilege('anon', 'public.rename_race_event_edition_slug(uuid,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.rename_race_event_edition_slug(uuid,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.record_race_event_edition_slug_redirect()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.record_race_event_edition_slug_redirect()', 'EXECUTE') then
    raise exception 'Client roles must not execute event-edition slug functions.';
  end if;

  if not has_function_privilege('service_role', 'public.rename_race_event_edition_slug(uuid,text)', 'EXECUTE') then
    raise exception 'service_role must execute rename_race_event_edition_slug.';
  end if;

  if exists (
    select 1
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname in (
        'build_race_event_edition_slug',
        'record_race_event_edition_slug_redirect',
        'rename_race_event_edition_slug'
      )
      and procedure_row.prosecdef
  ) then
    raise exception 'Event-edition slug functions must remain SECURITY INVOKER.';
  end if;

  if exists (
    select 1
    from public.race_event_editions
    where slug is null
      or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or char_length(slug) > 160
  ) then
    raise exception 'Every edition must have one valid durable slug.';
  end if;
end $$;

create temp table _edition_slug_redirect_fixture (
  edition_id uuid not null,
  original_slug text not null,
  first_slug text not null,
  second_slug text not null
) on commit drop;

insert into _edition_slug_redirect_fixture (edition_id, original_slug, first_slug, second_slug)
select
  edition_row.id,
  edition_row.slug,
  'edition-slug-check-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.clock_timestamp()::text || edition_row.id::text), 1, 12),
  'edition-slug-check-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.clock_timestamp()::text || edition_row.id::text), 13, 12)
from public.race_event_editions as edition_row
order by edition_row.created_at
limit 1;

grant select on _edition_slug_redirect_fixture to service_role;

do $$
begin
  if not exists (select 1 from _edition_slug_redirect_fixture) then
    raise exception 'Event-edition slug checks require at least one edition.';
  end if;
end $$;

set local role service_role;

select public.rename_race_event_edition_slug(
  (select edition_id from _edition_slug_redirect_fixture),
  (select first_slug from _edition_slug_redirect_fixture)
);

select public.rename_race_event_edition_slug(
  (select edition_id from _edition_slug_redirect_fixture),
  (select second_slug from _edition_slug_redirect_fixture)
);

do $$
begin
  if (
    select count(*)
    from public.race_event_edition_slug_redirects as redirect_row
    where redirect_row.edition_id = (select edition_id from _edition_slug_redirect_fixture)
      and redirect_row.old_slug in (
        (select original_slug from _edition_slug_redirect_fixture),
        (select first_slug from _edition_slug_redirect_fixture)
      )
  ) <> 2 then
    raise exception 'Every former edition slug must remain mapped after chained renames.';
  end if;

  if (
    select edition_row.slug
    from public.race_event_editions as edition_row
    where edition_row.id = (select edition_id from _edition_slug_redirect_fixture)
  ) is distinct from (select second_slug from _edition_slug_redirect_fixture) then
    raise exception 'rename_race_event_edition_slug must update the canonical slug.';
  end if;
end $$;

do $$
begin
  perform public.rename_race_event_edition_slug(
    (select edition_id from _edition_slug_redirect_fixture),
    (select original_slug from _edition_slug_redirect_fixture)
  );
  raise exception 'Expected reuse of a reserved old edition slug to fail.';
exception
  when unique_violation then
    if sqlerrm not like 'Event edition slug "%" is reserved by an existing redirect.' then
      raise;
    end if;
end $$;

rollback;
