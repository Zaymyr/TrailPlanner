begin;

do $$
declare
  target_race_id uuid;
  existing_station_count integer;
begin
  select id
  into target_race_id
  from public.races
  where slug = 'bibracte-ultra-trail-185-km-2026'
    and name = 'L''Ultra des Druides';

  if target_race_id is null then
    raise exception 'Bibracte Ultra des Druides race not found; refusing to insert aid stations.';
  end if;

  select count(*)
  into existing_station_count
  from public.race_aid_stations
  where race_id = target_race_id;

  if existing_station_count > 0 then
    raise notice 'Bibracte Ultra des Druides already has % aid stations; preserving organizer data.', existing_station_count;
    return;
  end if;

  insert into public.race_aid_stations (
    race_id,
    name,
    km,
    water_available,
    solid_available,
    assistance_allowed,
    notes,
    order_index,
    organizer_details
  )
  select
    target_race_id,
    station.name,
    station.km,
    true,
    true,
    true,
    station.notes,
    station.order_index,
    jsonb_build_object(
      'stationType', case when station.drop_bag_available then 'life_base' else 'solid' end,
      'cumulativeElevationGainM', station.cumulative_gain_m,
      'cumulativeElevationLossM', station.cumulative_loss_m,
      'altitudeM', station.altitude_m,
      'cutoffTime', station.cutoff_time,
      'dropBagAvailable', station.drop_bag_available,
      'organizerNote', null
    )
  from (
    values
      ('La Comelle',            21::numeric,  440::numeric,  679::numeric, 369::numeric, null::text, false, null::text, 0),
      ('Millay',                 40::numeric,  856::numeric, 1106::numeric, 355::numeric, null::text, false, null::text, 1),
      ('Villapourçon',           58::numeric, 1493::numeric, 1675::numeric, 421::numeric, null::text, false, null::text, 2),
      ('Onlay',                  66::numeric, 1637::numeric, 1900::numeric, 322::numeric, '07:00',    false, null::text, 3),
      ('Glux-en-Glenne',         86::numeric, 2399::numeric, 2428::numeric, 662::numeric, '12:00',    true,  'Base de vie', 4),
      ('Fâchin',                107::numeric, 2930::numeric, 3109::numeric, 513::numeric, null::text, false, null::text, 5),
      ('Arleuf',                123::numeric, 3514::numeric, 3590::numeric, 626::numeric, null::text, false, null::text, 6),
      ('Athez',                 131::numeric, 3598::numeric, 3804::numeric, 466::numeric, '01:00',    true,  'Base de vie', 7),
      ('Roussillon-en-Morvan',  149::numeric, 4216::numeric, 4376::numeric, 534::numeric, '05:00',    false, null::text, 8),
      ('La Grande-Verrière',    165::numeric, 4757::numeric, 5073::numeric, 383::numeric, '09:00',    false, null::text, 9)
  ) as station(
    name,
    km,
    cumulative_gain_m,
    cumulative_loss_m,
    altitude_m,
    cutoff_time,
    drop_bag_available,
    notes,
    order_index
  );

  insert into public.race_aid_stations (
    race_id,
    name,
    km,
    water_available,
    solid_available,
    assistance_allowed,
    notes,
    order_index,
    organizer_details
  )
  values (
    target_race_id,
    'Saint-Prix',
    172,
    true,
    false,
    false,
    'Point d''eau',
    10,
    jsonb_build_object(
      'stationType', 'water',
      'cumulativeElevationGainM', null,
      'cumulativeElevationLossM', null,
      'altitudeM', null,
      'cutoffTime', '11:00',
      'dropBagAvailable', false,
      'organizerNote', null
    )
  );

  if (
    select count(*)
    from public.race_aid_stations
    where race_id = target_race_id
  ) <> 11 then
    raise exception 'Expected ten full aid stations and one water point for Bibracte Ultra des Druides after correction.';
  end if;
end;
$$;

commit;
