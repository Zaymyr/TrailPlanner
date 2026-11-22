-- Durable event hub slug checks (race_events.slug) and French region codes.
-- Run manually in a privileged Supabase SQL editor or psql session after migrations.
-- The script inserts temporary events and rolls back every change.

begin;

do $$
declare
  first_id uuid;
  second_id uuid;
  first_slug text;
  second_slug text;
begin
  if exists (select 1 from public.race_events where slug is null) then
    raise exception 'Every race event must have a slug.';
  end if;

  if exists (
    select 1
    from public.race_events as event_row
    join public.race_event_editions as edition_row on edition_row.slug = event_row.slug
  ) or exists (
    select 1
    from public.race_events as event_row
    join public.race_event_edition_slug_redirects as redirect_row on redirect_row.old_slug = event_row.slug
  ) then
    raise exception 'Event slugs must never equal an edition slug or a reserved edition redirect.';
  end if;

  if exists (
    select 1 from public.race_events
    where location_country_code = 'FR'
      and location_region is not null
      and location_region_code is null
  ) then
    raise exception 'French events with a normalized region must carry its INSEE code.';
  end if;

  if has_function_privilege('anon', 'public.assign_race_event_slug()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.assign_race_event_slug()', 'EXECUTE')
    or has_function_privilege('anon', 'public.build_race_event_slug(text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.build_race_event_slug(text)', 'EXECUTE') then
    raise exception 'Client roles must not execute event slug functions.';
  end if;

  -- Generation: year stripped, accents folded, collision suffixed with the id.
  insert into public.race_events (name, is_live)
  values ('Trâil des Contrôles Slug 2031', false)
  returning id, slug into first_id, first_slug;
  if first_slug <> 'trail-des-controles-slug' then
    raise exception 'Unexpected generated event slug: %', first_slug;
  end if;

  insert into public.race_events (name, is_live)
  values ('Trail des Contrôles Slug', false)
  returning id, slug into second_id, second_slug;
  if second_slug <> 'trail-des-controles-slug-' || left(replace(second_id::text, '-', ''), 8) then
    raise exception 'A duplicate event slug must receive the id suffix, got %', second_slug;
  end if;

  -- Durability: a slug never changes once assigned.
  begin
    update public.race_events set slug = 'trail-des-controles-renomme' where id = first_id;
    raise exception 'Updating an event slug must fail.';
  exception when sqlstate '22023' then
    null;
  end;

  -- Disjoint namespaces: an edition cannot take an event hub slug.
  begin
    insert into public.race_event_editions (event_id, edition_year, start_date, end_date, slug)
    values (first_id, 2031, date '2031-06-01', date '2031-06-01', first_slug);
    raise exception 'An edition slug equal to an event slug must fail.';
  exception when sqlstate '23505' then
    null;
  end;
end;
$$;

rollback;
