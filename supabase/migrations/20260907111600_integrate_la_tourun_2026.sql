begin;

do $$
begin
  if not exists (
    select 1
    from public.race_events
    where id = '53577181-6afd-4391-9ce9-cece40f39ad5'
      and name = 'La Tou’Run'
  ) then
    raise exception 'La Tou’Run event not found; refusing to update another event.';
  end if;

  if not exists (
    select 1
    from public.race_event_editions
    where id = '428d77e0-ea9c-4040-94df-0a9b8e7ed31f'
      and event_id = '53577181-6afd-4391-9ce9-cece40f39ad5'
      and edition_year = 2026
  ) then
    raise exception 'La Tou’Run 2026 edition not found; refusing to attach formats to another edition.';
  end if;
end;
$$;

update public.race_event_editions
set start_date = date '2026-10-18',
    end_date = date '2026-10-18'
where id = '428d77e0-ea9c-4040-94df-0a9b8e7ed31f'
  and event_id = '53577181-6afd-4391-9ce9-cece40f39ad5';

update public.race_events
set name = 'La Tou’Run',
    location = 'La Tour-d’Aigues, Vaucluse',
    description = 'Événement sportif et solidaire organisé par Endurance Attitude, avec trois courses nature chronométrées et deux marches solidaires.',
    website_url = 'https://www.kms.fr/v5/public/course/5320',
    race_date = date '2026-10-18',
    thumbnail_url = 'https://www.kms.fr/scripts/upload/header/197@Tou-Run-2026-Bandeau.png',
    organizer_details = coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object(
        'officialWebsiteUrl', 'https://www.kms.fr/v5/public/course/5320',
        'dateRange', jsonb_build_object('endDate', '2026-10-18'),
        'eventLocation', jsonb_build_object(
          'label', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
          'lat', null,
          'lng', null,
          'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=Place%20Jean%20Jaur%C3%A8s%2C%2084240%20La%20Tour-d%27Aigues',
          'source', 'manual'
        ),
        'mandatoryEquipment', jsonb_build_object(
          'overrideEnabled', false,
          'weatherPlan', 'normal',
          'items', jsonb_build_array(
            jsonb_build_object(
              'id', 'tourun-2026-reusable-cup',
              'label', 'Contenant personnel réutilisable',
              'required', false,
              'cold', false,
              'heat', false,
              'note', 'Gourde, flasque souple ou gobelet pliable conseillé pour assurer son autonomie entre les ravitaillements.'
            )
          ),
          'note', 'Consulter la météo avant la course et adapter son équipement aux conditions prévues.'
        ),
        'bibPickup', jsonb_build_object(
          'overrideEnabled', false,
          'location', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
          'locationDetails', jsonb_build_object(
            'label', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
            'lat', null,
            'lng', null,
            'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=Place%20Jean%20Jaur%C3%A8s%2C%2084240%20La%20Tour-d%27Aigues',
            'source', 'manual'
          ),
          'schedule', null,
          'locations', jsonb_build_array(
            jsonb_build_object(
              'location', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
              'locationDetails', jsonb_build_object(
                'label', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
                'lat', null,
                'lng', null,
                'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=Place%20Jean%20Jaur%C3%A8s%2C%2084240%20La%20Tour-d%27Aigues',
                'source', 'manual'
              ),
              'slots', jsonb_build_array(
                jsonb_build_object('date', '2026-10-17', 'startTime', '16:00', 'endTime', '19:00'),
                jsonb_build_object('date', '2026-10-18', 'startTime', '07:00', 'endTime', '08:00')
              )
            )
          ),
          'requiredDocuments', 'Licence FFA ou attestation PPS valide pour les courses chronométrées. Les mineurs doivent aussi fournir l’autorisation parentale et, si nécessaire, le questionnaire de santé.',
          'thirdPartyPickupAllowed', null,
          'equipmentCheck', null,
          'note', 'Aucune inscription sur place. Le dossard doit rester visible sur la poitrine ou le ventre pendant toute la course.'
        ),
        'access', jsonb_build_object(
          'overrideEnabled', false,
          'startAddress', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
          'startLocation', jsonb_build_object(
            'label', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
            'lat', null,
            'lng', null,
            'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=Place%20Jean%20Jaur%C3%A8s%2C%2084240%20La%20Tour-d%27Aigues',
            'source', 'manual'
          ),
          'finishAddress', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
          'finishLocation', jsonb_build_object(
            'label', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues, 84240 La Tour-d’Aigues',
            'lat', null,
            'lng', null,
            'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=Place%20Jean%20Jaur%C3%A8s%2C%2084240%20La%20Tour-d%27Aigues',
            'source', 'manual'
          ),
          'officialParkings', 'Parkings de l’Église, Bernard Auphan, salle des fêtes (face au tennis), collège Albert Camus et parking du Parc.',
          'shuttles', null,
          'shuttleSchedule', null,
          'roadRestrictions', null,
          'mapUrl', 'https://www.google.com/maps/search/?api=1&query=Place%20Jean%20Jaur%C3%A8s%2C%2084240%20La%20Tour-d%27Aigues',
          'note', 'Des WC publics et des WC mobiles sont disponibles à proximité de la place. Des bornes de recharge se trouvent rue Claude Haut.',
          'enabledSections', jsonb_build_object(
            'officialParkings', true,
            'shuttles', false,
            'roadRestrictions', false,
            'mapUrl', true,
            'runnerInfo', true
          )
        ),
        'services', jsonb_build_object(
          'supporters', 'Les spectateurs sont admis sur les parcours, sans assistance aux participants. Les chiens des accompagnants doivent être tenus en laisse.',
          'accommodations', null,
          'restaurants', null,
          'recovery', 'Rafraîchissement à l’arrivée et buffet sur les terrasses du Château selon le format.',
          'partners', 'Des cadeaux L’OCCITANE sont prévus pour les participants et sont strictement interdits à la revente.',
          'lastMinuteMessage', null,
          'note', 'Un ravitaillement coureurs est annoncé à La Bastidonne, sans kilométrage publié. La marche de 10 km dispose d’un buffet à mi-parcours à La Bastidonne ; la marche de 6 km dispose d’un buffet à l’arrivée.'
        )
      )
