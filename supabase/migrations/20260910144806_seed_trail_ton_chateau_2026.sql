begin;

-- Verified on 2026-09-10 from the organizer website, the Morvan Oxygène
-- event page, the official 2026 regulation and the four downloadable GPX
-- files. The regulation PDF still contains a stale 2025 date in article 1;
-- the 2026 organizer page and registration destination agree on 2026-09-19.

do $$
begin
  if exists (
    select 1
    from public.race_events
    where (
      lower(name) = lower('Trail Ton Château')
      or website_url ilike '%trailtonchateau.fr%'
    )
      and id <> '84c2f901-3fe9-4580-a649-bfceaaa27af0'::uuid
  ) then
    raise exception 'Trail Ton Château already exists under another event id; refusing to create a duplicate.';
  end if;

  if exists (
    select 1
    from public.races
    where slug in (
      'trail-ton-chateau-2026-premiers-remparts-8-km',
      'trail-ton-chateau-2026-au-fil-de-leau-16-km',
      'trail-ton-chateau-2026-il-etait-une-fois-24-km',
      'trail-ton-chateau-2026-la-grande-epopee-34-km',
      'trail-ton-chateau-2026-rando-degustation-tacot-8-km',
      'trail-ton-chateau-2026-rando-degustation-villemolin-16-km',
      'trail-ton-chateau-2026-kid-run-500-m',
      'trail-ton-chateau-2026-kid-run-1-2-km'
    )
      and id not in (
        'f6f5a733-77ed-4d3d-808b-38dafe3070ef'::uuid,
        'ad6ccb63-cdef-48b9-b412-fcb4f59a48d0'::uuid,
        '69cffe8e-c45a-4db1-89b6-389eb938f968'::uuid,
        '42b79d67-7975-4932-b53d-5da36e78f7e5'::uuid,
        'c7269a0f-59cd-40dc-af7b-b5e8423a6d72'::uuid,
        '8a7279d9-2d6e-49b6-8096-670d169ace9c'::uuid,
        '8a96f98a-4911-4552-898b-faa14637e2ea'::uuid,
        '033142e8-7327-4db8-bd8a-ca44654847ff'::uuid
      )
  ) then
    raise exception 'A Trail Ton Château slug is already assigned to another race.';
  end if;
end;
$$;

