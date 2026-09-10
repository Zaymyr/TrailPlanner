begin;

-- Verified organizer sources consulted on 2026-09-10. This batch extends the
-- non-UTMB French catalog through May 2027 without inventing GPX or missing D+.
create temporary table _catalog_events_may_2027 (
  source_key text primary key,
  name text not null,
  location text not null,
  website_url text not null,
  start_date date not null,
  end_date date not null,
  city text not null,
  city_code text not null,
  department text not null,
  department_code text not null,
  region text not null,
  region_code text not null,
  latitude double precision not null,
  longitude double precision not null
) on commit drop;

insert into _catalog_events_may_2027 values
  ('trail-petit-ballon', 'Trail du Petit Ballon', 'Rouffach, Haut-Rhin, France',
   'https://www.trailpetitballon.fr/', date '2027-03-14', date '2027-03-14',
   'Rouffach', '68287', 'Haut-Rhin', '68', 'Grand Est', '44', 47.9688, 7.2773),
  ('grand-trail-cadourques', 'Grand Trail des Cadourques', 'Cahors, Lot, France',
   'https://www.grandtraildescadourques.fr/', date '2027-04-02', date '2027-04-03',
   'Cahors', '46042', 'Lot', '46', 'Occitanie', '76', 44.4565, 1.4390),
  ('volvic-volcanic-experience', 'Volvic Volcanic Experience', 'Volvic, Puy-de-Dôme, France',
   'https://www.volvic-vvx.com/', date '2027-05-05', date '2027-05-08',
   'Volvic', '63470', 'Puy-de-Dôme', '63', 'Auvergne-Rhône-Alpes', '84', 45.8647, 3.0211);

do $$
declare
  source record;
  target_id uuid;
  candidate_ids uuid[];
begin
  for source in select * from _catalog_events_may_2027 order by source_key loop
    select array_agg(distinct event.id)
      into candidate_ids
    from public.race_events event
    where event.organizer_details #>> '{catalogSource,sourceKey}' = source.source_key
       or lower(trim(trailing '/' from coalesce(event.website_url, ''))) = lower(trim(trailing '/' from source.website_url))
       or lower(event.name) = lower(source.name)
       or (
         source.source_key = 'volvic-volcanic-experience'
         and lower(event.name) like 'volvic volcanic experience%'
       );

    if coalesce(array_length(candidate_ids, 1), 0) > 1 then
      raise exception 'Ambiguous catalog event binding for %: %', source.source_key, candidate_ids;
    end if;

    target_id := candidate_ids[1];
    if target_id is null then
      insert into public.race_events (
        name, location, website_url, race_date, is_live, organizer_details,
        location_city, location_city_code, location_department, location_department_code,
        location_region, location_region_code, location_country, location_country_code,
        location_latitude, location_longitude
      ) values (
        source.name, source.location, source.website_url, source.start_date, true,
        jsonb_build_object(
          'officialWebsiteUrl', source.website_url,
          'dateRange', jsonb_build_object('endDate', source.end_date::text),
          'catalogSource', jsonb_build_object(
            'kind', 'official', 'provider', 'organizer',
            'sourceKey', source.source_key, 'verifiedAt', '2026-09-10'
          )
        ),
        source.city, source.city_code, source.department, source.department_code,
        source.region, source.region_code, 'France', 'FR', source.latitude, source.longitude
      ) returning id into target_id;
    else
      update public.race_events
      set name = source.name,
          location = source.location,
          website_url = source.website_url,
          race_date = source.start_date,
          is_live = true,
          location_city = source.city,
          location_city_code = source.city_code,
          location_department = source.department,
          location_department_code = source.department_code,
          location_region = source.region,
          location_region_code = source.region_code,
          location_country = 'France',
          location_country_code = 'FR',
          location_latitude = source.latitude,
          location_longitude = source.longitude,
          organizer_details = coalesce(organizer_details, '{}'::jsonb) || jsonb_build_object(
            'officialWebsiteUrl', source.website_url,
            'dateRange', jsonb_build_object('endDate', source.end_date::text),
            'catalogSource', jsonb_build_object(
              'kind', 'official', 'provider', 'organizer',
              'sourceKey', source.source_key, 'verifiedAt', '2026-09-10'
            )
          ),
          updated_at = now()
      where id = target_id;
    end if;
  end loop;
