begin;

-- Official 2026 source snapshot verified on 2026-11-05 from the ten race
-- pages linked by https://www.saintelyon.com/races/.
do $$
begin
  if not exists (
    select 1 from public.race_events where lower(name) = lower('ASICS SaintéLyon')
  ) then
    raise exception 'ASICS SaintéLyon event is missing';
  end if;
end;
$$;

update public.race_events
set location = 'Saint-Étienne — Lyon',
    website_url = 'https://www.saintelyon.com/',
    race_date = date '2026-11-27',
    is_live = true,
    organizer_details = coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object(
        'officialWebsiteUrl', 'https://www.saintelyon.com/',
        'dateRange', jsonb_build_object('endDate', '2026-11-29'),
        'catalogSource', jsonb_build_object(
          'kind', 'official',
          'verifiedAt', '2026-11-05'
        ),
        'bibPickup', jsonb_build_object(
          'overrideEnabled', true,
          'location', 'Halle Tony Garnier, Lyon',
          'locations', jsonb_build_array(
            jsonb_build_object(
              'location', 'Halle Tony Garnier, Lyon',
              'slots', jsonb_build_array(
                jsonb_build_object('date', '2026-11-27', 'startTime', '12:00', 'endTime', '20:00'),
                jsonb_build_object('date', '2026-11-28', 'startTime', '09:00', 'endTime', '17:00')
              )
            )
          )
        )
      )
where lower(name) = lower('ASICS SaintéLyon');

update public.race_event_editions edition
set is_current = false
from public.race_events event
where edition.event_id = event.id
  and lower(event.name) = lower('ASICS SaintéLyon')
  and edition.edition_year <> 2026
  and edition.is_current;

insert into public.race_event_editions (
  event_id, edition_year, start_date, end_date, is_current, is_visible
)
select id, 2026, date '2026-11-27', date '2026-11-29', true, true
from public.race_events
where lower(name) = lower('ASICS SaintéLyon')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_current = true,
    is_visible = true;

create temporary table _saintelyon_formats (
  slug text primary key,
  name text not null,
  race_date date not null,
  location text not null,
  distance_km numeric not null,
  elevation_gain_m numeric,
  elevation_loss_m numeric not null,
  source_url text not null,
  participation_mode text not null,
  has_aid_stations boolean not null,
  gpx_storage_path text,
  gpx_sha256 text,
  min_alt_m numeric,
  max_alt_m numeric,
  start_lat numeric,
  start_lng numeric,
  bounds_min_lat numeric,
  bounds_min_lng numeric,
  bounds_max_lat numeric,
  bounds_max_lng numeric,
  organizer_details jsonb not null
) on commit drop;

