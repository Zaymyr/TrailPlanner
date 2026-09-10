-- Organizer course-collection RPC privilege, identity, and rollback checks.
-- Run after 20260910081049_add_atomic_organizer_course_collections.sql.

begin;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.replace_race_aid_stations(uuid,jsonb)',
    'public.replace_race_aid_station_products(uuid,uuid,jsonb)',
    'public.replace_race_relay_points(uuid,jsonb)',
    'public.create_organizer_aid_station_product(uuid,uuid,jsonb,text)',
    'public.reorder_racebook_sponsors(uuid,jsonb)'
  ] loop
    if has_function_privilege('anon', signature, 'execute')
      or has_function_privilege('authenticated', signature, 'execute')
      or not has_function_privilege('service_role', signature, 'execute') then
      raise exception '% execution must be service-role-only.', signature;
    end if;
  end loop;
end;
$$;

create temp table _organizer_atomic_fixture (
  race_id uuid not null,
  station_id uuid,
  product_id uuid,
  link_id uuid,
  relay_point_id uuid
) on commit drop;

insert into _organizer_atomic_fixture (race_id)
select race_row.id
from public.races as race_row
where race_row.distance_km > 2
limit 1;

do $$
begin
  if not exists (select 1 from _organizer_atomic_fixture) then
    raise exception 'Atomic collection checks require one race longer than 2 km.';
  end if;
end;
$$;

do $$
declare
  rejected_product_id uuid := gen_random_uuid();
begin
  begin
    perform public.create_organizer_aid_station_product(
      (select race_id from _organizer_atomic_fixture),
      gen_random_uuid(),
      jsonb_build_object(
        'id', rejected_product_id,
        'slug', 'must-not-survive-' || rejected_product_id,
        'sku', 'must-not-survive-' || rejected_product_id,
        'name', 'Must not survive',
        'fuel_type', 'gel',
        'calories_kcal', 100,
        'carbs_g', 25,
        'sodium_mg', 0,
        'protein_g', 0,
        'fat_g', 0,
        'created_by', gen_random_uuid()
      ),
      null
    );
    raise exception 'Expected product creation for an invalid station to fail.';
  exception when foreign_key_violation then
    null;
  end;

  if exists (select 1 from public.products where id = rejected_product_id) then
    raise exception 'Failed product attachment must not leave an orphan product.';
  end if;
end;
$$;

update public.races
set participation_mode = 'relay'
where id = (select race_id from _organizer_atomic_fixture);

with inserted_station as (
  insert into public.race_aid_stations (
    race_id,
    name,
    km,
    water_available,
    solid_available,
    assistance_allowed,
    notes,
    order_index
  )
  select race_id, 'Atomic station', 1, true, true, true, 'original', 0
  from _organizer_atomic_fixture
  returning id
)
update _organizer_atomic_fixture
set station_id = inserted_station.id
from inserted_station;

with inserted_product as (
  insert into public.products (slug, sku, name, calories_kcal, carbs_g, protein_g, fat_g, is_live, is_archived)
  values (
    'atomic-product-' || replace(gen_random_uuid()::text, '-', ''),
    'atomic-product-' || replace(gen_random_uuid()::text, '-', ''),
    'Atomic product',
    100,
    25,
    0,
    0,
    false,
    false
  )
  returning id
), inserted_link as (
  insert into public.race_aid_station_products (race_aid_station_id, product_id, notes, order_index)
  select fixture.station_id, inserted_product.id, 'original', 0
  from _organizer_atomic_fixture as fixture
  cross join inserted_product
  returning id, product_id
)
update _organizer_atomic_fixture
set product_id = inserted_link.product_id,
    link_id = inserted_link.id
from inserted_link;

with inserted_point as (
  insert into public.race_relay_points (race_id, race_aid_station_id, name, km, order_index)
  select race_id, station_id, 'Atomic relay', 1, 0
  from _organizer_atomic_fixture
  returning id
)
update _organizer_atomic_fixture
set relay_point_id = inserted_point.id
from inserted_point;

select public.replace_race_aid_stations(
  (select race_id from _organizer_atomic_fixture),
  jsonb_build_array(jsonb_build_object(
    'id', (select station_id from _organizer_atomic_fixture),
    'name', 'Atomic station updated',
    'km', 1.25,
    'water_available', true,
    'solid_available', false,
    'assistance_allowed', true,
    'notes', 'updated',
    'organizer_details', null,
    'order_index', 0
  ))
);