end $$;

-- Keep only the new official edition current for each enriched event.
update public.race_event_editions edition
set is_current = false
where edition.event_id in (
  select event.id
  from _catalog_events_may_2027 source
  join public.race_events event
    on event.organizer_details #>> '{catalogSource,sourceKey}' = source.source_key
)
  and edition.is_current;

insert into public.race_event_editions (
  event_id, edition_year, start_date, end_date, is_current, is_visible
)
select event.id, 2027, source.start_date, source.end_date, true, true
from _catalog_events_may_2027 source
join public.race_events event
  on event.organizer_details #>> '{catalogSource,sourceKey}' = source.source_key
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_current = true,
    is_visible = true;

create temporary table _catalog_races_may_2027 (
  event_source_key text not null,
  source_key text primary key,
  slug text not null,
  name text not null,
  series_name text not null,
  race_date date not null,
  location text not null,
  distance_km numeric not null,
  elevation_gain_m numeric,
  source_url text not null,
  participation_mode text not null
) on commit drop;

insert into _catalog_races_may_2027 values
  ('trail-petit-ballon', 'tpb-52-2027', 'trail-du-petit-ballon-52-km-2027',
   'Trail du Petit Ballon 52 km', 'Trail du Petit Ballon 52 km', date '2027-03-14',
   'Rouffach, Haut-Rhin, France', 52, 2100, 'https://www.trailpetitballon.fr/half/', 'solo'),
  ('trail-petit-ballon', 'tpb-42-2027', 'marathon-du-petit-ballon-42-km-2027',
   'Marathon du Petit Ballon 42 km', 'Marathon du Petit Ballon 42 km', date '2027-03-14',
   'Rouffach, Haut-Rhin, France', 42, 1550, 'https://www.trailpetitballon.fr/marathon-du-petit-ballon/', 'solo'),
  ('trail-petit-ballon', 'tpb-23-2027', 'circuit-des-grands-crus-23-km-2027',
   'Circuit des Grands Crus 23 km', 'Circuit des Grands Crus 23 km', date '2027-03-14',
   'Rouffach, Haut-Rhin, France', 23, 750, 'https://www.trailpetitballon.fr/circuit-des-grands-crus/', 'solo'),
  ('trail-petit-ballon', 'tpb-12-2027', 'mini-trail-de-l-ane-12-km-2027',
   'Mini Trail de l’Âne 12 km', 'Mini Trail de l’Âne 12 km', date '2027-03-14',
   'Rouffach, Haut-Rhin, France', 12, 400, 'https://www.trailpetitballon.fr/mini-trail-de-lane/', 'solo'),

  ('grand-trail-cadourques', 'gtc-120-2027', 'grand-trail-des-cadourques-120-km-2027',
   'GTC 120', 'GTC 120', date '2027-04-02', 'Cahors, Lot, France',
   120, 4000, 'https://www.grandtraildescadourques.fr/nos-courses/gtc-120/', 'solo'),
  ('grand-trail-cadourques', 'gtc-65-2027', 'saint-cirq-65-km-2027',
   'Saint-Cirq 65', 'Saint-Cirq 65', date '2027-04-03', 'Vers → Cahors, Lot, France',
   64, 2100, 'https://www.grandtraildescadourques.fr/nos-courses/saint-cirq-65/', 'solo'),
  ('grand-trail-cadourques', 'gtc-30-2027', 'divona-30-km-2027',
   'Divona 30', 'Divona 30', date '2027-04-03', 'Vers → Cahors, Lot, France',
   30, 1000, 'https://www.grandtraildescadourques.fr/nos-courses/divona-30/', 'solo'),
  ('grand-trail-cadourques', 'gtc-12-2027', 'nox-cadurca-12-km-2027',
   'Nox Cadurca 12', 'Nox Cadurca 12', date '2027-04-03', 'Arcambal → Cahors, Lot, France',
   12, 400, 'https://www.grandtraildescadourques.fr/nos-courses/nox-cadurca-12/', 'solo'),

  ('volvic-volcanic-experience', 'vvx-xgtv-2027', 'vvx-xgtv-224-km-2027',
   'Expérience Grande Traversée Volcanique XGTV', 'Expérience Grande Traversée Volcanique XGTV',
   date '2027-05-05', 'Le Lioran → Volvic, France', 224, 8400,
   'https://www.volvic-vvx.com/evenements/lexperience-grande-traversee-volcanic-xgtv/', 'solo_and_relay'),
  ('volvic-volcanic-experience', 'vvx-17-2027', 'vvx-pierre-de-lave-17-km-2027',
   'Expérience Pierre de Lave 17 km', 'Expérience Pierre de Lave 17 km',
   date '2027-05-06', 'Volvic, Puy-de-Dôme, France', 17, null,
   'https://www.volvic-vvx.com/activites/8-trails-en-auvergne-puy-de-dome-france/', 'solo'),
  ('volvic-volcanic-experience', 'vvx-111-2027', 'vvx-chaine-des-puys-111-km-2027',
   'Expérience Chaîne des Puys – Faille de Limagne 111 km', 'Expérience Chaîne des Puys – Faille de Limagne 111 km',
   date '2027-05-07', 'Volvic, Puy-de-Dôme, France', 111, null,
   'https://www.volvic-vvx.com/activites/8-trails-en-auvergne-puy-de-dome-france/', 'solo_and_relay'),
  ('volvic-volcanic-experience', 'vvx-85-2027', 'vvx-terres-volcaniques-85-km-2027',
   'Expérience Terres Volcaniques 85 km', 'Expérience Terres Volcaniques 85 km',
   date '2027-05-07', 'Volvic, Puy-de-Dôme, France', 85, null,
   'https://www.volvic-vvx.com/activites/8-trails-en-auvergne-puy-de-dome-france/', 'solo_and_relay'),
  ('volvic-volcanic-experience', 'vvx-46-2027', 'vvx-impluvium-de-volvic-46-km-2027',
   'Expérience Impluvium de Volvic 46 km', 'Expérience Impluvium de Volvic 46 km',
   date '2027-05-07', 'Volvic, Puy-de-Dôme, France', 46, null,
   'https://www.volvic-vvx.com/activites/8-trails-en-auvergne-puy-de-dome-france/', 'solo'),
  ('volvic-volcanic-experience', 'vvx-26-2027', 'vvx-experience-volcanique-26-km-2027',
   'Expérience Volcanique 26 km', 'Expérience Volcanique 26 km',
   date '2027-05-07', 'Volvic, Puy-de-Dôme, France', 26, null,
   'https://www.volvic-vvx.com/activites/8-trails-en-auvergne-puy-de-dome-france/', 'solo'),
  ('volvic-volcanic-experience', 'vvx-21-2027', 'vvx-run-patrimoine-21-km-2027',
   'Run Patrimoine – Chemin des Batignolles 21 km', 'Run Patrimoine – Chemin des Batignolles 21 km',
   date '2027-05-08', 'Volvic, Puy-de-Dôme, France', 21, null,
   'https://www.volvic-vvx.com/activites/8-trails-en-auvergne-puy-de-dome-france/', 'solo');