insert into _saintelyon_formats values
  (
    'asics-lyon-saintelyon-160-km-2026',
    'LyonSaintéLyon — 160 km',
    date '2026-11-28',
    'Lyon — Saint-Étienne — Lyon',
    160, 5000, 4631,
    'https://www.saintelyon.com/races/160km-lyon-saintelyon',
    'solo', true,
    'catalog/saintelyon/2026/lyon-saintelyon-160.gpx',
    '08f5fd9b87a6c74eebfca10673fe735f54a108d8ef55869df9f80feb49d0786e',
    165, 925, 45.72988, 4.82482, 45.45007, 4.39361, 45.73365, 4.82483,
    jsonb_build_object(
      'schedule', jsonb_build_object(
        'startTime', '09:00',
        'finishCutoffTime', '16:30',
        'cutoffNote', 'Demi-tour à Saint-Étienne (km 82) avant 22:30.'
      ),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Halle Tony Garnier, Lyon',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', false,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object(
        'overrideEnabled', true,
        'location', 'Halle Tony Garnier, Lyon',
        'locations', jsonb_build_array(
          jsonb_build_object(
            'location', 'Halle Tony Garnier, Lyon',
            'slots', jsonb_build_array(
              jsonb_build_object('date', '2026-11-27', 'startTime', '12:00', 'endTime', '20:00')
            )
          )
        )
      ),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Halle Tony Garnier, Lyon')
    )
  ),
  (
    'asics-saintelyon-80-km-2026',
    'SaintéLyon — 80 km',
    date '2026-11-28',
    'Saint-Étienne — Lyon',
    80, 2500, 2556,
    'https://www.saintelyon.com/races/80km-saintelyon',
    'solo', true,
    'catalog/saintelyon/2026/saintelyon-80.gpx',
    '61463d67e5b8c82744042779e0559b0eb9856ee3d6f99237b5fbc3375f7d4685',
    165, 925, 45.45007, 4.39837, 45.45007, 4.39837, 45.73365, 4.82483,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '23:30', 'finishCutoffTime', '16:00'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Saint-Étienne',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'shuttles', 'Navette Lyon → Saint-Étienne.',
        'shuttleSchedule', '70 avenue Leclerc (Novotel), Lyon : 16:00–19:30.',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', true,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object('overrideEnabled', false),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Saint-Étienne')
    )
  ),
  (
    'asics-saintelyon-relais-2-80-km-2026',
    'SaintéLyon Relais 2 — 80 km',
    date '2026-11-28',
    'Saint-Étienne — Lyon',
    80, 2500, 2556,
    'https://www.saintelyon.com/races/relais-2',
    'relay', true,
    'catalog/saintelyon/2026/saintelyon-80.gpx',
    '61463d67e5b8c82744042779e0559b0eb9856ee3d6f99237b5fbc3375f7d4685',
    165, 925, 45.45007, 4.39837, 45.45007, 4.39837, 45.73365, 4.82483,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '23:30', 'finishCutoffTime', '16:30'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Saint-Étienne',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'shuttles', 'Navettes Lyon → Saint-Étienne, Saint-Étienne → Sainte-Catherine et Sainte-Catherine → Lyon.',
        'shuttleSchedule', 'Lyon : 16:00–19:30 ; Saint-Étienne : 23:40–00:00 ; retour Sainte-Catherine en continu.',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', true,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object('overrideEnabled', false),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Saint-Étienne')
    )
  ),
  (
    'asics-saintelyon-relais-3-80-km-2026',
    'SaintéLyon Relais 3 — 80 km',
    date '2026-11-28',
    'Saint-Étienne — Lyon',
    80, 2500, 2556,
    'https://www.saintelyon.com/races/relais-3',
    'relay', true,
    'catalog/saintelyon/2026/saintelyon-80.gpx',
    '61463d67e5b8c82744042779e0559b0eb9856ee3d6f99237b5fbc3375f7d4685',
    165, 925, 45.45007, 4.39837, 45.45007, 4.39837, 45.73365, 4.82483,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '23:30', 'finishCutoffTime', '16:00'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Saint-Étienne',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'shuttles', 'Navettes Lyon → Saint-Étienne, Saint-Étienne → Sainte-Catherine et Sainte-Catherine → Lyon.',
        'shuttleSchedule', 'Lyon : 16:00–19:30 ; Saint-Étienne : 23:40–00:00 ; retour Sainte-Catherine en continu.',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', true,
          'roadRestrictions', true, 'mapUrl', false, 'runnerInfo', true
        ),
        'roadRestrictions', 'Pas de navette vers Soucieu-en-Jarrest.'
      ),
      'bibPickup', jsonb_build_object('overrideEnabled', false),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Saint-Étienne')
    )
  ),
  (
    'asics-saintelyon-relais-4-80-km-2026',
    'SaintéLyon Relais 4 — 80 km',
    date '2026-11-28',
    'Saint-Étienne — Lyon',
    80, 2500, 2556,
    'https://www.saintelyon.com/races/relais-4',
    'relay', true,
    'catalog/saintelyon/2026/saintelyon-80.gpx',
    '61463d67e5b8c82744042779e0559b0eb9856ee3d6f99237b5fbc3375f7d4685',
    165, 925, 45.45007, 4.39837, 45.45007, 4.39837, 45.73365, 4.82483,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '23:30', 'finishCutoffTime', '16:30'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Saint-Étienne',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'shuttles', 'Navettes Lyon → Saint-Étienne, Saint-Étienne → Sainte-Catherine et Sainte-Catherine → Lyon.',
        'shuttleSchedule', 'Lyon : 16:00–19:30 ; Saint-Étienne : 23:40–00:00 ; retour Sainte-Catherine en continu.',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', true,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object('overrideEnabled', false),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Saint-Étienne')
    )
  ),
  (
    'asics-saintexpress-45-km-2026',
    'SaintExpress — 46 km',
    date '2026-11-28',
    'Sainte-Catherine — Lyon',
    46, 1200, 1519,
    'https://www.saintelyon.com/races/saintexpress',
    'solo', true,
    'catalog/saintelyon/2026/saintexpress-46.gpx',
    'be5c8180b359279bf9b4dc04d6fccfff152bc014c8063a537a88af9da4b4ec5d',
    164, 862, 45.59617, 4.57011, 45.59617, 4.56929, 45.73367, 4.82484,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '23:00', 'finishCutoffTime', '16:30'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Sainte-Catherine',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'shuttles', 'Navette Lyon → Sainte-Catherine.',
        'shuttleSchedule', 'Rue Alexander Fleming, Lyon : 20:00–21:00.',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', true,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object('overrideEnabled', false),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Sainte-Catherine')
    )
  ),
  (
    'asics-saintevia-35-km-2026',
    'SaintéVia — 36 km',
    date '2026-11-28',
    'Mornant — Lyon',
    36, 700, 619,
    'https://www.saintelyon.com/races/saintevia',
    'solo', true,
    'catalog/saintelyon/2026/saintevia-36.gpx',
    'bcaa42546aa3a99c13e449a814d350ebf770dda55f524b6f0f34c97cff1adbed',
    164, 439, 45.61902, 4.66770, 45.61601, 4.66536, 45.73365, 4.82417,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '22:30', 'finishCutoffTime', '16:30'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Mornant',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'shuttles', 'Navette Lyon → Mornant.',
        'shuttleSchedule', 'Boulevard Yves Farges, Lyon : 20:30–20:45.',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', true,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object('overrideEnabled', false),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Mornant')
    )
  ),
  (
    'asics-saintesprint-24-km-2026',
    'SaintéSprint — 25 km',
    date '2026-11-28',
    'Soucieu-en-Jarrest — Lyon',
    25, 470, 589,
    'https://www.saintelyon.com/races/saintesprint',
    'solo', true,
    'catalog/saintelyon/2026/saintesprint-25.gpx',
    '78ee0e9f69832a3cc89078ae3b994611a8a357f5268ff8f56e359232302a82cd',
    164, 367, 45.67678, 4.70170, 45.67457, 4.67185, 45.73366, 4.82481,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '22:45', 'finishCutoffTime', '16:30'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Soucieu-en-Jarrest',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'shuttles', 'Navette Lyon → Soucieu-en-Jarrest.',
        'shuttleSchedule', 'Station AVIA, 44 avenue Leclerc, Lyon : 21:15–21:30.',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', true,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object('overrideEnabled', false),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Soucieu-en-Jarrest')
    )
  ),
  (
    'asics-saintetic-13-km-2026',
    'SaintéTic — 13 km',
    date '2026-11-28',
    'Chaponost — Lyon',
    13, 280, 374,
    'https://www.saintelyon.com/races/saintetic',
    'solo', false,
    'catalog/saintelyon/2026/saintetic-13.gpx',
    '24af8d966cf7bf35476efe1d6aa1ce839c6b84966aab417801ccf93807665dbf',
    164, 319, 45.70815, 4.73589, 45.70474, 4.73589, 45.73363, 4.82473,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '22:30', 'finishCutoffTime', '16:30'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Chaponost',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'shuttles', 'Navette Lyon → Chaponost.',
        'shuttleSchedule', '70 avenue Leclerc (Novotel), Lyon : 21:00–21:15.',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', true,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object('overrideEnabled', false),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Chaponost')
    )
  ),
  (
    'asics-saintegones-0-5-3-km-2026',
    'SaintéGones — 0,5 à 3 km',
    date '2026-11-27',
    'Lyon — Halle Tony Garnier',
    3, null, 0,
    'https://www.saintelyon.com/races/saintegones',
    'solo', false,
    null, null,
    null, null, null, null, null, null, null, null,
    jsonb_build_object(
      'schedule', jsonb_build_object('startTime', '18:00'),
      'access', jsonb_build_object(
        'overrideEnabled', true,
        'startAddress', 'Halle Tony Garnier, Lyon',
        'finishAddress', 'Halle Tony Garnier, Lyon',
        'enabledSections', jsonb_build_object(
          'officialParkings', false, 'shuttles', false,
          'roadRestrictions', false, 'mapUrl', false, 'runnerInfo', true
        )
      ),
      'bibPickup', jsonb_build_object(
        'overrideEnabled', true,
        'location', 'Halle Tony Garnier, Lyon',
        'locations', jsonb_build_array(
          jsonb_build_object(
            'location', 'Halle Tony Garnier, Lyon',
            'slots', jsonb_build_array(
              jsonb_build_object('date', '2026-11-27', 'startTime', '12:00', 'endTime', '18:00')
            )
          )
        )
      ),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', false),
      'runnerInfo', jsonb_build_object('startArea', 'Halle Tony Garnier, Lyon')
    )
  );

