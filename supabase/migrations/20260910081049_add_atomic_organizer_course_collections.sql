-- Organizer collection replacements are invoked only by server routes using the
-- service role. Each function locks the parent race first so concurrent saves for
-- the same format are serialized and every validation/write rolls back together.

create or replace function public.replace_race_aid_stations(p_race_id uuid, p_items jsonb)
returns setof public.race_aid_stations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_race_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Aid station items must be a JSON array.' using errcode = '22023';
  end if;

  select race_row.id
  into locked_race_id
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if locked_race_id is null then
    raise exception 'Race not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
    where item.id is not null
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'An aid station id may only be submitted once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
    where item.id is not null
      and not exists (
        select 1
        from public.race_aid_stations as station
        where station.id = item.id
          and station.race_id = p_race_id
      )
  ) then
    raise exception 'An aid station does not belong to this race.' using errcode = '23503';
  end if;

  update public.race_aid_stations as station
  set name = item.name,
      km = item.km,
      water_available = item.water_available,
      solid_available = item.solid_available,
      assistance_allowed = item.assistance_allowed,
      notes = item.notes,
      organizer_details = item.organizer_details,
      order_index = item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    id uuid,
    name text,
    km numeric,
    water_available boolean,
    solid_available boolean,
    assistance_allowed boolean,
    notes text,
    organizer_details jsonb,
    order_index integer
  )
  where item.id is not null
    and station.id = item.id
    and station.race_id = p_race_id;

  delete from public.race_aid_stations as station
  where station.race_id = p_race_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
      where item.id = station.id
    );

  insert into public.race_aid_stations (
    id,
    race_id,
    name,
    km,
    water_available,
    solid_available,
    assistance_allowed,
    notes,
    organizer_details,
    order_index
  )
  select
    gen_random_uuid(),
    p_race_id,
    item.name,
    item.km,
    item.water_available,
    item.solid_available,
    item.assistance_allowed,
    item.notes,
    item.organizer_details,
    item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    id uuid,
    name text,
    km numeric,
    water_available boolean,
    solid_available boolean,
    assistance_allowed boolean,
    notes text,
    organizer_details jsonb,
    order_index integer
  )
  where item.id is null;

  return query
  select station.*
  from public.race_aid_stations as station
  where station.race_id = p_race_id
  order by station.order_index, station.km, station.id;
end;
$$;

create or replace function public.replace_race_aid_station_products(
  p_race_id uuid,
  p_aid_station_id uuid,
  p_items jsonb
)
returns setof public.race_aid_station_products
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_race_id uuid;
  locked_station_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Aid station product items must be a JSON array.' using errcode = '22023';
  end if;

  select race_row.id
  into locked_race_id
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if locked_race_id is null then
    raise exception 'Race not found.' using errcode = 'P0002';
  end if;

  select station.id
  into locked_station_id
  from public.race_aid_stations as station
  where station.id = p_aid_station_id
    and station.race_id = p_race_id
  for update;

  if locked_station_id is null then
    raise exception 'Aid station does not belong to this race.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(product_id uuid)
    group by item.product_id
    having item.product_id is null or count(*) > 1
  ) then
    raise exception 'A product may only be submitted once and must have an id.' using errcode = '22023';
  end if;

  delete from public.race_aid_station_products
  where race_aid_station_id = p_aid_station_id;

  insert into public.race_aid_station_products (
    race_aid_station_id,
    product_id,
    notes,
    order_index
  )
  select
    p_aid_station_id,
    item.product_id,
    item.notes,
    item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    product_id uuid,
    notes text,
    order_index integer
  );

  return query
  select link.*
  from public.race_aid_station_products as link
  where link.race_aid_station_id = p_aid_station_id
  order by link.order_index, link.id;
end;
$$;

