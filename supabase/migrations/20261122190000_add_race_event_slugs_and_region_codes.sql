-- Permanent event hubs (/courses/evenements/<event-slug>) and French region
-- landing pages (/courses/regions/<region>).
--
-- 1. race_events.slug: durable, year-free public identity of an event. It
--    shares the /courses/evenements/ URL namespace with edition slugs, so an
--    event slug may never equal an edition slug or a reserved edition redirect,
--    and an edition slug may never equal an event slug.
-- 2. location_region_code backfill for French events whose normalized region
--    name is set but whose INSEE region code is missing. The code is derived
--    only from the exact normalized region name, never from display labels.

alter table public.race_events
  add column slug text;

create or replace function public.build_race_event_slug(p_event_name text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  with normalized as (
    select pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.translate(
          pg_catalog.lower(
            pg_catalog.replace(
              pg_catalog.replace(
                -- A trailing edition year is not part of the permanent identity.
                pg_catalog.regexp_replace(p_event_name, '[[:space:]]+(19|20)[0-9]{2}[[:space:]]*$', ''),
                'œ',
                'oe'
              ),
              'æ',
              'ae'
            )
          ),
          'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ',
          'aaaaaaceeeeiiiinooooouuuuyy'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-'
    ) as event_part
  )
  select pg_catalog.btrim(
      pg_catalog.left(case when event_part = '' then 'evenement' else event_part end, 150),
      '-'
    )
  from normalized;
$$;

comment on function public.build_race_event_slug(text) is
  'Builds the initial lowercase ASCII year-free slug of an event. Existing slugs remain durable when event names change.';

revoke all on function public.build_race_event_slug(text) from public, anon, authenticated;
grant execute on function public.build_race_event_slug(text) to service_role;

-- Deterministic backfill: base slug, then an id suffix for duplicates or for a
-- base slug already used by an edition slug or edition redirect.
with generated as (
  select event_row.id, public.build_race_event_slug(event_row.name) as base_slug
  from public.race_events as event_row
), ranked as (
  select
    generated.id,
    generated.base_slug,
    pg_catalog.count(*) over (partition by generated.base_slug) as duplicate_count,
    exists (
      select 1 from public.race_event_editions as edition_row where edition_row.slug = generated.base_slug
      union all
      select 1 from public.race_event_edition_slug_redirects as redirect_row where redirect_row.old_slug = generated.base_slug
    ) as taken_by_edition
  from generated
)
update public.race_events as event_row
set slug = case
  when ranked.duplicate_count = 1 and not ranked.taken_by_edition then ranked.base_slug
  else ranked.base_slug || '-' || pg_catalog.left(pg_catalog.replace(event_row.id::text, '-', ''), 8)
end
from ranked
where ranked.id = event_row.id;

alter table public.race_events
  alter column slug set not null,
  add constraint race_events_slug_format_check check (
    slug = pg_catalog.lower(pg_catalog.btrim(slug))
    and pg_catalog.char_length(slug) between 1 and 160
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  add constraint race_events_slug_key unique (slug);

comment on column public.race_events.slug is
  'Durable year-free public slug of the event hub /courses/evenements/<slug>. Generated on insert, immutable afterwards, never equal to an edition slug.';

create or replace function public.assign_race_event_slug()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate_slug text;
begin
  if tg_op = 'UPDATE' then
    if new.slug is distinct from old.slug then
      raise exception using
        errcode = '22023',
        message = 'Race event slugs are durable and cannot be changed.';
    end if;
    return new;
  end if;

  candidate_slug := coalesce(new.slug, public.build_race_event_slug(new.name));
  -- Same lock namespace as edition slugs: both share one public URL namespace.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate_slug, 204771));

  if exists (
    select 1 from public.race_events as event_row where event_row.slug = candidate_slug
    union all
    select 1 from public.race_event_editions as edition_row where edition_row.slug = candidate_slug
    union all
    select 1 from public.race_event_edition_slug_redirects as redirect_row where redirect_row.old_slug = candidate_slug
  ) then
    if new.slug is not null then
      raise exception using
        errcode = '23505',
        message = pg_catalog.format('Public event slug "%s" is already used.', candidate_slug);
    end if;
    candidate_slug := candidate_slug || '-' || pg_catalog.left(pg_catalog.replace(new.id::text, '-', ''), 8);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate_slug, 204771));
  end if;

  new.slug := candidate_slug;
  return new;
end;
$$;

