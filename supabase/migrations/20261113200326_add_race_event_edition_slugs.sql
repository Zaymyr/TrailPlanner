alter table public.race_event_editions
  add column slug text;

create or replace function public.build_race_event_edition_slug(
  p_event_name text,
  p_edition_year smallint
)
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
              pg_catalog.replace(p_event_name, 'œ', 'oe'),
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
      pg_catalog.left(
        case when event_part = '' then 'evenement' else event_part end,
        146
      ),
      '-'
    ) || '-' || p_edition_year::text
  from normalized;
$$;

comment on function public.build_race_event_edition_slug(text, smallint) is
  'Builds the initial lowercase ASCII slug for one event edition. Existing slugs remain durable when event names change.';

revoke all on function public.build_race_event_edition_slug(text, smallint) from public, anon, authenticated;
grant execute on function public.build_race_event_edition_slug(text, smallint) to service_role;

with generated as (
  select
    edition_row.id,
    public.build_race_event_edition_slug(event_row.name, edition_row.edition_year) as base_slug
  from public.race_event_editions as edition_row
  join public.race_events as event_row on event_row.id = edition_row.event_id
), ranked as (
  select
    generated.id,
    generated.base_slug,
    pg_catalog.count(*) over (partition by generated.base_slug) as duplicate_count
  from generated
)
update public.race_event_editions as edition_row
set slug = case
  when ranked.duplicate_count = 1 then ranked.base_slug
  else ranked.base_slug || '-' || pg_catalog.left(pg_catalog.replace(edition_row.id::text, '-', ''), 8)
end
from ranked
where ranked.id = edition_row.id;

alter table public.race_event_editions
  alter column slug set not null,
  add constraint race_event_editions_slug_format_check check (
    slug = pg_catalog.lower(pg_catalog.btrim(slug))
    and pg_catalog.char_length(slug) between 1 and 160
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  add constraint race_event_editions_slug_key unique (slug);

comment on column public.race_event_editions.slug is
  'Durable canonical public slug for this exact yearly event edition.';

create table public.race_event_edition_slug_redirects (
  old_slug text primary key,
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint race_event_edition_slug_redirects_old_slug_format_check check (
    old_slug = pg_catalog.lower(pg_catalog.btrim(old_slug))
    and pg_catalog.char_length(old_slug) between 1 and 160
    and old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
);

comment on table public.race_event_edition_slug_redirects is
  'Service-only durable mappings from former event-edition slugs to the canonical edition row.';

comment on column public.race_event_edition_slug_redirects.old_slug is
  'Former canonical edition slug. Redirected slugs remain reserved and cannot become canonical again.';

create index race_event_edition_slug_redirects_edition_id_idx
  on public.race_event_edition_slug_redirects(edition_id);

alter table public.race_event_edition_slug_redirects enable row level security;

revoke all on table public.race_event_edition_slug_redirects from public, anon, authenticated;
grant select, insert, update, delete on table public.race_event_edition_slug_redirects to service_role;

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

  if tg_op = 'UPDATE' then
    insert into public.race_event_edition_slug_redirects (old_slug, edition_id)
    values (old.slug, old.id);
  end if;

  return new;
end;
$$;

comment on function public.record_race_event_edition_slug_redirect() is
  'Invoker trigger: creates initial edition slugs and reserves former values during a rename.';

create trigger record_race_event_edition_slug_redirect
before insert or update of slug on public.race_event_editions
for each row
execute function public.record_race_event_edition_slug_redirect();

revoke all on function public.record_race_event_edition_slug_redirect() from public, anon, authenticated;
grant execute on function public.record_race_event_edition_slug_redirect() to service_role;

create or replace function public.rename_race_event_edition_slug(
  p_edition_id uuid,
  p_new_slug text
)
returns table (
  edition_id uuid,
  old_slug text,
  new_slug text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_edition public.race_event_editions;
  normalized_slug text := pg_catalog.lower(pg_catalog.btrim(p_new_slug));
begin
  if p_new_slug is null
    or normalized_slug = ''
    or pg_catalog.char_length(normalized_slug) > 160
    or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using
      errcode = '22023',
      message = 'Event edition slug must contain only lowercase letters, digits, and single hyphen separators (160 characters maximum).';
  end if;

  select edition_row.*
  into locked_edition
  from public.race_event_editions as edition_row
  where edition_row.id = p_edition_id
  for update;

  if locked_edition.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Race event edition not found.';
  end if;

  if locked_edition.slug = normalized_slug then
    return query select locked_edition.id, locked_edition.slug, locked_edition.slug;
    return;
  end if;

  update public.race_event_editions
  set slug = normalized_slug
  where id = locked_edition.id;

  return query select locked_edition.id, locked_edition.slug, normalized_slug;
end;
$$;

comment on function public.rename_race_event_edition_slug(uuid, text) is
  'Atomically renames an event edition and records its former slug. Service-role invocation only.';

revoke all on function public.rename_race_event_edition_slug(uuid, text) from public, anon, authenticated;
grant execute on function public.rename_race_event_edition_slug(uuid, text) to service_role;

notify pgrst, 'reload schema';
