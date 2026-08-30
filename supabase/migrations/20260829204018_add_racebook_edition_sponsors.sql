create table public.race_event_edition_sponsors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  name text not null,
  logo_url text not null,
  website_url text,
  is_active boolean not null default true,
  show_on_loading boolean not null default false,
  show_in_banner boolean not null default true,
  position smallint not null default 0,
  click_count bigint not null default 0,
  constraint race_event_edition_sponsors_name_check
    check (char_length(btrim(name)) between 1 and 80),
  constraint race_event_edition_sponsors_logo_url_check
    check (logo_url ~* '^https?://'),
  constraint race_event_edition_sponsors_website_url_check
    check (website_url is null or website_url ~* '^https?://'),
  constraint race_event_edition_sponsors_active_placement_check
    check (not is_active or show_on_loading or show_in_banner),
  constraint race_event_edition_sponsors_position_check
    check (position between 0 and 9),
  constraint race_event_edition_sponsors_click_count_check
    check (click_count >= 0)
);

create index race_event_edition_sponsors_edition_position_idx
  on public.race_event_edition_sponsors(edition_id, position, created_at);

create or replace function public.set_race_event_edition_sponsors_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_race_event_edition_sponsors_updated_at
before update on public.race_event_edition_sponsors
for each row execute function public.set_race_event_edition_sponsors_updated_at();

create or replace function public.enforce_racebook_sponsor_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.edition_id::text, 0));

  if (
    select count(*)
    from public.race_event_edition_sponsors sponsor
    where sponsor.edition_id = new.edition_id
      and sponsor.id <> new.id
  ) >= 10 then
    raise exception 'An edition can have at most 10 sponsors.' using errcode = '23514';
  end if;

  if new.is_active and new.show_on_loading and (
    select count(*)
    from public.race_event_edition_sponsors sponsor
    where sponsor.edition_id = new.edition_id
      and sponsor.id <> new.id
      and sponsor.is_active
      and sponsor.show_on_loading
  ) >= 2 then
    raise exception 'Only two active sponsors can appear on the loading screen.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_racebook_sponsor_limits
before insert or update on public.race_event_edition_sponsors
for each row execute function public.enforce_racebook_sponsor_limits();

create or replace function public.increment_racebook_sponsor_click(
  p_sponsor_id uuid,
  p_race_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_url text;
begin
  update public.race_event_edition_sponsors sponsor
  set click_count = sponsor.click_count + 1
  from public.races race
  where sponsor.id = p_sponsor_id
    and race.id = p_race_id
    and race.edition_id = sponsor.edition_id
    and sponsor.is_active
    and sponsor.website_url is not null
  returning sponsor.website_url into target_url;

  if target_url is null then
    raise exception 'Sponsor link not found.';
  end if;

  return target_url;
end;
$$;

alter table public.race_event_edition_sponsors enable row level security;

revoke all on table public.race_event_edition_sponsors from public, anon, authenticated;
grant select, insert, update, delete on table public.race_event_edition_sponsors to service_role;

revoke all on function public.set_race_event_edition_sponsors_updated_at() from public, anon, authenticated;
grant execute on function public.set_race_event_edition_sponsors_updated_at() to service_role;
revoke all on function public.enforce_racebook_sponsor_limits() from public, anon, authenticated;
grant execute on function public.enforce_racebook_sponsor_limits() to service_role;
revoke all on function public.increment_racebook_sponsor_click(uuid, uuid) from public, anon, authenticated;
grant execute on function public.increment_racebook_sponsor_click(uuid, uuid) to service_role;

comment on table public.race_event_edition_sponsors is
  'Edition-scoped sponsor presentation for the mobile Racebook. Reads and writes are mediated by service routes.';
comment on column public.race_event_edition_sponsors.click_count is
  'Aggregate redirect count only; no runner identity or impression history is stored.';
comment on function public.increment_racebook_sponsor_click(uuid, uuid) is
  'Atomically increments an active sponsor click after verifying that the requested race belongs to the same edition.';