comment on function public.assign_race_event_slug() is
  'Invoker trigger: generates the durable event slug on insert and rejects later slug changes.';

create trigger assign_race_event_slug
before insert or update of slug on public.race_events
for each row
execute function public.assign_race_event_slug();

revoke all on function public.assign_race_event_slug() from public, anon, authenticated;
grant execute on function public.assign_race_event_slug() to service_role;

-- Edition slugs: same function as 20261113200326, plus the event-slug check so
-- that both namespaces stay disjoint.
create or replace function public.record_race_event_edition_slug_redirect()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate_slug text;
  event_name text;
begin
  if new.slug is null then
    select event_row.name
    into event_name
    from public.race_events as event_row
    where event_row.id = new.event_id;

    if event_name is null then
      raise exception using
        errcode = '23503',
        message = 'Race event not found for edition slug generation.';
    end if;

    candidate_slug := public.build_race_event_edition_slug(event_name, new.edition_year);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate_slug, 204771));

    if exists (
      select 1 from public.race_event_editions as edition_row where edition_row.slug = candidate_slug
      union all
      select 1 from public.race_event_edition_slug_redirects as redirect_row where redirect_row.old_slug = candidate_slug
      union all
      select 1 from public.race_events as event_row where event_row.slug = candidate_slug
    ) then
      candidate_slug := candidate_slug || '-' || pg_catalog.left(pg_catalog.replace(new.id::text, '-', ''), 8);
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate_slug, 204771));
    end if;

    new.slug := candidate_slug;
  end if;

  if new.slug <> pg_catalog.lower(pg_catalog.btrim(new.slug))
    or pg_catalog.char_length(new.slug) > 160
    or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using
      errcode = '22023',
      message = 'Event edition slug must contain only lowercase letters, digits, and single hyphen separators (160 characters maximum).';
  end if;

  if tg_op = 'UPDATE' then
    if new.slug is not distinct from old.slug then
      return new;
    end if;

    for candidate_slug in
      select distinct slug_value
      from pg_catalog.unnest(array[old.slug, new.slug]) as slug_values(slug_value)
      order by slug_value
    loop
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(candidate_slug, 204771));
    end loop;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.slug, 204771));
  end if;

  if exists (
    select 1
    from public.race_event_edition_slug_redirects as redirect_row
    where redirect_row.old_slug = new.slug
  ) then
    raise exception using
      errcode = '23505',
      message = pg_catalog.format('Event edition slug "%s" is reserved by an existing redirect.', new.slug);
  end if;

  if exists (
    select 1
    from public.race_events as event_row
    where event_row.slug = new.slug
  ) then
    raise exception using
      errcode = '23505',
      message = pg_catalog.format('Event edition slug "%s" is used by an event hub.', new.slug);
  end if;

  if tg_op = 'UPDATE' then
    insert into public.race_event_edition_slug_redirects (old_slug, edition_id)
    values (old.slug, old.id);
  end if;

  return new;
end;
$$;

comment on function public.record_race_event_edition_slug_redirect() is
  'Invoker trigger: creates initial edition slugs, keeps them disjoint from event slugs, and reserves former values during a rename.';

revoke all on function public.record_race_event_edition_slug_redirect() from public, anon, authenticated;
grant execute on function public.record_race_event_edition_slug_redirect() to service_role;

-- French INSEE region codes from the exact normalized region name.
with region_codes(region_name, region_code) as (
  values
    ('Guadeloupe', '01'),
    ('Martinique', '02'),
    ('Guyane', '03'),
    ('La Réunion', '04'),
    ('Mayotte', '06'),
    ('Île-de-France', '11'),
    ('Centre-Val de Loire', '24'),
    ('Bourgogne-Franche-Comté', '27'),
    ('Normandie', '28'),
    ('Hauts-de-France', '32'),
    ('Grand Est', '44'),
    ('Pays de la Loire', '52'),
    ('Bretagne', '53'),
    ('Nouvelle-Aquitaine', '75'),
    ('Occitanie', '76'),
    ('Auvergne-Rhône-Alpes', '84'),
    ('Provence-Alpes-Côte d''Azur', '93'),
    ('Corse', '94')
)
update public.race_events as event_row
set location_region_code = region_codes.region_code
from region_codes
where event_row.location_country_code = 'FR'
  and event_row.location_region_code is null
  and pg_catalog.replace(pg_catalog.btrim(event_row.location_region), '’', '''') = region_codes.region_name;

notify pgrst, 'reload schema';