insert into public.races (
  slug, name, series_name, edition_group_id, event_id, edition_id,
  location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, gpx_path, gpx_hash, gpx_storage_path, gpx_sha256,
  min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng,
  race_date, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, has_aid_stations,
  data_status, missing_required_fields, participation_mode, organizer_details
)
select
  source.slug,
  source.name,
  source.name,
  gen_random_uuid(),
  event.id,
  edition.id,
  source.location,
  source.location,
  source.distance_km,
  source.elevation_gain_m,
  source.elevation_loss_m,
  source.source_url,
  source.source_url,
  source.gpx_storage_path,
  source.gpx_sha256,
  source.gpx_storage_path,
  source.gpx_sha256,
  source.min_alt_m,
  source.max_alt_m,
  source.start_lat,
  source.start_lng,
  source.bounds_min_lat,
  source.bounds_min_lng,
  source.bounds_max_lat,
  source.bounds_max_lng,
  source.race_date,
  true, true, true, true, true, false,
  source.has_aid_stations,
  'complete',
  array[]::text[],
  source.participation_mode,
  source.organizer_details
from _saintelyon_formats source
join public.race_events event on lower(event.name) = lower('ASICS SaintéLyon')
join public.race_event_editions edition
  on edition.event_id = event.id and edition.edition_year = 2026