do $$
begin
  if not exists (
    select 1
    from public.race_aid_stations
    where id = (select station_id from _organizer_atomic_fixture)
      and name = 'Atomic station updated'
  ) then
    raise exception 'Aid-station replacement must preserve submitted row ids.';
  end if;

  if not exists (
    select 1
    from public.race_aid_station_products
    where id = (select link_id from _organizer_atomic_fixture)
  ) then
    raise exception 'Preserving an aid-station id must preserve its product links.';
  end if;

  if not exists (
    select 1
    from public.race_relay_points
    where id = (select relay_point_id from _organizer_atomic_fixture)
      and race_aid_station_id = (select station_id from _organizer_atomic_fixture)
  ) then
    raise exception 'Preserving an aid-station id must preserve relay linkage.';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.replace_race_aid_stations(
      (select race_id from _organizer_atomic_fixture),
      jsonb_build_array(
        jsonb_build_object(
          'id', (select station_id from _organizer_atomic_fixture),
          'name', 'Must roll back',
          'km', 1.5,
          'water_available', true,
          'solid_available', true,
          'assistance_allowed', true,
          'order_index', 0
        ),
        jsonb_build_object(
          'name', null,
          'km', 1.75,
          'water_available', true,
          'solid_available', true,
          'assistance_allowed', true,
          'order_index', 1
        )
      )
    );
    raise exception 'Expected invalid aid-station replacement to fail.';
  exception when not_null_violation then
    null;
  end;

  if (select name from public.race_aid_stations where id = (select station_id from _organizer_atomic_fixture))
    <> 'Atomic station updated' then
    raise exception 'Failed aid-station replacement must roll back earlier updates.';
  end if;
end;
$$;

select public.replace_race_aid_station_products(
  (select race_id from _organizer_atomic_fixture),
  (select station_id from _organizer_atomic_fixture),
  jsonb_build_array(jsonb_build_object(
    'product_id', (select product_id from _organizer_atomic_fixture),
    'notes', 'replaced',
    'order_index', 0
  ))
);

do $$
begin
  begin
    perform public.replace_race_aid_station_products(
      (select race_id from _organizer_atomic_fixture),
      (select station_id from _organizer_atomic_fixture),
      jsonb_build_array(jsonb_build_object(
        'product_id', gen_random_uuid(),
        'notes', 'invalid',
        'order_index', 0
      ))
    );
    raise exception 'Expected invalid product replacement to fail.';
  exception when foreign_key_violation then
    null;
  end;

  if not exists (
    select 1
    from public.race_aid_station_products
    where race_aid_station_id = (select station_id from _organizer_atomic_fixture)
      and product_id = (select product_id from _organizer_atomic_fixture)
      and notes = 'replaced'
  ) then
    raise exception 'Failed product replacement must restore the previous ordered set.';
  end if;
end;
$$;

select public.replace_race_relay_points(
  (select race_id from _organizer_atomic_fixture),
  jsonb_build_array(jsonb_build_object(
    'id', (select relay_point_id from _organizer_atomic_fixture),
    'race_aid_station_id', (select station_id from _organizer_atomic_fixture),
    'name', 'Atomic relay updated',
    'km', 1.25,
    'handover_time', null,
    'cutoff_time', null,
    'notes', 'updated',
    'order_index', 0
  ))
);

do $$
begin
  begin
    perform public.replace_race_relay_points(
      (select race_id from _organizer_atomic_fixture),
      jsonb_build_array(
        jsonb_build_object(
          'id', (select relay_point_id from _organizer_atomic_fixture),
          'race_aid_station_id', (select station_id from _organizer_atomic_fixture),
          'name', 'Must roll back',
          'km', 1.5,
          'order_index', 0
        ),
        jsonb_build_object(
          'name', null,
          'km', 1.75,
          'order_index', 1
        )
      )
    );
    raise exception 'Expected invalid relay replacement to fail.';
  exception when not_null_violation then
    null;
  end;

  if (select name from public.race_relay_points where id = (select relay_point_id from _organizer_atomic_fixture))
    <> 'Atomic relay updated' then
    raise exception 'Failed relay replacement must roll back earlier updates.';
  end if;
end;
$$;

rollback;