where id = '53577181-6afd-4391-9ce9-cece40f39ad5';

with formats (
  id,
  slug,
  name,
  distance_km,
  elevation_gain_m,
  registration_url,
  start_time,
  data_status,
  missing_required_fields,
  is_live,
  runner_rules,
  cutoff_note
) as (
  values
    (
      '776035c8-d2ce-43f1-b0ba-9a30258ddf8b'::uuid,
      'la-tourun-trail-11-km',
      'Trail 11 km',
      11.2::numeric,
      245::numeric,
      'https://www.kms.fr/v5/public/inscription/14609',
      '09:15',
      'complete',
      array[]::text[],
      true,
      'Course chronométrée accessible à partir de 16 ans. Seul ce parcours peut être praticable en joëlette, avec certificat médical adapté pour la personne transportée. Un ravitaillement est annoncé à La Bastidonne, sans kilométrage publié.',
      null::text
    ),
    (
      '9769fec8-69dd-4fae-9c79-a57663f1aeaa'::uuid,
      'la-tourun-trail-16-km',
      'Trail 16 km',
      16.2::numeric,
      385::numeric,
      'https://www.kms.fr/v5/public/inscription/14607',
      '09:00',
      'complete',
      array[]::text[],
      true,
      'Course nature chronométrée. Un ravitaillement est annoncé à La Bastidonne, sans kilométrage publié.',
      null::text
    ),
    (
      'cf06661d-9dfd-4809-be43-08a9045cd0e7'::uuid,
      'la-tourun-trail-25-km',
      'Trail 25 km',
      25.1::numeric,
      755::numeric,
      'https://www.kms.fr/v5/public/inscription/14608',
      '09:00',
      'complete',
      array[]::text[],
      true,
      'Course nature chronométrée accessible à partir de 20 ans. Un ravitaillement est annoncé à La Bastidonne, sans kilométrage publié.',
      'Une heure limite de passage pourra être matérialisée ; en cas de hors délai, le participant devra basculer sur le parcours de 16 km.'
    ),
    (
      '2b296fdc-59d1-4142-babe-65df49fe1601'::uuid,
      'la-tourun-marche-solidaire-6-km',
      'Marche solidaire 6 km',
      6::numeric,
      0::numeric,
      'https://www.kms.fr/v5/public/inscription/14610',
      '09:20',
      'draft',
      array['elevation_gain_m']::text[],
      false,
      'Marche ouverte à tous, les mineurs devant être accompagnés. Les chiens tenus en laisse sont autorisés ; les poussettes sont déconseillées et les vélos interdits. Buffet à l’arrivée sur les terrasses du Château.',
      null::text
    ),
    (
      'a031835c-07ee-4bd5-8e70-356657302844'::uuid,
      'la-tourun-marche-solidaire-10-km',
      'Marche solidaire 10 km',
      10::numeric,
      200::numeric,
      'https://www.kms.fr/v5/public/inscription/14611',
      '09:20',
      'complete',
      array[]::text[],
      true,
      'Marche ouverte à tous, les mineurs devant être accompagnés. Les chiens tenus en laisse sont autorisés ; les poussettes sont déconseillées et les vélos interdits. Buffet à mi-parcours à La Bastidonne, puis rafraîchissement à l’arrivée.',
      'Une heure limite de passage pourra être matérialisée ; en cas de hors délai, le participant devra basculer sur le parcours de 6 km.'
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
  '53577181-6afd-4391-9ce9-cece40f39ad5'::uuid,
  '428d77e0-ea9c-4040-94df-0a9b8e7ed31f'::uuid,
  'La Tour-d’Aigues, Vaucluse',
  null,
  formats.distance_km,
  formats.elevation_gain_m,
  0,
  'https://www.kms.fr/v5/public/course/5320',
  formats.registration_url,
  'https://www.kms.fr/scripts/upload/header/197@Tou-Run-2026-Bandeau.png',
  'https://www.kms.fr/scripts/upload/header/197@Tou-Run-2026-Bandeau.png',
  'organizer/53577181-6afd-4391-9ce9-cece40f39ad5/' || formats.id || '.gpx',
  'manual:' || formats.id,
  null,
  date '2026-10-18',
  true,
  formats.is_live,
  true,
  false,
  false,
  formats.data_status,
  formats.missing_required_fields,
  'solo',
  'Sources vérifiées le 7 septembre 2026 : page KMS de l’événement et règlement officiel publié le 4 septembre 2026.',
  jsonb_build_object(
    'raceLocation', jsonb_build_object(
      'label', null,
      'lat', null,
      'lng', null,
      'googleMapsUrl', null,
      'source', null
    ),
    'schedule', jsonb_build_object(
      'startTime', formats.start_time,
      'finishCutoffTime', null,
      'shuttleSchedule', null,
      'cutoffNote', formats.cutoff_note,
      'note', 'Échauffement collectif annoncé à 08:45 sur la Place Jean Jaurès.'
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
      'startArea', 'Place Jean Jaurès, devant le Château de La Tour-d’Aigues',
      'briefing', null,
      'rules', formats.runner_rules,
      'note', 'Respecter le balisage, le Code de la route, les bénévoles et les zones Natura 2000. Toute assistance extérieure est interdite.'
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
  source_url = excluded.source_url,
  external_site_url = excluded.external_site_url,
  image_url = excluded.image_url,
  thumbnail_url = excluded.thumbnail_url,
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

commit;
