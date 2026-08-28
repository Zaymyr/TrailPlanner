create table if not exists public.race_slug_redirects (
  old_slug text primary key,
  race_id uuid not null references public.races(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint race_slug_redirects_old_slug_format_check check (
    old_slug = lower(btrim(old_slug))
    and char_length(old_slug) between 1 and 160
    and old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
);

comment on table public.race_slug_redirects is
  'Durable mappings from former public course slugs to the current race row.';

comment on column public.race_slug_redirects.old_slug is
  'Former canonical slug. A slug in this table is reserved and cannot become canonical again.';

create index if not exists race_slug_redirects_race_id_idx
  on public.race_slug_redirects(race_id);

alter table public.race_slug_redirects enable row level security;

drop policy if exists "Public race slug redirects are viewable" on public.race_slug_redirects;
create policy "Public race slug redirects are viewable"
on public.race_slug_redirects
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.races as race_row
    where race_row.id = race_slug_redirects.race_id
      and race_row.is_live = true
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
  )
);

revoke all on table public.race_slug_redirects from public, anon, authenticated;
grant select on table public.race_slug_redirects to anon, authenticated;
grant select, insert, update, delete on table public.race_slug_redirects to service_role;

create or replace function public.record_race_slug_redirect()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate_slug text;
begin
  if new.slug is null
    or new.slug <> lower(btrim(new.slug))
    or char_length(new.slug) > 160
    or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using
      errcode = '22023',
      message = 'New race slug must contain only lowercase letters, digits, and single hyphen separators (160 characters maximum).';
  end if;

  if tg_op = 'UPDATE' then
    if new.slug is not distinct from old.slug then
      return new;
    end if;

    -- Serialize reservations for both names so concurrent inserts and renames
    -- cannot pass the redirect check between the check and the row write.
    for candidate_slug in
      select distinct slug_value
      from unnest(array[old.slug, new.slug]) as slug_values(slug_value)
      order by slug_value
    loop
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(candidate_slug, 731104)
      );
    end loop;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.slug, 731104));
  end if;

  if exists (
    select 1
    from public.race_slug_redirects as redirect_row
    where redirect_row.old_slug = new.slug
  ) then
    raise exception using
      errcode = '23505',
      message = format('Race slug "%s" is reserved by an existing redirect.', new.slug);
  end if;

  if tg_op = 'UPDATE' then
    insert into public.race_slug_redirects (old_slug, race_id)
    values (old.slug, old.id);
  end if;

  return new;
end;
$$;

comment on function public.record_race_slug_redirect() is
  'Invoker trigger: reserves the former slug in the same transaction as a races.slug update.';

drop trigger if exists record_race_slug_redirect on public.races;
create trigger record_race_slug_redirect
before insert or update of slug on public.races
for each row
execute function public.record_race_slug_redirect();

revoke all on function public.record_race_slug_redirect() from public, anon, authenticated;

create or replace function public.rename_race_slug(
  p_race_id uuid,
  p_new_slug text
)
returns table (
  race_id uuid,
  old_slug text,
  new_slug text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_race public.races;
  normalized_slug text := lower(btrim(p_new_slug));
begin
  if p_new_slug is null
    or normalized_slug = ''
    or char_length(normalized_slug) > 160
    or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using
      errcode = '22023',
      message = 'New race slug must contain only lowercase letters, digits, and single hyphen separators (160 characters maximum).';
  end if;

  select race_row.*
  into locked_race
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if locked_race.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Race not found.';
  end if;

  if locked_race.slug = normalized_slug then
    return query select locked_race.id, locked_race.slug, locked_race.slug;
    return;
  end if;

  if exists (
    select 1
    from public.race_slug_redirects as redirect_row
    where redirect_row.old_slug = normalized_slug
  ) then
    raise exception using
      errcode = '23505',
      message = format('Race slug "%s" is reserved by an existing redirect.', normalized_slug);
  end if;

  update public.races
  set slug = normalized_slug
  where id = locked_race.id;

  return query select locked_race.id, locked_race.slug, normalized_slug;
end;
$$;

comment on function public.rename_race_slug(uuid, text) is
  'Atomically renames a race and records its former slug. Service-role invocation only.';

revoke all on function public.rename_race_slug(uuid, text) from public, anon, authenticated;
grant execute on function public.rename_race_slug(uuid, text) to service_role;