on conflict (slug) do update set
  name = excluded.name,
  series_name = excluded.series_name,
  event_id = excluded.event_id,
  edition_id = excluded.edition_id,
  location = excluded.location,
  location_text = excluded.location_text,
  distance_km = excluded.distance_km,
  elevation_gain_m = excluded.elevation_gain_m,
  elevation_loss_m = excluded.elevation_loss_m,
  source_url = excluded.source_url,
  external_site_url = excluded.external_site_url,
  gpx_path = excluded.gpx_path,
  gpx_hash = excluded.gpx_hash,
  gpx_storage_path = excluded.gpx_storage_path,
  gpx_sha256 = excluded.gpx_sha256,
  min_alt_m = excluded.min_alt_m,
  max_alt_m = excluded.max_alt_m,
  start_lat = excluded.start_lat,
  start_lng = excluded.start_lng,
  bounds_min_lat = excluded.bounds_min_lat,
  bounds_min_lng = excluded.bounds_min_lng,
  bounds_max_lat = excluded.bounds_max_lat,
  bounds_max_lng = excluded.bounds_max_lng,
  race_date = excluded.race_date,
  is_published = excluded.is_published,
  is_live = excluded.is_live,
  is_public = excluded.is_public,
  web_catalog_is_live = excluded.web_catalog_is_live,
  racebook_preview_is_visible = excluded.racebook_preview_is_visible,
  racebook_is_live = excluded.racebook_is_live,
  has_aid_stations = excluded.has_aid_stations,
  data_status = excluded.data_status,
  missing_required_fields = excluded.missing_required_fields,
  participation_mode = excluded.participation_mode,
  organizer_details = excluded.organizer_details;

create temporary table _saintelyon_stations (
  race_slug text not null,
  name text not null,
  km numeric not null,
  station_type text not null,
  water_available boolean not null,
  solid_available boolean not null,
  cutoff_time text,
  order_index integer not null,
  primary key (race_slug, order_index)
) on commit drop;