do $$
declare
  source record;
  event_id_value uuid;
  edition_id_value uuid;
  series_id_value uuid;
begin
  for source in select * from _catalog_races_may_2027 order by race_date, source_key loop
    select event.id into strict event_id_value
    from public.race_events event
    where event.organizer_details #>> '{catalogSource,sourceKey}' = source.event_source_key;

    select edition.id into strict edition_id_value
    from public.race_event_editions edition
    where edition.event_id = event_id_value
      and edition.edition_year = 2027;

    select race.edition_group_id into series_id_value
    from public.races race
    where race.event_id = event_id_value
      and lower(coalesce(race.series_name, race.name)) = lower(source.series_name)
      and race.edition_group_id is not null
    order by race.race_date desc nulls last
    limit 1;

    series_id_value := coalesce(series_id_value, gen_random_uuid());

    insert into public.races (
      slug, name, location, location_text, distance_km, elevation_gain_m,
      source_url, external_site_url, is_published, is_live, race_date,
      is_public, has_aid_stations, event_id, edition_group_id, series_name,
      edition_id, racebook_is_live, data_status, missing_required_fields,
      participation_mode, organizer_details
    ) values (
      source.slug, source.name, source.location, source.location,
      source.distance_km, source.elevation_gain_m, source.source_url, source.source_url,
      true, true, source.race_date, true, false, event_id_value,
      series_id_value, source.series_name, edition_id_value, false,
      'complete', array[]::text[], source.participation_mode,
      jsonb_build_object('catalogSource', jsonb_build_object(
        'kind', 'official', 'provider', 'organizer',
        'sourceKey', source.source_key, 'verifiedAt', '2026-09-10'
      ))
    )
    on conflict (slug) do update
    set name = excluded.name,
        location = excluded.location,
        location_text = excluded.location_text,
        distance_km = excluded.distance_km,
        elevation_gain_m = coalesce(excluded.elevation_gain_m, public.races.elevation_gain_m),
        source_url = excluded.source_url,
        external_site_url = excluded.external_site_url,
        is_published = true,
        is_live = true,
        race_date = excluded.race_date,
        is_public = true,
        event_id = excluded.event_id,
        edition_group_id = coalesce(public.races.edition_group_id, excluded.edition_group_id),
        series_name = excluded.series_name,
        edition_id = excluded.edition_id,
        data_status = 'complete',
        missing_required_fields = array[]::text[],
        participation_mode = excluded.participation_mode,
        organizer_details = coalesce(public.races.organizer_details, '{}'::jsonb) || excluded.organizer_details,
        updated_at = now();
  end loop;
