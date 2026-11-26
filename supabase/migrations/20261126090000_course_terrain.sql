-- Course terrain (lot 2): terrain classes along each race GPX, derived from OpenStreetMap
-- (Overpass) by the protected route POST /api/cron/course-terrain, plus organizer corrections.
-- Display-only: never read by pacing or nutrition (docs/03-business-rules/course-terrain.md).
--
-- * public.race_course_terrain: one row per race with a GPX, service role only (the public and
--   organizer routes read it with the service key and enforce visibility / organizer rights).
-- * Trigger on races: a new or replaced GPX queues the row again (`pending`, or `no_route` when the
--   GPX is removed) and keeps the organizer overrides.
-- * Backfill: every race that already has a GPX gets a `pending` row.
-- * next_due_race_course_terrain(): service-only pick of the next due row, runner-visible and
--   upcoming races first, drafts last.
-- * pg_cron + pg_net job `course-terrain` every 10 minutes (minute 3, 13, ...), through
--   configure_daily_web_cron (20261123220000, accepts any schedule): the Vault secrets `web_app_url`
--   and `cron_secret` are read at run time, never copied into cron.job.
--
-- Idempotent: re-running it changes nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create table if not exists public.race_course_terrain (
  race_id uuid primary key references public.races(id) on delete cascade,
  -- GPX the row is (or will be) computed for; kept in sync with races by the trigger below.
  gpx_storage_path text,
  gpx_sha256 text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed', 'no_route')),
  attempts integer not null default 0 check (attempts >= 0),
  -- When the cron may pick the row (also the lease while a tick processes it).
  next_attempt_at timestamptz not null default timezone('utc', now()),
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  -- COURSE_TERRAIN_RULES_VERSION used for osm_segments (a higher code version recomputes).
  rules_version integer check (rules_version is null or rules_version > 0),
  -- GPX cumulative distance the segments are expressed on.
  distance_km double precision check (distance_km is null or distance_km >= 0),
  osm_segments jsonb check (osm_segments is null or jsonb_typeof(osm_segments) = 'array'),
  coverage jsonb check (coverage is null or jsonb_typeof(coverage) = 'object'),
  computed_at timestamptz,
  -- Resumable work of an unfinished computation (per Overpass chunk), cleared when ready.
  progress jsonb check (progress is null or jsonb_typeof(progress) = 'object'),
  organizer_overrides jsonb not null default '[]'::jsonb check (jsonb_typeof(organizer_overrides) = 'array'),
  -- gpx_sha256 when the overrides were saved: a different current hash means "review the km".
  overrides_gpx_sha256 text,
  overrides_updated_at timestamptz,
  overrides_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists race_course_terrain_due_idx
  on public.race_course_terrain (next_attempt_at)
  where status in ('pending', 'processing', 'ready');
create index if not exists race_course_terrain_overrides_updated_by_idx
  on public.race_course_terrain (overrides_updated_by);

create or replace function public.set_race_course_terrain_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_race_course_terrain_updated_at() from public, anon, authenticated;

drop trigger if exists set_race_course_terrain_updated_at on public.race_course_terrain;
create trigger set_race_course_terrain_updated_at
before update on public.race_course_terrain
for each row execute function public.set_race_course_terrain_updated_at();

alter table public.race_course_terrain enable row level security;

-- Supabase default privileges give service_role everything (truncate included): reset it first.
revoke all on table public.race_course_terrain from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.race_course_terrain to service_role;

-- A new or replaced GPX queues the computation again. Organizer overrides are kept: the
-- organizer is told to review them because overrides_gpx_sha256 no longer matches.
create or replace function public.queue_race_course_terrain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.gpx_storage_path is not distinct from old.gpx_storage_path
    and new.gpx_sha256 is not distinct from old.gpx_sha256 then
    return new;
  end if;
  if tg_op = 'INSERT' and new.gpx_storage_path is null then
    return new;
  end if;

  insert into public.race_course_terrain as terrain (race_id, gpx_storage_path, gpx_sha256, status)
  values (
    new.id,
    new.gpx_storage_path,
    new.gpx_sha256,
    case when new.gpx_storage_path is null then 'no_route' else 'pending' end
  )
  on conflict (race_id) do update set
    gpx_storage_path = excluded.gpx_storage_path,
    gpx_sha256 = excluded.gpx_sha256,
    status = excluded.status,
    attempts = 0,
    next_attempt_at = timezone('utc', now()),
    last_error = null,
    rules_version = null,
    distance_km = null,
    osm_segments = null,
    coverage = null,
    computed_at = null,
    progress = null;
  return new;
end;
$$;

revoke all on function public.queue_race_course_terrain() from public, anon, authenticated;

drop trigger if exists queue_race_course_terrain on public.races;
create trigger queue_race_course_terrain
after insert or update of gpx_storage_path, gpx_sha256 on public.races
for each row execute function public.queue_race_course_terrain();

insert into public.race_course_terrain (race_id, gpx_storage_path, gpx_sha256, status)
select race.id, race.gpx_storage_path, race.gpx_sha256, 'pending'
from public.races as race
where race.gpx_storage_path is not null
on conflict (race_id) do nothing;

-- Next row the cron should work on (due: pending/processing, or ready with an older rules
-- version). Backlog order: non-draft before draft, runner-visible first (same rule as
-- apps/web/lib/race-runner-visibility.ts: public, event not offline, and live, or preview-visible
-- with a live event and a visible edition), then upcoming races by nearest race_date, then past
-- or undated races, then the oldest next_attempt_at.
create or replace function public.next_due_race_course_terrain(p_now timestamptz, p_rules_version integer)
returns setof public.race_course_terrain
language sql
stable
security invoker
set search_path = public
as $$
  select terrain.*
  from public.race_course_terrain as terrain
  join public.races as race on race.id = terrain.race_id
  left join public.race_events as event on event.id = race.event_id
  left join public.race_event_editions as edition on edition.id = race.edition_id
  where terrain.next_attempt_at <= p_now
    and (
      terrain.status in ('pending', 'processing')
      or (terrain.status = 'ready' and coalesce(terrain.rules_version, 0) < p_rules_version)
    )
  order by
    coalesce(race.data_status = 'draft', false) asc,
    (
      race.is_public is true
      and event.is_live is not false
      and (
        race.is_live is true
        or (
          race.racebook_preview_is_visible is true
          and event.is_live is true
          and (race.edition_id is null or edition.is_visible is true)
        )
      )
    ) desc,
    (race.race_date is not null and race.race_date >= (p_now at time zone 'utc')::date) desc,
    case when race.race_date >= (p_now at time zone 'utc')::date then race.race_date end asc nulls last,
    terrain.next_attempt_at asc
  limit 1;
$$;

revoke all on function public.next_due_race_course_terrain(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.next_due_race_course_terrain(timestamptz, integer) to service_role;

select public.configure_daily_web_cron('course-terrain', '3-59/10 * * * *', '/api/cron/course-terrain');