insert into _saintelyon_stations values
  ('asics-lyon-saintelyon-160-km-2026', 'Soucieu-en-Jarrest (aller)', 19, 'solid', true, true, '12:15', 0),
  ('asics-lyon-saintelyon-160-km-2026', 'Sainte-Catherine (aller)', 47, 'solid', true, true, '17:00', 1),
  ('asics-lyon-saintelyon-160-km-2026', 'Saint-Christo-en-Jarez (aller)', 62, 'solid', true, true, '19:30', 2),
  -- The organizer publishes return kilometers relative to the km 82 turnaround.
  ('asics-lyon-saintelyon-160-km-2026', 'Saint-Christo-en-Jarez (retour)', 99, 'solid', true, true, '04:00', 3),
  ('asics-lyon-saintelyon-160-km-2026', 'Sainte-Catherine (retour)', 114, 'solid', true, true, '07:00', 4),
  ('asics-lyon-saintelyon-160-km-2026', 'Saint-Genou - Le Camp (retour)', 128, 'water', true, false, '09:30', 5),
  ('asics-lyon-saintelyon-160-km-2026', 'Soucieu-en-Jarrest (retour)', 142, 'solid', true, true, '12:00', 6),
  ('asics-lyon-saintelyon-160-km-2026', 'Chaponost (retour)', 149, 'solid', true, true, '13:30', 7),
  ('asics-saintelyon-80-km-2026', 'Saint-Christo-en-Jarez', 17, 'solid', true, true, '04:00', 0),
  ('asics-saintelyon-80-km-2026', 'Sainte-Catherine by La Région', 32, 'solid', true, true, '07:00', 1),
  ('asics-saintelyon-80-km-2026', 'Saint-Genou - Le Camp', 46, 'water', true, false, '09:30', 2),
  ('asics-saintelyon-80-km-2026', 'Soucieu-en-Jarrest', 60, 'solid', true, true, '12:00', 3),
  ('asics-saintelyon-80-km-2026', 'Chaponost', 67, 'solid', true, true, '13:30', 4),
  ('asics-saintelyon-relais-2-80-km-2026', 'Saint-Christo-en-Jarez', 17, 'solid', true, true, '04:00', 0),
  ('asics-saintelyon-relais-2-80-km-2026', 'Sainte-Catherine by La Région', 32, 'solid', true, true, '07:00', 1),
  ('asics-saintelyon-relais-2-80-km-2026', 'Saint-Genou - Le Camp', 46, 'water', true, false, '09:30', 2),
  ('asics-saintelyon-relais-2-80-km-2026', 'Soucieu-en-Jarrest', 60, 'solid', true, true, '12:00', 3),
  ('asics-saintelyon-relais-2-80-km-2026', 'Chaponost', 67, 'solid', true, true, '13:30', 4),
  ('asics-saintelyon-relais-3-80-km-2026', 'Saint-Christo-en-Jarez', 17, 'solid', true, true, '04:00', 0),
  ('asics-saintelyon-relais-3-80-km-2026', 'Sainte-Catherine by La Région', 32, 'solid', true, true, '07:00', 1),
  ('asics-saintelyon-relais-3-80-km-2026', 'Saint-Genou - Le Camp', 46, 'water', true, false, '09:30', 2),
  ('asics-saintelyon-relais-3-80-km-2026', 'Soucieu-en-Jarrest', 60, 'solid', true, true, '12:00', 3),
  ('asics-saintelyon-relais-3-80-km-2026', 'Chaponost', 67, 'solid', true, true, '13:30', 4),
  ('asics-saintelyon-relais-4-80-km-2026', 'Saint-Christo-en-Jarez', 17, 'solid', true, true, '04:00', 0),
  ('asics-saintelyon-relais-4-80-km-2026', 'Sainte-Catherine by La Région', 32, 'solid', true, true, '07:00', 1),
  ('asics-saintelyon-relais-4-80-km-2026', 'Saint-Genou - Le Camp', 46, 'water', true, false, '09:30', 2),
  ('asics-saintelyon-relais-4-80-km-2026', 'Soucieu-en-Jarrest', 60, 'solid', true, true, '12:00', 3),
  ('asics-saintelyon-relais-4-80-km-2026', 'Chaponost', 67, 'solid', true, true, '13:30', 4),
  ('asics-saintexpress-45-km-2026', 'Saint-Genou - Le Camp', 12, 'water', true, false, null, 0),
  ('asics-saintexpress-45-km-2026', 'Soucieu-en-Jarrest', 26, 'solid', true, true, null, 1),
  ('asics-saintexpress-45-km-2026', 'Chaponost', 33, 'solid', true, true, null, 2),
  ('asics-saintevia-35-km-2026', 'Soucieu-en-Jarrest', 15, 'other', true, true, null, 0),
  ('asics-saintevia-35-km-2026', 'Chaponost', 22, 'other', true, true, null, 1),
  ('asics-saintesprint-24-km-2026', 'Chaponost', 11, 'solid', true, true, null, 0);

insert into public.race_aid_stations (
  race_id, name, km, water_available, solid_available,
  assistance_allowed, notes, order_index, organizer_details
)
select
  race.id,
  source.name,
  source.km,
  source.water_available,
  source.solid_available,
  false,
  null,
  source.order_index,
  jsonb_build_object(
    'stationType', source.station_type,
    'cutoffTime', source.cutoff_time,
    'dropBagAvailable', false
  )