create or replace function public.replace_race_relay_points(p_race_id uuid, p_items jsonb)
returns setof public.race_relay_points
language plpgsql
security invoker
set search_path = ''
as $$
declare
  race_distance numeric;
  race_participation_mode text;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Relay point items must be a JSON array.' using errcode = '22023';
  end if;

  select race_row.distance_km, race_row.participation_mode
  into race_distance, race_participation_mode
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if not found then
    raise exception 'Race not found.' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 0
    and race_participation_mode = 'solo' then
    raise exception 'Relay participation must be enabled before adding relay points.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
    where item.id is not null
    group by item.id
    having count(*) > 1
  ) then
    raise exception 'A relay point id may only be submitted once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
    where item.id is not null
      and not exists (
        select 1
        from public.race_relay_points as point
        where point.id = item.id
          and point.race_id = p_race_id
      )
  ) then
    raise exception 'A relay point does not belong to this race.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(race_aid_station_id uuid)
    where item.race_aid_station_id is not null
      and not exists (
        select 1
        from public.race_aid_stations as station
        where station.id = item.race_aid_station_id
          and station.race_id = p_race_id
      )
  ) then
    raise exception 'A relay point references an aid station from another race.' using errcode = '23503';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(km numeric)
    where item.km is null or item.km <= 0 or item.km >= race_distance
  ) then
    raise exception 'Every relay point must be after the start and before the finish.' using errcode = '23514';
  end if;

  update public.race_relay_points as point
  set race_aid_station_id = item.race_aid_station_id,
      name = item.name,
      km = item.km,
      handover_time = item.handover_time,
      cutoff_time = item.cutoff_time,
      notes = item.notes,
      order_index = item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    id uuid,
    race_aid_station_id uuid,
    name text,
    km numeric,
    handover_time text,
    cutoff_time text,
    notes text,
    order_index integer
  )
  where item.id is not null
    and point.id = item.id
    and point.race_id = p_race_id;

  delete from public.race_relay_points as point
  where point.race_id = p_race_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid)
      where item.id = point.id
    );

  insert into public.race_relay_points (
    id,
    race_id,
    race_aid_station_id,
    name,
    km,
    handover_time,
    cutoff_time,
    notes,
    order_index
  )
  select
    gen_random_uuid(),
    p_race_id,
    item.race_aid_station_id,
    item.name,
    item.km,
    item.handover_time,
    item.cutoff_time,
    item.notes,
    item.order_index
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(
    id uuid,
    race_aid_station_id uuid,
    name text,
    km numeric,
    handover_time text,
    cutoff_time text,
    notes text,
    order_index integer
  )
  where item.id is null;

  return query
  select point.*
  from public.race_relay_points as point
  where point.race_id = p_race_id
  order by point.order_index, point.km, point.id;
end;
$$;

