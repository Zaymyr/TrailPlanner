-- Organizer-authored supporter access points. Draft rows may be incomplete;
-- the public policy exposes only complete, enabled points.

create table public.race_supporter_points (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races(id) on delete cascade,
  name text not null default '',
  km numeric,
  order_index integer not null default 0,
  encouragement_allowed boolean not null default false,
  assistance_allowed boolean not null default false,
  access_label text,
  latitude double precision,
  longitude double precision,
  google_maps_url text,
  access_note text,
  plan_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint race_supporter_points_km_check check (km is null or km >= 0),
  constraint race_supporter_points_latitude_check check (latitude is null or latitude between -90 and 90),
  constraint race_supporter_points_longitude_check check (longitude is null or longitude between -180 and 180),
  constraint race_supporter_points_coordinate_pair_check check ((latitude is null) = (longitude is null)),
  constraint race_supporter_points_maps_url_check check (google_maps_url is null or google_maps_url ~* '^https?://'),
  constraint race_supporter_points_plan_url_check check (plan_url is null or plan_url ~* '^https?://')
);

create index race_supporter_points_race_order_idx
  on public.race_supporter_points (race_id, order_index);

create or replace function public.set_race_supporter_point_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger set_race_supporter_point_updated_at_trigger
before update on public.race_supporter_points
for each row execute function public.set_race_supporter_point_updated_at();

alter table public.organizer_racebook_module_settings
  drop constraint organizer_racebook_module_settings_scope_check;

alter table public.organizer_racebook_module_settings
  add constraint organizer_racebook_module_settings_scope_check check (
    (race_id is null and module_key in ('equipment', 'bib_pickup', 'access', 'services', 'branding', 'sponsors'))
    or
    (race_id is not null and module_key in ('aid_stations', 'supporter_points', 'start_waves', 'awards', 'relay', 'official_products'))
  );

create or replace function public.initialize_organizer_race_modules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.edition_id is not null then
    insert into public.organizer_racebook_module_settings (edition_id, race_id, module_key, is_enabled)
    values
      (new.edition_id, new.id, 'aid_stations', true),
      (new.edition_id, new.id, 'supporter_points', true)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

insert into public.organizer_racebook_module_settings (edition_id, race_id, module_key, is_enabled)
select race_row.edition_id, race_row.id, 'supporter_points', true
from public.races race_row
where race_row.edition_id is not null
on conflict do nothing;

alter table public.race_supporter_points enable row level security;

revoke all on table public.race_supporter_points from public, anon, authenticated;
grant select on table public.race_supporter_points to anon, authenticated;
grant select, insert, update, delete on table public.race_supporter_points to service_role;

create policy "Published supporter points are viewable"
on public.race_supporter_points
for select
to anon, authenticated
using (
  btrim(name) <> ''
  and km is not null
  and latitude is not null
  and longitude is not null
  and (encouragement_allowed or assistance_allowed)
  and exists (
    select 1
    from public.races race_row
    where race_row.id = race_supporter_points.race_id
      and race_supporter_points.km <= race_row.distance_km
      and private.racebook_module_is_enabled(race_row.id, 'supporter_points')
      and (
        (race_row.is_public and race_row.is_live and race_row.racebook_is_live)
        or race_row.created_by = (select auth.uid())
        or exists (
          select 1 from public.race_event_organizers organizer_row
          where organizer_row.event_id = race_row.event_id
            and organizer_row.user_id = (select auth.uid())
            and organizer_row.revoked_at is null
        )
        or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
      )
  )
);

create or replace function public.replace_race_supporter_points(p_race_id uuid, p_items jsonb)
returns setof public.race_supporter_points
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_race_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Supporter point items must be a JSON array.' using errcode = '22023';
  end if;

  select race_row.id into locked_race_id
  from public.races race_row
  where race_row.id = p_race_id
  for update;
  if locked_race_id is null then raise exception 'Race not found.' using errcode = 'P0002'; end if;

  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(id uuid)
    where item.id is not null group by item.id having count(*) > 1
  ) then raise exception 'A supporter point id may only be submitted once.' using errcode = '22023'; end if;

  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(id uuid)
    where item.id is not null and not exists (
      select 1 from public.race_supporter_points point_row
      where point_row.id = item.id and point_row.race_id = p_race_id
    )
  ) then raise exception 'A supporter point does not belong to this race.' using errcode = '23503'; end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(
      km numeric, latitude double precision, longitude double precision,
      google_maps_url text, plan_url text
    )
    join public.races race_row on race_row.id = p_race_id
    where (item.km is not null and (item.km < 0 or item.km > race_row.distance_km))
       or ((item.latitude is null) <> (item.longitude is null))
       or (item.latitude is not null and item.latitude not between -90 and 90)
       or (item.longitude is not null and item.longitude not between -180 and 180)
       or (item.google_maps_url is not null and item.google_maps_url !~* '^https?://')
       or (item.plan_url is not null and item.plan_url !~* '^https?://')
  ) then raise exception 'Invalid supporter point.' using errcode = '22023'; end if;

  delete from public.race_supporter_points point_row
  where point_row.race_id = p_race_id
    and not exists (
      select 1 from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) item(id uuid)
      where item.id = point_row.id
    );

  insert into public.race_supporter_points (
    id, race_id, name, km, order_index, encouragement_allowed, assistance_allowed,
    access_label, latitude, longitude, google_maps_url, access_note, plan_url
  )
  select
    coalesce(item.id, gen_random_uuid()), p_race_id, coalesce(item.name, ''), item.km,
    row_number() over (order by item.km asc nulls last, item.input_order)::integer - 1,
    coalesce(item.encouragement_allowed, false), coalesce(item.assistance_allowed, false),
    nullif(btrim(item.access_label), ''), item.latitude, item.longitude,
    nullif(btrim(item.google_maps_url), ''), nullif(btrim(item.access_note), ''), nullif(btrim(item.plan_url), '')
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) with ordinality as item(
    id uuid, name text, km numeric, encouragement_allowed boolean, assistance_allowed boolean,
    access_label text, latitude double precision, longitude double precision,
    google_maps_url text, access_note text, plan_url text, input_order bigint
  )
  on conflict (id) do update set
    name = excluded.name, km = excluded.km, order_index = excluded.order_index,
    encouragement_allowed = excluded.encouragement_allowed,
    assistance_allowed = excluded.assistance_allowed, access_label = excluded.access_label,
    latitude = excluded.latitude, longitude = excluded.longitude,
    google_maps_url = excluded.google_maps_url, access_note = excluded.access_note,
    plan_url = excluded.plan_url;

  return query
  select point_row.* from public.race_supporter_points point_row
  where point_row.race_id = p_race_id
  order by point_row.order_index;
end;
$$;

revoke all on function public.set_race_supporter_point_updated_at() from public, anon, authenticated;
grant execute on function public.set_race_supporter_point_updated_at() to service_role;
revoke all on function public.replace_race_supporter_points(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_race_supporter_points(uuid, jsonb) to service_role;

comment on table public.race_supporter_points is 'Organizer-authored supporter encouragement and crew-access points for a race format.';
comment on function public.replace_race_supporter_points(uuid, jsonb) is 'Service-only atomic replacement sorted by course kilometer while preserving submitted ids.';