end $$;

-- Preserve the exact route label of the existing 2026 XGTV format when the
-- parent event anchor is corrected from Le Lioran to Volvic.
update public.races
set location = 'Le Lioran → Volvic, France',
    location_text = 'Le Lioran → Volvic, France',
    source_url = coalesce(source_url, 'https://www.volvic-vvx.com/evenements/lexperience-grande-traversee-volcanic-xgtv/'),
    external_site_url = coalesce(external_site_url, 'https://www.volvic-vvx.com/evenements/lexperience-grande-traversee-volcanic-xgtv/'),
    updated_at = now()
where event_id = (
  select id from public.race_events
  where organizer_details #>> '{catalogSource,sourceKey}' = 'volvic-volcanic-experience'
)
  and extract(year from race_date) = 2026
  and distance_km between 220 and 228;

do $$
declare
  imported_count integer;
  normalized_event_count integer;
begin
  select count(*) into imported_count
  from public.races
  where organizer_details #>> '{catalogSource,sourceKey}' in (
    select source_key from _catalog_races_may_2027
  )
    and is_live
    and is_public
    and data_status = 'complete';

  if imported_count <> (select count(*) from _catalog_races_may_2027) then
    raise exception 'Expected % verified formats, found %',
      (select count(*) from _catalog_races_may_2027), imported_count;
  end if;

  select count(*) into normalized_event_count
  from public.race_events
  where organizer_details #>> '{catalogSource,sourceKey}' in (
    select source_key from _catalog_events_may_2027
  )
    and location_country_code = 'FR'
    and location_city_code is not null
    and location_latitude is not null
    and location_longitude is not null;

  if normalized_event_count <> (select count(*) from _catalog_events_may_2027) then
    raise exception 'Expected % normalized events, found %',
      (select count(*) from _catalog_events_may_2027), normalized_event_count;
  end if;
end $$;

commit;