revoke all on function public.replace_race_aid_stations(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.replace_race_aid_station_products(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.replace_race_relay_points(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.replace_race_aid_stations(uuid, jsonb) to service_role;
grant execute on function public.replace_race_aid_station_products(uuid, uuid, jsonb) to service_role;
grant execute on function public.replace_race_relay_points(uuid, jsonb) to service_role;

comment on function public.replace_race_aid_stations(uuid, jsonb) is
  'Atomically replaces one race ordered aid-station collection while preserving submitted row ids.';
comment on function public.replace_race_aid_station_products(uuid, uuid, jsonb) is
  'Atomically replaces the ordered product links for one aid station after validating its race.';
comment on function public.replace_race_relay_points(uuid, jsonb) is
  'Atomically replaces one race ordered relay-point collection while preserving submitted row ids.';

create or replace function public.create_organizer_aid_station_product(
  p_race_id uuid,
  p_aid_station_id uuid,
  p_product jsonb,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_race_id uuid;
  locked_station_id uuid;
  product_row public.products%rowtype;
  link_row public.race_aid_station_products%rowtype;
begin
  if jsonb_typeof(p_product) <> 'object' then
    raise exception 'Product must be a JSON object.' using errcode = '22023';
  end if;

  select race_row.id
  into locked_race_id
  from public.races as race_row
  where race_row.id = p_race_id
  for update;

  if locked_race_id is null then
    raise exception 'Race not found.' using errcode = 'P0002';
  end if;

  select station.id
  into locked_station_id
  from public.race_aid_stations as station
  where station.id = p_aid_station_id
    and station.race_id = p_race_id
  for update;

  if locked_station_id is null then
    raise exception 'Aid station does not belong to this race.' using errcode = '23503';
  end if;

  insert into public.products (
    id,
    slug,
    sku,
    name,
    brand,
    fuel_type,
    product_url,
    calories_kcal,
    carbs_g,
    sodium_mg,
    protein_g,
    fat_g,
    is_live,
    is_archived,
    is_official,
    official_name,
    created_by
  ) values (
    (p_product ->> 'id')::uuid,
    p_product ->> 'slug',
    p_product ->> 'sku',
    p_product ->> 'name',
    nullif(p_product ->> 'brand', ''),
    (p_product ->> 'fuel_type')::public.fuel_type,
    nullif(p_product ->> 'product_url', ''),
    (p_product ->> 'calories_kcal')::numeric,
    (p_product ->> 'carbs_g')::numeric,
    (p_product ->> 'sodium_mg')::numeric,
    (p_product ->> 'protein_g')::numeric,
    (p_product ->> 'fat_g')::numeric,
    false,
    false,
    false,
    null,
    (p_product ->> 'created_by')::uuid
  )
  returning * into product_row;

  insert into public.race_aid_station_products (
    race_aid_station_id,
    product_id,
    notes,
    order_index
  ) values (
    p_aid_station_id,
    product_row.id,
    p_notes,
    999
  )
  returning * into link_row;

  return jsonb_build_object(
    'product', to_jsonb(product_row),
    'stationProduct', to_jsonb(link_row)
  );
end;
$$;

create or replace function public.reorder_racebook_sponsors(p_edition_id uuid, p_items jsonb)
returns setof public.race_event_edition_sponsors
language plpgsql
security invoker
set search_path = ''
as $$
declare
  locked_edition_id uuid;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Sponsor positions must be a JSON array.' using errcode = '22023';
  end if;

  select edition.id
  into locked_edition_id
  from public.race_event_editions as edition
  where edition.id = p_edition_id
  for update;

  if locked_edition_id is null then
    raise exception 'Edition not found.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
    group by item.id
    having item.id is null or count(*) > 1
  ) then
    raise exception 'A sponsor id may only be submitted once.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
    where item.position is null or item.position < 0 or item.position > 9
  ) then
    raise exception 'Sponsor positions must be between 0 and 9.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
    group by item.position
    having count(*) > 1
  ) then
    raise exception 'Sponsor positions must be unique.' using errcode = '23514';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) <> (
    select count(*)
    from public.race_event_edition_sponsors as sponsor
    where sponsor.edition_id = p_edition_id
  ) then
    raise exception 'The complete edition sponsor list is required for reordering.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
    where not exists (
      select 1
      from public.race_event_edition_sponsors as sponsor
      where sponsor.id = item.id
        and sponsor.edition_id = p_edition_id
    )
  ) then
    raise exception 'A sponsor does not belong to this edition.' using errcode = '23503';
  end if;

  update public.race_event_edition_sponsors as sponsor
  set position = item.position
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(id uuid, position integer)
  where sponsor.id = item.id
    and sponsor.edition_id = p_edition_id;

  return query
  select sponsor.*
  from public.race_event_edition_sponsors as sponsor
  where sponsor.edition_id = p_edition_id
  order by sponsor.position, sponsor.created_at, sponsor.id;
end;
$$;

revoke all on function public.create_organizer_aid_station_product(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.reorder_racebook_sponsors(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.create_organizer_aid_station_product(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.reorder_racebook_sponsors(uuid, jsonb) to service_role;

comment on function public.create_organizer_aid_station_product(uuid, uuid, jsonb, text) is
  'Atomically creates an organizer-scoped product and attaches it to one aid station.';
comment on function public.reorder_racebook_sponsors(uuid, jsonb) is
  'Atomically updates a validated subset of sponsor positions within one edition.';