insert into public.race_events (
  id,
  name,
  location,
  description,
  website_url,
  logo_url,
  race_date,
  is_live,
  thumbnail_url,
  organizer_details,
  location_city,
  location_city_code,
  location_department,
  location_department_code,
  location_region,
  location_region_code,
  location_country,
  location_country_code,
  location_latitude,
  location_longitude
)
values (
  '84c2f901-3fe9-4580-a649-bfceaaa27af0',
  'Trail Ton Château',
  'Corbigny, Nièvre, Bourgogne-Franche-Comté, France',
  'Un trail entre chemins ruraux, canal du Nivernais, forêts et châteaux, organisé à Corbigny pendant les Journées européennes du patrimoine.',
  'https://www.trailtonchateau.fr/',
  'https://static.wixstatic.com/media/6f599c_1069e1d79ef44f7281a921aa9bdbaa10~mv2.png',
  date '2026-09-19',
  true,
  'https://morvanoxygene.fr/wp-content/uploads/2026/07/Morvan-Oxygene-Trail-Ton-Chateau-2025-11-1200x600.jpg',
  jsonb_build_object(
    'officialWebsiteUrl', 'https://www.trailtonchateau.fr/',
    'instagramUrl', 'https://www.instagram.com/trail_evasion_corbigny58/',
    'facebookUrl', 'https://www.facebook.com/profile.php?id=61555206569553',
    'dateRange', jsonb_build_object('endDate', '2026-09-19'),
    'eventLocation', jsonb_build_object(
      'label', 'Abbaye de Corbigny, rue de l''Abbaye, 58800 Corbigny',
      'lat', 47.25902,
      'lng', 3.68357,
      'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=47.25902%2C3.68357',
      'source', 'manual'
    ),
    'access', jsonb_build_object(
      'overrideEnabled', false,
      'startAddress', 'Abbaye de Corbigny, rue de l''Abbaye, 58800 Corbigny',
      'startLocation', jsonb_build_object(
        'label', 'Abbaye de Corbigny',
        'lat', 47.25902,
        'lng', 3.68357,
        'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=47.25902%2C3.68357',
        'source', 'manual'
      ),
      'finishAddress', 'Abbaye de Corbigny, rue de l''Abbaye, 58800 Corbigny',
      'finishLocation', jsonb_build_object(
        'label', 'Abbaye de Corbigny',
        'lat', 47.25902,
        'lng', 3.68357,
        'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=47.25902%2C3.68357',
        'source', 'manual'
      ),
      'mapUrl', 'https://www.google.com/maps/search/?api=1&query=47.25902%2C3.68357',
      'note', 'Départ et arrivée à l''Abbaye de Corbigny.',
      'enabledSections', jsonb_build_object(
        'officialParkings', false,
        'shuttles', false,
        'roadRestrictions', false,
        'mapUrl', true,
        'runnerInfo', true
      )
    ),
    'services', jsonb_build_object(
      'supporters', 'Les proches peuvent encourager les participants et profiter des animations proposées à l''Abbaye de Corbigny.',
      'restaurants', 'Buvette et restauration morvandelle annoncées sur le village de l''événement.',
      'recovery', 'Ravitaillement liquide et solide à l''arrivée, avec une boisson offerte selon le format.',
      'note', 'Musique, expositions et visites insolites complètent la journée autour du patrimoine local.'
    ),
    'catalogSource', jsonb_build_object(
      'provider', 'organizer',
      'verifiedAt', '2026-09-10',
      'regulationUrl', 'https://morvanoxygene.fr/wp-content/uploads/2026/07/Reglement-Trail-ton-Chateau-2026.pdf'
    )
  ),
  'Corbigny',
  '58083',
  'Nièvre',
  '58',
  'Bourgogne-Franche-Comté',
  '27',
  'France',
  'FR',
  47.25902,
  3.68357
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  description = excluded.description,
  website_url = excluded.website_url,
  logo_url = excluded.logo_url,
  race_date = excluded.race_date,
  is_live = excluded.is_live,
  thumbnail_url = excluded.thumbnail_url,
  organizer_details = excluded.organizer_details,
  location_city = excluded.location_city,
  location_city_code = excluded.location_city_code,
  location_department = excluded.location_department,
  location_department_code = excluded.location_department_code,
  location_region = excluded.location_region,
  location_region_code = excluded.location_region_code,
  location_country = excluded.location_country,
  location_country_code = excluded.location_country_code,
  location_latitude = excluded.location_latitude,
  location_longitude = excluded.location_longitude;

insert into public.race_event_editions (
  id,
  event_id,
  edition_year,
  start_date,
  end_date,
  is_current,
  is_visible
)
values (
  'e1a49881-dc73-41c0-b39c-c7a1df536aab',
  '84c2f901-3fe9-4580-a649-bfceaaa27af0',
  2026,
  date '2026-09-19',
  date '2026-09-19',
  true,
  true
)
on conflict (id) do update set
  event_id = excluded.event_id,
  edition_year = excluded.edition_year,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_current = excluded.is_current,
  is_visible = excluded.is_visible;

with formats (
  id,
  slug,
  name,
  distance_km,
  elevation_gain_m,
  elevation_loss_m,
  source_url,
  start_time,
  finish_cutoff_time,
  schedule_note,
  rules,
  gpx_storage_path,
  gpx_sha256,
  min_alt_m,
  max_alt_m,
  start_lat,
  start_lng,
  bounds_min_lat,
  bounds_min_lng,
  bounds_max_lat,
  bounds_max_lng
) as (
  values
    (
      'f6f5a733-77ed-4d3d-808b-38dafe3070ef'::uuid,
      'trail-ton-chateau-2026-premiers-remparts-8-km',
      'Premiers Remparts – Trail 8 km',
      8::numeric,
      140::numeric,
      154.7::numeric,
      'https://www.trailtonchateau.fr/trail-8km',
      '10:00',
      null::text,
      'Un point d''eau sur le parcours, puis un ravitaillement liquide et solide à l''arrivée. Pas de barrière horaire.',
      'À partir de 16 ans. Licence FFA course à pied ou attestation PPS valide requise. Parcours roulant par le Bois du Moulin, l''ancienne route du tacot et le château de Chitry-les-Mines.',
      'catalog/trail-ton-chateau/2026/trail-8-km.gpx',
      'e56ed33978859c4ae997a844a3732d561b0af400269692a7aea6e45a38d10b01',
      194.6::numeric, 259.5::numeric, 47.25902::numeric, 3.68357::numeric,
      47.25372::numeric, 3.65035::numeric, 47.26622::numeric, 3.68366::numeric
    ),
    (
      'ad6ccb63-cdef-48b9-b412-fcb4f59a48d0'::uuid,
      'trail-ton-chateau-2026-au-fil-de-leau-16-km',
      'Au fil de l''eau – Trail 16 km',
      16::numeric,
      220::numeric,
      213.8::numeric,
      'https://www.trailtonchateau.fr/trail-16km',
      '09:30',
      null::text,
      'Un point d''eau et un ravitaillement liquide et solide sur le parcours, puis un ravitaillement à l''arrivée. Pas de barrière horaire.',
      'À partir de 18 ans. Licence FFA course à pied ou attestation PPS valide requise. Parcours par Chitry-les-Mines, le canal du Nivernais, la maison de Jules Renard et le château de La Chaise.',
      'catalog/trail-ton-chateau/2026/trail-16-km.gpx',
      '0335f36de6d61bbb1ff5001536a7fd3d52694229b457a4261104f6b60c5b47e6',
      192.8::numeric, 260::numeric, 47.25902::numeric, 3.68357::numeric,
      47.22571::numeric, 3.65035::numeric, 47.26622::numeric, 3.69455::numeric
    ),
    (
      '69cffe8e-c45a-4db1-89b6-389eb938f968'::uuid,
      'trail-ton-chateau-2026-il-etait-une-fois-24-km',
      'Il était une fois – Trail 24 km',
      24::numeric,
      350::numeric,
      361.4::numeric,
      'https://www.trailtonchateau.fr/trail-24km',
      '09:00',
      null::text,
      'Deux points d''eau et un ravitaillement liquide et solide sur le parcours, puis un ravitaillement à l''arrivée. Pas de barrière horaire.',
      'À partir de 18 ans. Licence FFA course à pied ou attestation PPS valide requise. Parcours par Chitry-les-Mines, La Chaise, le hameau des Granges, le Bois de Charme et le château de Lantilly.',
      'catalog/trail-ton-chateau/2026/trail-24-km.gpx',
      'f0e51a750ea0e03e57f4d9edb19bb12daace5581c4a74cd4388fdbc705fcf2eb',
      192.8::numeric, 268.4::numeric, 47.25902::numeric, 3.68357::numeric,
      47.22571::numeric, 3.65035::numeric, 47.2682::numeric, 3.72048::numeric
    ),
    (
      '42b79d67-7975-4932-b53d-5da36e78f7e5'::uuid,
      'trail-ton-chateau-2026-la-grande-epopee-34-km',
      'La Grande Épopée – Trail 34 km',
      34::numeric,
      500::numeric,
      550.8::numeric,
      'https://www.trailtonchateau.fr/trail-32km',
      '08:30',
      null::text,
      'Deux points d''eau et deux ravitaillements liquide et solide sur le parcours, puis un ravitaillement à l''arrivée. Barrière horaire annoncée à 14:00 ; son emplacement n''est pas publié.',
      'À partir de 20 ans. Licence FFA course à pied ou attestation PPS valide requise. La page organisateur 2026, le règlement et le GPX annoncent 34 km malgré l''ancienne adresse de page « trail-32km ».',
      'catalog/trail-ton-chateau/2026/trail-34-km.gpx',
      'fbf86b3303f152cec979ec8c8f48f901f0393bb254210eb77340028126ef2b74',
      189.4::numeric, 274.9::numeric, 47.25902::numeric, 3.68357::numeric,
      47.22571::numeric, 3.65035::numeric, 47.28753::numeric, 3.74461::numeric
    ),
    (
      'c7269a0f-59cd-40dc-af7b-b5e8423a6d72'::uuid,
      'trail-ton-chateau-2026-rando-degustation-tacot-8-km',
      'Rando-dégustation du Tacot – 8 km',
      8::numeric,
      140::numeric,
      0::numeric,
      'https://www.trailtonchateau.fr/randos',
      null::text,
      null::text,
      'Ravitaillement liquide et solide à l''arrivée, avec une boisson offerte.',
      'Randonnée pédestre calme et ombragée par le Bois du Moulin, l''ancienne route du tacot et le château de Chitry-les-Mines. Tarif officiel 2026 : 25 €.',
      null::text, null::text,
      null::numeric, null::numeric, null::numeric, null::numeric,
      null::numeric, null::numeric, null::numeric, null::numeric
    ),
    (
      '8a7279d9-2d6e-49b6-8096-670d169ace9c'::uuid,
      'trail-ton-chateau-2026-rando-degustation-villemolin-16-km',
      'Rando-dégustation de Villemolin – 16 km',
      16::numeric,
      220::numeric,
      0::numeric,
      'https://www.trailtonchateau.fr/randos',
      '08:00',
      null::text,
      'Départ libre entre 08:00 et 10:00. Un ravitaillement liquide en chemin, puis un ravitaillement liquide et solide à l''arrivée avec une boisson offerte.',
      'Randonnée pédestre ombragée par les bocages, les pâturages, le village d''Auxois et le château de Villemolin. Tarif officiel 2026 : 30 €.',
      null::text, null::text,
      null::numeric, null::numeric, null::numeric, null::numeric,
      null::numeric, null::numeric, null::numeric, null::numeric
    ),
    (
      '8a96f98a-4911-4552-898b-faa14637e2ea'::uuid,
      'trail-ton-chateau-2026-kid-run-500-m',
      'Kid Run 4–6 ans – 500 m',
      0.5::numeric,
      15::numeric,
      0::numeric,
      'https://www.trailtonchateau.fr/kids-run',
      '11:30',
      null::text,
      null::text,
      'Course ludique de 500 m autour de l''Abbaye de Corbigny, réservée aux enfants de 4 à 6 ans. Tarif officiel 2026 : 2 €.',
      null::text, null::text,
      null::numeric, null::numeric, null::numeric, null::numeric,
      null::numeric, null::numeric, null::numeric, null::numeric
    ),
    (
      '033142e8-7327-4db8-bd8a-ca44654847ff'::uuid,
      'trail-ton-chateau-2026-kid-run-1-2-km',
      'Kid Run 7–11 ans – 1,2 km',
      1.2::numeric,
      30::numeric,
      0::numeric,
      'https://www.trailtonchateau.fr/kids-run',
      '11:45',
      null::text,
      null::text,
      'Course ludique de 1,2 km autour de l''Abbaye de Corbigny, réservée aux enfants de 7 à 11 ans. Tarif officiel 2026 : 2 €.',
      null::text, null::text,
      null::numeric, null::numeric, null::numeric, null::numeric,
      null::numeric, null::numeric, null::numeric, null::numeric
    )
)
insert into public.races (
  id,
  slug,
  name,
  series_name,
  edition_group_id,
  event_id,
  edition_id,
  location,
  location_text,
  distance_km,
  elevation_gain_m,
  elevation_loss_m,
  source_url,
  external_site_url,
  image_url,
  thumbnail_url,
  gpx_path,
  gpx_hash,
  gpx_storage_path,
  gpx_sha256,
  min_alt_m,
  max_alt_m,
  start_lat,
  start_lng,
  bounds_min_lat,
  bounds_min_lng,
  bounds_max_lat,
  bounds_max_lng,
  race_date,
  is_published,
  is_live,
  is_public,
  has_aid_stations,
  racebook_is_live,
  data_status,
  missing_required_fields,
  participation_mode,
  notes,
  organizer_details
)
select
  formats.id,
  formats.slug,
  formats.name,
  formats.name,
  formats.id,
  '84c2f901-3fe9-4580-a649-bfceaaa27af0'::uuid,
  'e1a49881-dc73-41c0-b39c-c7a1df536aab'::uuid,
  'Corbigny, Nièvre, Bourgogne-Franche-Comté, France',
  'Abbaye de Corbigny, rue de l''Abbaye, 58800 Corbigny',
  formats.distance_km,
  formats.elevation_gain_m,
  formats.elevation_loss_m,
  formats.source_url,
  'https://in.yaka-inscription.com/trail-ton-chateau-2026',
  'https://morvanoxygene.fr/wp-content/uploads/2026/07/Morvan-Oxygene-Trail-Ton-Chateau-2025-11-1200x600.jpg',
  'https://morvanoxygene.fr/wp-content/uploads/2026/07/Morvan-Oxygene-Trail-Ton-Chateau-2025-11-1200x600.jpg',
  formats.gpx_storage_path,
  formats.gpx_sha256,
  formats.gpx_storage_path,
  formats.gpx_sha256,
  formats.min_alt_m,
  formats.max_alt_m,
  formats.start_lat,
  formats.start_lng,
  formats.bounds_min_lat,
  formats.bounds_min_lng,
  formats.bounds_max_lat,
  formats.bounds_max_lng,
  date '2026-09-19',
  true,
  true,
  true,
  false,
  false,
  'complete',
  array[]::text[],
  'solo',
  'Sources vérifiées le 10 septembre 2026 : site officiel Trail Ton Château, page organisateur Morvan Oxygène, règlement 2026 et, pour les quatre trails, GPX officiels.',
  jsonb_build_object(
    'raceLocation', jsonb_build_object(
      'label', 'Abbaye de Corbigny, rue de l''Abbaye, 58800 Corbigny',
      'lat', 47.25902,
      'lng', 3.68357,
      'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=47.25902%2C3.68357',
      'source', 'manual'
    ),
    'schedule', jsonb_build_object(
      'startTime', formats.start_time,
      'finishCutoffTime', formats.finish_cutoff_time,
      'shuttleSchedule', null,
      'cutoffNote', formats.schedule_note,
      'note', 'Retirer son dossard au plus tard 10 minutes avant le départ afin de ne pas perturber l''organisation.'
    ),
    'mandatoryEquipment', jsonb_build_object(
      'overrideEnabled', false,
      'weatherPlan', 'normal',
      'items', jsonb_build_array(),
      'note', null
    ),
    'bibPickup', jsonb_build_object('overrideEnabled', false),
    'access', jsonb_build_object('overrideEnabled', false),
    'runnerInfo', jsonb_build_object(
      'startArea', 'Abbaye de Corbigny',
      'briefing', null,
      'rules', formats.rules,
      'note', formats.schedule_note
    )
  )
from formats
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  series_name = excluded.series_name,
  edition_group_id = excluded.edition_group_id,
  event_id = excluded.event_id,
  edition_id = excluded.edition_id,
  location = excluded.location,
  location_text = excluded.location_text,
  distance_km = excluded.distance_km,
  elevation_gain_m = excluded.elevation_gain_m,
  elevation_loss_m = excluded.elevation_loss_m,
  source_url = excluded.source_url,
  external_site_url = excluded.external_site_url,
  image_url = excluded.image_url,
  thumbnail_url = excluded.thumbnail_url,
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
  has_aid_stations = excluded.has_aid_stations,
  racebook_is_live = excluded.racebook_is_live,
  data_status = excluded.data_status,
  missing_required_fields = excluded.missing_required_fields,
  participation_mode = excluded.participation_mode,
  notes = excluded.notes,
  organizer_details = excluded.organizer_details;

insert into public.race_event_edition_branding (
  edition_id,
  draft_logo_url,
  draft_primary_color,
  draft_accent_color
)
values (
  'e1a49881-dc73-41c0-b39c-c7a1df536aab',
  'https://static.wixstatic.com/media/6f599c_1069e1d79ef44f7281a921aa9bdbaa10~mv2.png',
  '#1F4E5F',
  '#E98866'
)
on conflict (edition_id) do update set
  draft_logo_url = excluded.draft_logo_url,
  draft_primary_color = excluded.draft_primary_color,
  draft_accent_color = excluded.draft_accent_color;

do $$
declare
  format_count integer;
  gpx_count integer;
begin
  select count(*) into format_count
  from public.races
  where event_id = '84c2f901-3fe9-4580-a649-bfceaaa27af0'
    and edition_id = 'e1a49881-dc73-41c0-b39c-c7a1df536aab'
    and data_status = 'complete'
    and is_live = true;

  if format_count <> 8 then
    raise exception 'Expected 8 complete Trail Ton Château formats, found %.', format_count;
  end if;

  select count(*) into gpx_count
  from public.races
  where event_id = '84c2f901-3fe9-4580-a649-bfceaaa27af0'
    and gpx_storage_path is not null;

  if gpx_count <> 4 then
    raise exception 'Expected 4 Trail Ton Château GPX-backed formats, found %.', gpx_count;
  end if;
end;
$$;

commit;
