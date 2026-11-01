alter table public.race_supporter_points
  add column if not exists access_on_course boolean not null default false;

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
    access_label, latitude, longitude, google_maps_url, access_note, plan_url, access_on_course
  )
  select
    coalesce(parsed.id, gen_random_uuid()), p_race_id, coalesce(parsed.name, ''), parsed.km,
    row_number() over (order by parsed.km asc nulls last, item.input_order)::integer - 1,
    coalesce(parsed.encouragement_allowed, false), coalesce(parsed.assistance_allowed, false),
    nullif(btrim(parsed.access_label), ''), parsed.latitude, parsed.longitude,
    nullif(btrim(parsed.google_maps_url), ''), nullif(btrim(parsed.access_note), ''),
    nullif(btrim(parsed.plan_url), ''), coalesce(parsed.access_on_course, false)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as item(value, input_order)
  cross join lateral jsonb_to_record(item.value) as parsed(
    id uuid, name text, km numeric, encouragement_allowed boolean, assistance_allowed boolean,
    access_label text, latitude double precision, longitude double precision,
    google_maps_url text, access_note text, plan_url text, access_on_course boolean
  )
  on conflict (id) do update set
    name = excluded.name, km = excluded.km, order_index = excluded.order_index,
    encouragement_allowed = excluded.encouragement_allowed,
    assistance_allowed = excluded.assistance_allowed, access_label = excluded.access_label,
    latitude = excluded.latitude, longitude = excluded.longitude,
    google_maps_url = excluded.google_maps_url, access_note = excluded.access_note,
    plan_url = excluded.plan_url, access_on_course = excluded.access_on_course;

  return query
  select point_row.* from public.race_supporter_points point_row
  where point_row.race_id = p_race_id
  order by point_row.order_index;
end;
$$;

revoke all on function public.replace_race_supporter_points(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_race_supporter_points(uuid, jsonb) to service_role;

comment on column public.race_supporter_points.access_on_course is
  'True when supporter directions use the GPX course position at km instead of a separate access address.';