from _saintelyon_stations source
join public.races race on race.slug = source.race_slug
where not exists (
  select 1
  from public.race_aid_stations existing
  where existing.race_id = race.id and existing.order_index = source.order_index
);

update public.race_aid_stations station
set name = source.name,
    km = source.km,
    water_available = source.water_available,
    solid_available = source.solid_available,
    assistance_allowed = false,
    notes = null,
    organizer_details = jsonb_build_object(
      'stationType', source.station_type,
      'cutoffTime', source.cutoff_time,
      'dropBagAvailable', false
    )
from _saintelyon_stations source
join public.races race on race.slug = source.race_slug
where station.race_id = race.id
  and station.order_index = source.order_index;

create temporary table _saintelyon_relay_points (
  race_slug text not null,
  name text not null,
  km numeric not null,
  cutoff_time text,
  order_index integer not null,
  primary key (race_slug, order_index)
) on commit drop;

insert into _saintelyon_relay_points values
  ('asics-saintelyon-relais-2-80-km-2026', 'Sainte-Catherine', 31.8, '07:00', 0),
  ('asics-saintelyon-relais-3-80-km-2026', 'Sainte-Catherine', 31.8, '07:00', 0),
  ('asics-saintelyon-relais-3-80-km-2026', 'Soucieu-en-Jarrest', 60, '12:00', 1),
  ('asics-saintelyon-relais-4-80-km-2026', 'Saint-Christo-en-Jarez', 17, '04:00', 0),
  ('asics-saintelyon-relais-4-80-km-2026', 'Sainte-Catherine', 31.8, '07:00', 1),
  ('asics-saintelyon-relais-4-80-km-2026', 'Soucieu-en-Jarrest', 60, '12:00', 2);

insert into public.race_relay_points (
  race_id, race_aid_station_id, name, km,
  handover_time, cutoff_time, notes, order_index
)
select
  race.id,
  (
    select station.id
    from public.race_aid_stations station
    where station.race_id = race.id
    order by abs(station.km - source.km), station.order_index
    limit 1
  ),
  source.name,
  source.km,
  null,
  source.cutoff_time,
  null,
  source.order_index
from _saintelyon_relay_points source
join public.races race on race.slug = source.race_slug
where not exists (
  select 1
  from public.race_relay_points existing
  where existing.race_id = race.id and existing.order_index = source.order_index
);

update public.race_relay_points point
set race_aid_station_id = (
      select station.id
      from public.race_aid_stations station
      where station.race_id = race.id
      order by abs(station.km - source.km), station.order_index
      limit 1
    ),
    name = source.name,
    km = source.km,
    handover_time = null,
    cutoff_time = source.cutoff_time,
    notes = null
from _saintelyon_relay_points source
join public.races race on race.slug = source.race_slug
where point.race_id = race.id
  and point.order_index = source.order_index;

do $$
declare
  event_row public.race_events%rowtype;
  format_count integer;
  gpx_format_count integer;
  station_count integer;
  relay_point_count integer;
begin
  select * into strict event_row
  from public.race_events
  where lower(name) = lower('ASICS SaintéLyon');

  select count(*) into format_count
  from public.races
  where event_id = event_row.id
    and slug in (select slug from _saintelyon_formats)
    and data_status = 'complete'
    and is_live
    and is_public
    and web_catalog_is_live;

  if format_count <> 10 then
    raise exception 'Expected 10 complete SaintéLyon formats, found %', format_count;
  end if;

  select count(*) into gpx_format_count
  from public.races
  where event_id = event_row.id
    and slug in (select slug from _saintelyon_formats where gpx_storage_path is not null)
    and gpx_storage_path is not null
    and gpx_sha256 is not null;

  if gpx_format_count <> 9 then
    raise exception 'Expected 9 SaintéLyon formats with official GPX, found %', gpx_format_count;
  end if;

  select count(*) into station_count
  from public.race_aid_stations station
  join public.races race on race.id = station.race_id
  where race.event_id = event_row.id
    and race.slug in (select slug from _saintelyon_formats);

  if station_count <> 34 then
    raise exception 'Expected 34 structured SaintéLyon aid stations, found %', station_count;
  end if;

  select count(*) into relay_point_count
  from public.race_relay_points point
  join public.races race on race.id = point.race_id
  where race.event_id = event_row.id
    and race.slug in (select slug from _saintelyon_relay_points);

  if relay_point_count <> 6 then
    raise exception 'Expected 6 structured SaintéLyon relay points, found %', relay_point_count;
  end if;
end;
$$;

commit;
