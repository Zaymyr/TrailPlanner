create table public.race_edition_services (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.race_event_editions(id) on delete cascade,
  service_type text not null check (service_type in ('restaurant', 'accommodation', 'recovery', 'other')),
  name text not null check (btrim(name) <> ''),
  description text,
  address text,
  latitude numeric,
  longitude numeric,
  google_maps_url text,
  website_url text,
  phone text,
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_edition_services_address_check check (
    service_type not in ('restaurant', 'accommodation') or nullif(btrim(address), '') is not null
  ),
  constraint race_edition_services_geocode_check check (
    service_type not in ('restaurant', 'accommodation') or (latitude is not null and longitude is not null)
  ),
  constraint race_edition_services_coordinates_check check (
    (latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create table public.race_start_waves (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  start_time time not null,
  eligibility_type text not null default 'all' check (eligibility_type in ('all', 'bib_range', 'estimated_finish_time', 'pace', 'custom')),
  bib_number_min integer,
  bib_number_max integer,
  finish_minutes_min integer,
  finish_minutes_max integer,
  pace_seconds_min integer,
  pace_seconds_max integer,
  eligibility_note text,
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_start_waves_eligibility_check check (
    (eligibility_type = 'all' and bib_number_min is null and bib_number_max is null and finish_minutes_min is null and finish_minutes_max is null and pace_seconds_min is null and pace_seconds_max is null and eligibility_note is null)
    or (eligibility_type = 'bib_range' and bib_number_min >= 0 and bib_number_max >= bib_number_min and finish_minutes_min is null and finish_minutes_max is null and pace_seconds_min is null and pace_seconds_max is null and eligibility_note is null)
    or (eligibility_type = 'estimated_finish_time' and finish_minutes_min >= 0 and finish_minutes_max >= finish_minutes_min and bib_number_min is null and bib_number_max is null and pace_seconds_min is null and pace_seconds_max is null and eligibility_note is null)
    or (eligibility_type = 'pace' and pace_seconds_min > 0 and pace_seconds_max >= pace_seconds_min and bib_number_min is null and bib_number_max is null and finish_minutes_min is null and finish_minutes_max is null and eligibility_note is null)
    or (eligibility_type = 'custom' and nullif(btrim(eligibility_note), '') is not null and bib_number_min is null and bib_number_max is null and finish_minutes_min is null and finish_minutes_max is null and pace_seconds_min is null and pace_seconds_max is null)
  )
);

create table public.race_awards (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  category_key text not null check (category_key in ('scratch', 'u18', 'u20', 'u23', 'senior', 'master', 'custom')),
  category_label text not null check (btrim(category_label) <> ''),
  audience text not null check (audience in ('women', 'men', 'mixed')),
  place_from integer not null default 1 check (place_from > 0),
  place_to integer not null check (place_to >= place_from),
  podium_time time not null,
  podium_location text,
  reward_note text,
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index race_edition_services_edition_order_idx on public.race_edition_services(edition_id, service_type, order_index);
create index race_start_waves_race_order_idx on public.race_start_waves(race_id, order_index);
create index race_awards_race_order_idx on public.race_awards(race_id, podium_time, order_index);

alter table public.race_edition_services enable row level security;
alter table public.race_start_waves enable row level security;
alter table public.race_awards enable row level security;

revoke all on public.race_edition_services, public.race_start_waves, public.race_awards from public, anon, authenticated;
grant select on public.race_edition_services, public.race_start_waves, public.race_awards to anon, authenticated;
grant select, insert, update, delete on public.race_edition_services, public.race_start_waves, public.race_awards to service_role;

create policy "Published edition services are viewable" on public.race_edition_services for select to anon, authenticated
using (exists (
  select 1 from public.races r join public.race_event_editions e on e.id = r.edition_id
  where e.id = race_edition_services.edition_id and e.is_visible = true and r.is_public = true and r.is_live = true and r.racebook_is_live = true
));
create policy "Managed edition services are viewable" on public.race_edition_services for select to authenticated
using (exists (
  select 1 from public.race_event_editions e join public.race_event_organizers o on o.event_id = e.event_id
  where e.id = race_edition_services.edition_id and o.user_id = (select auth.uid()) and o.revoked_at is null
) or exists (select 1 from public.race_event_editions e join public.races r on r.edition_id = e.id where e.id = race_edition_services.edition_id and r.created_by = (select auth.uid())) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Published start waves are viewable" on public.race_start_waves for select to anon, authenticated
using (exists (select 1 from public.races r join public.race_event_editions e on e.id = r.edition_id where r.id = race_start_waves.race_id and e.is_visible = true and r.is_public = true and r.is_live = true and r.racebook_is_live = true));
create policy "Managed start waves are viewable" on public.race_start_waves for select to authenticated
using (exists (select 1 from public.races r where r.id = race_start_waves.race_id and (r.created_by = (select auth.uid()) or exists (select 1 from public.race_event_organizers o where o.event_id = r.event_id and o.user_id = (select auth.uid()) and o.revoked_at is null))) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "Published awards are viewable" on public.race_awards for select to anon, authenticated
using (exists (select 1 from public.races r join public.race_event_editions e on e.id = r.edition_id where r.id = race_awards.race_id and e.is_visible = true and r.is_public = true and r.is_live = true and r.racebook_is_live = true));
create policy "Managed awards are viewable" on public.race_awards for select to authenticated
using (exists (select 1 from public.races r where r.id = race_awards.race_id and (r.created_by = (select auth.uid()) or exists (select 1 from public.race_event_organizers o where o.event_id = r.event_id and o.user_id = (select auth.uid()) and o.revoked_at is null))) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.set_structured_racebook_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;
create trigger set_race_edition_services_updated_at before update on public.race_edition_services for each row execute function public.set_structured_racebook_updated_at();
create trigger set_race_start_waves_updated_at before update on public.race_start_waves for each row execute function public.set_structured_racebook_updated_at();
create trigger set_race_awards_updated_at before update on public.race_awards for each row execute function public.set_structured_racebook_updated_at();

insert into public.race_start_waves (race_id, name, start_time, eligibility_type, order_index)
select r.id, 'Départ commun', (r.organizer_details #>> '{schedule,startTime}')::time, 'all', 0
from public.races r
where coalesce(r.organizer_details #>> '{schedule,startTime}', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
on conflict do nothing;

create or replace function public.replace_race_edition_services(p_edition_id uuid, p_items jsonb) returns setof public.race_edition_services
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.race_edition_services where edition_id = p_edition_id;
  insert into public.race_edition_services (id, edition_id, service_type, name, description, address, latitude, longitude, google_maps_url, website_url, phone, order_index)
  select coalesce(x.id, gen_random_uuid()), p_edition_id, x.service_type, x.name, x.description, x.address, x.latitude, x.longitude, x.google_maps_url, x.website_url, x.phone, x.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id uuid, service_type text, name text, description text, address text, latitude numeric, longitude numeric, google_maps_url text, website_url text, phone text, order_index integer);
  return query select * from public.race_edition_services where edition_id = p_edition_id order by service_type, order_index;
end $$;

create or replace function public.replace_race_start_waves(p_race_id uuid, p_items jsonb) returns setof public.race_start_waves
language plpgsql security invoker set search_path = '' as $$
declare first_time time;
begin
  delete from public.race_start_waves where race_id = p_race_id;
  insert into public.race_start_waves (id, race_id, name, start_time, eligibility_type, bib_number_min, bib_number_max, finish_minutes_min, finish_minutes_max, pace_seconds_min, pace_seconds_max, eligibility_note, order_index)
  select coalesce(x.id, gen_random_uuid()), p_race_id, x.name, x.start_time, x.eligibility_type, x.bib_number_min, x.bib_number_max, x.finish_minutes_min, x.finish_minutes_max, x.pace_seconds_min, x.pace_seconds_max, x.eligibility_note, x.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id uuid, name text, start_time time, eligibility_type text, bib_number_min integer, bib_number_max integer, finish_minutes_min integer, finish_minutes_max integer, pace_seconds_min integer, pace_seconds_max integer, eligibility_note text, order_index integer);
  select min(start_time) into first_time from public.race_start_waves where race_id = p_race_id;
  update public.races
  set organizer_details = jsonb_set(
    coalesce(organizer_details, '{}'::jsonb) || jsonb_build_object('schedule', coalesce(organizer_details -> 'schedule', '{}'::jsonb)),
    '{schedule,startTime}', coalesce(to_jsonb(first_time::text), 'null'::jsonb), true
  )
  where id = p_race_id;
  return query select * from public.race_start_waves where race_id = p_race_id order by order_index;
end $$;

create or replace function public.replace_race_awards(p_race_id uuid, p_items jsonb) returns setof public.race_awards
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.race_awards where race_id = p_race_id;
  insert into public.race_awards (id, race_id, category_key, category_label, audience, place_from, place_to, podium_time, podium_location, reward_note, order_index)
  select coalesce(x.id, gen_random_uuid()), p_race_id, x.category_key, x.category_label, x.audience, x.place_from, x.place_to, x.podium_time, x.podium_location, x.reward_note, x.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id uuid, category_key text, category_label text, audience text, place_from integer, place_to integer, podium_time time, podium_location text, reward_note text, order_index integer);
  return query select * from public.race_awards where race_id = p_race_id order by podium_time, order_index;
end $$;

revoke all on function public.replace_race_edition_services(uuid, jsonb), public.replace_race_start_waves(uuid, jsonb), public.replace_race_awards(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_race_edition_services(uuid, jsonb), public.replace_race_start_waves(uuid, jsonb), public.replace_race_awards(uuid, jsonb) to service_role;

comment on table public.race_edition_services is 'Structured practical places shared by all formats of one event edition.';
comment on table public.race_start_waves is 'Ordered start corrals/waves and machine-readable eligibility criteria for a race format.';
comment on table public.race_awards is 'Runner-facing award categories, rewarded places, and podium schedule for a race format.';
