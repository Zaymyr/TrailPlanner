-- A durable, idempotent showcase event for the runner-facing mobile Racebook.
-- The event is deliberately fictional, while dates, logistics, checkpoints, and
-- course metrics are representative of a real two-day French alpine trail.

insert into public.race_events (
  id,
  name,
  location,
  description,
  website_url,
  race_date,
  is_live,
  thumbnail_url,
  organizer_details
)
values (
  '7a110000-0000-4000-8000-000000000001',
  'Trail TST',
  'Samoëns, Haute-Savoie',
  'Événement de démonstration Pace Yourself : trois formats alpins, des informations organisateur complètes et des ravitaillements réalistes pour découvrir le Racebook mobile.',
  'https://paceyourself.app',
  date '2026-09-26',
  true,
  'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/trail-tst-cover.png',
  jsonb_build_object(
    'officialWebsiteUrl', 'https://paceyourself.app',
    'emergencyContact', jsonb_build_object(
      'name', 'PC course – secours',
      'phone', '112'
    ),
    'dateRange', jsonb_build_object('endDate', '2026-09-27'),
    'eventLocation', jsonb_build_object(
      'label', 'Place du Gros Tilleul, Samoëns',
      'lat', 46.0832,
      'lng', 6.7264,
      'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264',
      'source', 'manual'
    ),
    'mandatoryEquipment', jsonb_build_object(
      'weatherPlan', 'normal',
      'items', jsonb_build_array(
        jsonb_build_object('id', 'common-phone', 'label', 'Téléphone chargé avec numéro du PC course', 'required', true, 'cold', false, 'heat', false, 'note', 'Mode économie d’énergie conseillé.'),
        jsonb_build_object('id', 'common-cup', 'label', 'Gobelet personnel', 'required', true, 'cold', false, 'heat', false, 'note', 'Aucun gobelet jetable sur les ravitaillements.'),
        jsonb_build_object('id', 'common-blanket', 'label', 'Couverture de survie 1,40 × 2 m', 'required', true, 'cold', false, 'heat', false, 'note', null),
        jsonb_build_object('id', 'common-jacket', 'label', 'Veste imperméable à capuche', 'required', true, 'cold', false, 'heat', false, 'note', 'Membrane respirante recommandée.'),
        jsonb_build_object('id', 'common-water', 'label', 'Réserve d’eau de 1 litre minimum', 'required', true, 'cold', false, 'heat', false, 'note', null),
        jsonb_build_object('id', 'common-food', 'label', 'Réserve alimentaire personnelle', 'required', true, 'cold', false, 'heat', false, 'note', null),
        jsonb_build_object('id', 'common-warm', 'label', 'Seconde couche chaude manches longues', 'required', false, 'cold', true, 'heat', false, 'note', 'Activée si le plan grand froid est annoncé.'),
        jsonb_build_object('id', 'common-cap', 'label', 'Casquette et crème solaire', 'required', false, 'cold', false, 'heat', true, 'note', 'Activées si le plan forte chaleur est annoncé.')
      ),
      'note', 'Le matériel peut être contrôlé au retrait des dossards, au départ ou sur le parcours.'
    ),
    'bibPickup', jsonb_build_object(
      'overrideEnabled', false,
      'location', null,
      'locationDetails', jsonb_build_object('label', null, 'lat', null, 'lng', null, 'googleMapsUrl', null, 'source', null),
      'schedule', null,
      'locations', jsonb_build_array(
        jsonb_build_object(
          'location', 'Salle du Criou – village départ',
          'locationDetails', jsonb_build_object(
            'label', 'Salle du Criou, Samoëns',
            'lat', 46.0828,
            'lng', 6.7272,
            'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0828,6.7272',
            'source', 'manual'
          ),
          'slots', jsonb_build_array(
            jsonb_build_object('date', '2026-09-25', 'startTime', '15:00', 'endTime', '20:00'),
            jsonb_build_object('date', '2026-09-26', 'startTime', '03:00', 'endTime', '07:00'),
            jsonb_build_object('date', '2026-09-27', 'startTime', '06:30', 'endTime', '08:30')
          )
        ),
        jsonb_build_object(
          'location', 'Maison de la Montagne – centre-bourg',
          'locationDetails', jsonb_build_object(
            'label', 'Maison de la Montagne, Samoëns',
            'lat', 46.0821,
            'lng', 6.7256,
            'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0821,6.7256',
            'source', 'manual'
          ),
          'slots', jsonb_build_array(
            jsonb_build_object('date', '2026-09-25', 'startTime', '10:00', 'endTime', '18:00')
          )
        )
      ),
      'requiredDocuments', 'Pièce d’identité avec photo et QR code d’inscription. Autorisation parentale pour les mineurs du 18 km.',
      'thirdPartyPickupAllowed', true,
      'equipmentCheck', true,
      'note', 'Retrait par un tiers possible avec copie de la pièce d’identité du coureur et QR code d’inscription.'
    ),
    'access', jsonb_build_object(
      'overrideEnabled', false,
      'startAddress', 'Place du Gros Tilleul, 74340 Samoëns',
      'startLocation', jsonb_build_object(
        'label', 'Arche de départ – Place du Gros Tilleul',
        'lat', 46.0832,
        'lng', 6.7264,
        'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264',
        'source', 'manual'
      ),
      'finishAddress', 'Place du Gros Tilleul, 74340 Samoëns',
      'finishLocation', jsonb_build_object(
        'label', 'Arche d’arrivée – Place du Gros Tilleul',
        'lat', 46.0832,
        'lng', 6.7264,
        'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264',
        'source', 'manual'
      ),
      'officialParkings', 'P1 Base de loisirs (600 places) et P2 Grand Massif Express (350 places). Suivre le jalonnement « Trail TST ». Stationnement interdit dans le centre historique.',
      'shuttles', 'Navettes gratuites entre P1, P2 et le village départ. Les accompagnants peuvent les utiliser dans la limite des places disponibles.',
      'shuttleSchedule', 'Vendredi 14:30–20:30 ; samedi 02:30–00:30 toutes les 15 min ; dimanche 06:00–15:00 toutes les 20 min.',
      'roadRestrictions', 'Centre-bourg fermé à la circulation samedi de 03:00 à 08:00 et dimanche de 07:30 à 10:00. Accès au col de Joux Plane filtré de 06:00 à 14:00.',
      'mapUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264',
      'note', 'Prévoir 30 minutes entre l’entrée dans Samoëns et l’accès à l’aire de départ.',
      'enabledSections', jsonb_build_object('officialParkings', true, 'shuttles', true, 'roadRestrictions', true, 'mapUrl', true, 'runnerInfo', true)
    ),
    'services', jsonb_build_object(
      'supporters', 'Zones accompagnants recommandées : Samoëns, Joux Plane et Vercland. Les autres points sont accessibles uniquement à pied et sans assistance au coureur.',
      'accommodations', 'Camping de la base de loisirs, aire vans dédiée sur réservation et hébergements partenaires dans la vallée. Navette matinale depuis Morillon.',
      'restaurants', 'Pasta party vendredi 18:00–21:00 à la Salle du Criou. Repas d’après-course inclus pour chaque coureur ; tickets accompagnants en vente sur place.',
      'recovery', 'Espace récupération à l’arrivée : kinés, ostéopathes, vestiaires, douches et consigne sacs. Accès prioritaire aux finishers du 82 km.',
      'partners', 'Produits énergétiques Baouw et Meltonic sur une sélection de ravitaillements. Produits locaux salés et sucrés sur les ravitos complets.',
      'lastMinuteMessage', 'Mise à jour vendredi 18:00 : terrain humide au-dessus de 1 800 m. Les bâtons sont autorisés sur les trois formats ; prudence sur les passerelles en bois.',
      'note', 'Événement écoresponsable : aucun gobelet jetable, tri obligatoire et covoiturage recommandé.'
    )
  )
)
on conflict (id) do update set
  name = excluded.name,
  location = excluded.location,
  description = excluded.description,
  website_url = excluded.website_url,
  race_date = excluded.race_date,
  is_live = excluded.is_live,
  thumbnail_url = excluded.thumbnail_url,
  organizer_details = excluded.organizer_details;

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
  '7a110000-0000-4000-8000-000000000002',
  '7a110000-0000-4000-8000-000000000001',
  2026,
  date '2026-09-26',
  date '2026-09-27',
  true,
  true
)
on conflict (id) do update set
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  is_current = excluded.is_current,
  is_visible = excluded.is_visible;

insert into public.races (
  id,
  slug,
  name,
  location,
  distance_km,
  elevation_gain_m,
  elevation_loss_m,
  min_alt_m,
  max_alt_m,
  source_url,
  external_site_url,
  image_url,
  thumbnail_url,
  gpx_path,
  gpx_hash,
  gpx_storage_path,
  gpx_sha256,
  is_published,
  is_live,
  location_text,
  start_lat,
  start_lng,
  bounds_min_lat,
  bounds_min_lng,
  bounds_max_lat,
  bounds_max_lng,
  race_date,
  is_public,
  has_aid_stations,
  event_id,
  organizer_details,
  edition_group_id,
  series_name,
  edition_id,
  racebook_is_live,
  racebook_publication_approved_at,
  data_status,
  missing_required_fields,
  participation_mode,
  notes
)
values
  (
    '7a110000-0000-4000-8000-000000000018',
    'trail-tst-18-balcon-des-erables-2026',
    'TST 18 – Balcon des Érables',
    'Samoëns, Haute-Savoie',
    18.4,
    860,
    860,
    710,
    1410,
    'https://paceyourself.app',
    'https://paceyourself.app',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/trail-tst-cover.png',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/trail-tst-cover.png',
    'trail-tst/2026/trail-tst-18.gpx',
    '653eadfbce0250664bd60c863e740183aa9d2dd8a7b64e107b38f4280fd3b038',
    'trail-tst/2026/trail-tst-18.gpx',
    '653eadfbce0250664bd60c863e740183aa9d2dd8a7b64e107b38f4280fd3b038',
    true,
    true,
    'Samoëns – boucle du Balcon des Érables',
    46.0832,
    6.7264,
    46.0832,
    6.6990,
    46.1320,
    6.7500,
    date '2026-09-27',
    true,
    true,
    '7a110000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'raceLocation', jsonb_build_object('label', 'Place du Gros Tilleul, Samoëns', 'lat', 46.0832, 'lng', 6.7264, 'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264', 'source', 'manual'),
      'schedule', jsonb_build_object('startTime', '09:00', 'finishCutoffTime', '13:30', 'shuttleSchedule', null, 'cutoffNote', 'Barrière stricte au km 13,4 à 12:15. Tout coureur hors délai restitue son dossard au chef de poste.', 'note', 'Mise en sas à 08:45. Briefing sécurité à 08:50.'),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', true, 'weatherPlan', 'normal', 'items', jsonb_build_array(
        jsonb_build_object('id', '18-poles', 'label', 'Bâtons de trail', 'required', false, 'cold', false, 'heat', false, 'note', 'Autorisés dès le départ.')
      ), 'note', 'Chaussures avec semelle crantée fortement recommandées.'),
      'bibPickup', jsonb_build_object('overrideEnabled', false, 'location', null, 'locationDetails', jsonb_build_object('label', null, 'lat', null, 'lng', null, 'googleMapsUrl', null, 'source', null), 'schedule', null, 'locations', jsonb_build_array(), 'requiredDocuments', null, 'thirdPartyPickupAllowed', null, 'equipmentCheck', null, 'note', null),
      'access', jsonb_build_object('overrideEnabled', false, 'startAddress', null, 'startLocation', jsonb_build_object('label', null, 'lat', null, 'lng', null, 'googleMapsUrl', null, 'source', null), 'finishAddress', null, 'finishLocation', jsonb_build_object('label', null, 'lat', null, 'lng', null, 'googleMapsUrl', null, 'source', null), 'officialParkings', null, 'shuttles', null, 'shuttleSchedule', null, 'roadRestrictions', null, 'mapUrl', null, 'note', 'Les coureurs du 18 km sont invités à utiliser le parking P2 dimanche matin.', 'enabledSections', jsonb_build_object('officialParkings', true, 'shuttles', true, 'roadRestrictions', true, 'mapUrl', true, 'runnerInfo', true)),
      'runnerInfo', jsonb_build_object('startArea', 'Sas unique de 450 coureurs. Entrée par la rue des Glaciers à partir de 08:30.', 'briefing', 'Briefing obligatoire à 08:50 : météo, traversées de route et comportement en alpage.', 'rules', 'Dossard visible, priorité aux randonneurs et respect absolu des zones de quiétude. Assistance extérieure interdite.', 'note', 'Parcours conseillé aux coureurs déjà à l’aise sur sentier technique.')
    ),
    '7a110000-0000-4000-8000-000000001018',
    'Balcon des Érables',
    '7a110000-0000-4000-8000-000000000002',
    true,
    timezone('utc', now()),
    'complete',
    array[]::text[],
    'solo',
    'Format découverte avec deux ravitaillements et une montée principale régulière.'
  ),
  (
    '7a110000-0000-4000-8000-000000000042',
    'trail-tst-42-traversee-des-alpages-2026',
    'TST 42 – Traversée des Alpages',
    'Samoëns, Haute-Savoie',
    42.6,
    2450,
    2450,
    710,
    1930,
    'https://paceyourself.app',
    'https://paceyourself.app',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/trail-tst-cover.png',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/trail-tst-cover.png',
    'trail-tst/2026/trail-tst-42.gpx',
    '33821e16a981ebd7e0fd580e3c55beef5164fa0f180afa97b8409c9034d51f94',
    'trail-tst/2026/trail-tst-42.gpx',
    '33821e16a981ebd7e0fd580e3c55beef5164fa0f180afa97b8409c9034d51f94',
    true,
    true,
    'Samoëns – Joux Plane – refuge de Bostan – Vercland',
    46.0832,
    6.7264,
    46.0832,
    6.6830,
    46.1610,
    6.7780,
    date '2026-09-26',
    true,
    true,
    '7a110000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'raceLocation', jsonb_build_object('label', 'Place du Gros Tilleul, Samoëns', 'lat', 46.0832, 'lng', 6.7264, 'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264', 'source', 'manual'),
      'schedule', jsonb_build_object('startTime', '07:30', 'finishCutoffTime', '17:00', 'shuttleSchedule', null, 'cutoffNote', 'Barrières : Joux Plane 11:15, Bostan 14:00 et Vercland 15:45.', 'note', 'Départ en deux vagues à 07:30 et 07:35 selon le numéro de dossard.'),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', true, 'weatherPlan', 'normal', 'items', jsonb_build_array(
        jsonb_build_object('id', '42-headlamp', 'label', 'Lampe frontale avec batterie chargée', 'required', false, 'cold', false, 'heat', false, 'note', 'Conseillée en cas de progression lente.'),
        jsonb_build_object('id', '42-gloves', 'label', 'Gants couvrant les doigts', 'required', false, 'cold', true, 'heat', false, 'note', 'Activés avec le plan grand froid.'),
        jsonb_build_object('id', '42-poles', 'label', 'Bâtons de trail', 'required', false, 'cold', false, 'heat', false, 'note', 'Autorisés sur tout le parcours.')
      ), 'note', 'Une réserve de 1,5 litre est recommandée entre Joux Plane et Bostan.'),
      'bibPickup', jsonb_build_object('overrideEnabled', false, 'location', null, 'locationDetails', jsonb_build_object('label', null, 'lat', null, 'lng', null, 'googleMapsUrl', null, 'source', null), 'schedule', null, 'locations', jsonb_build_array(), 'requiredDocuments', null, 'thirdPartyPickupAllowed', null, 'equipmentCheck', null, 'note', null),
      'access', jsonb_build_object('overrideEnabled', false, 'startAddress', null, 'startLocation', jsonb_build_object('label', null, 'lat', null, 'lng', null, 'googleMapsUrl', null, 'source', null), 'finishAddress', null, 'finishLocation', jsonb_build_object('label', null, 'lat', null, 'lng', null, 'googleMapsUrl', null, 'source', null), 'officialParkings', null, 'shuttles', null, 'shuttleSchedule', null, 'roadRestrictions', null, 'mapUrl', null, 'note', 'Dernière navette P2 vers le départ à 07:00.', 'enabledSections', jsonb_build_object('officialParkings', true, 'shuttles', true, 'roadRestrictions', true, 'mapUrl', true, 'runnerInfo', true)),
      'runnerInfo', jsonb_build_object('startArea', 'Deux sas de 350 coureurs. Affectation indiquée sur le dossard.', 'briefing', 'Briefing à 07:20. Passage sur zone Natura 2000 : rester strictement sur le sentier balisé.', 'rules', 'Assistance autorisée uniquement à Joux Plane et Vercland. Écouteurs interdits sur les sections routières.', 'note', 'Le passage du col est exposé au vent ; adapter sa tenue avant la sortie de forêt.')
    ),
    '7a110000-0000-4000-8000-000000001042',
    'Traversée des Alpages',
    '7a110000-0000-4000-8000-000000000002',
    true,
    timezone('utc', now()),
    'complete',
    array[]::text[],
    'solo',
    'Trail technique d’une journée avec quatre postes de ravitaillement.'
  ),
  (
    '7a110000-0000-4000-8000-000000000082',
    'trail-tst-82-ultra-des-cimes-2026',
    'TST 82 – Ultra des Cimes',
    'Samoëns, Haute-Savoie',
    82.3,
    5120,
    5120,
    710,
    2260,
    'https://paceyourself.app',
    'https://paceyourself.app',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/trail-tst-cover.png',
    'https://pxkupuqtqmkguorajmaa.supabase.co/storage/v1/object/public/race-images/trail-tst/2026/trail-tst-cover.png',
    'trail-tst/2026/trail-tst-82.gpx',
    '4f9724285840219fd6613c231b901e3e09fa4cd8a99d587024fc88eca4abd762',
    'trail-tst/2026/trail-tst-82.gpx',
    '4f9724285840219fd6613c231b901e3e09fa4cd8a99d587024fc88eca4abd762',
    true,
    true,
    'Samoëns – crêtes de la Golèse – Joux Plane – Bostan – Vercland',
    46.0832,
    6.7264,
    46.0600,
    6.6610,
    46.1900,
    6.8020,
    date '2026-09-26',
    true,
    true,
    '7a110000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'raceLocation', jsonb_build_object('label', 'Place du Gros Tilleul, Samoëns', 'lat', 46.0832, 'lng', 6.7264, 'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264', 'source', 'manual'),
      'schedule', jsonb_build_object('startTime', '04:00', 'finishCutoffTime', '23:30', 'shuttleSchedule', null, 'cutoffNote', 'Barrières éliminatoires : Golèse 08:00, Joux Plane 12:00, base de vie Bostan 16:00, Vercland 21:00.', 'note', 'Appel en sas à 03:35, contrôle aléatoire du sac et briefing à 03:50.'),
      'mandatoryEquipment', jsonb_build_object('overrideEnabled', true, 'weatherPlan', 'normal', 'items', jsonb_build_array(
        jsonb_build_object('id', '82-headlamp', 'label', 'Deux lampes frontales en état de marche', 'required', true, 'cold', false, 'heat', false, 'note', 'Une lampe principale et une lampe de secours.'),
        jsonb_build_object('id', '82-battery', 'label', 'Batterie ou piles de rechange', 'required', true, 'cold', false, 'heat', false, 'note', null),
        jsonb_build_object('id', '82-bandage', 'label', 'Bande élastique adhésive 100 × 6 cm', 'required', true, 'cold', false, 'heat', false, 'note', null),
        jsonb_build_object('id', '82-warm', 'label', 'Bonnet et gants couvrant les doigts', 'required', false, 'cold', true, 'heat', false, 'note', 'Deviennent obligatoires si le plan grand froid est activé.'),
        jsonb_build_object('id', '82-poles', 'label', 'Bâtons de trail', 'required', false, 'cold', false, 'heat', false, 'note', 'Fortement conseillés ; garder les pointes protégées dans les zones publiques.')
      ), 'note', 'Le sac de délestage est transporté à la base de vie du km 39. Dépôt avant 03:30.'),
      'bibPickup', jsonb_build_object('overrideEnabled', false, 'location', null, 'locationDetails', jsonb_build_object('label', null, 'lat', null, 'lng', null, 'googleMapsUrl', null, 'source', null), 'schedule', null, 'locations', jsonb_build_array(), 'requiredDocuments', null, 'thirdPartyPickupAllowed', null, 'equipmentCheck', null, 'note', null),
      'access', jsonb_build_object('overrideEnabled', true, 'startAddress', 'Place du Gros Tilleul, 74340 Samoëns', 'startLocation', jsonb_build_object('label', 'Arche de départ – Place du Gros Tilleul', 'lat', 46.0832, 'lng', 6.7264, 'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264', 'source', 'manual'), 'finishAddress', 'Place du Gros Tilleul, 74340 Samoëns', 'finishLocation', jsonb_build_object('label', 'Arche d’arrivée – Place du Gros Tilleul', 'lat', 46.0832, 'lng', 6.7264, 'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264', 'source', 'manual'), 'officialParkings', 'Parking ultra réservé au P1 Base de loisirs. Présenter le QR code parking reçu par e-mail.', 'shuttles', 'Navettes P1 → départ de 02:30 à 03:30. Navette abandons depuis Bostan et Vercland sur instruction du chef de poste.', 'shuttleSchedule', 'Départs P1 toutes les 10 min entre 02:30 et 03:30. Retours abandons selon remplissage des véhicules.', 'roadRestrictions', 'Accès accompagnants interdit à la Golèse. Joux Plane accessible uniquement par le versant Morzine jusqu’à 11:30.', 'mapUrl', 'https://www.google.com/maps/search/?api=1&query=46.0832,6.7264', 'note', 'Les relayeurs disposent d’une zone de dépose-minute à Joux Plane et Vercland ; aucun stationnement longue durée.', 'enabledSections', jsonb_build_object('officialParkings', true, 'shuttles', true, 'roadRestrictions', true, 'mapUrl', true, 'runnerInfo', true)),
      'runnerInfo', jsonb_build_object('startArea', 'Sas solo à gauche, sas relais à droite. Contrôle des témoins relais avant l’entrée en sas.', 'briefing', 'Briefing obligatoire à 03:50. Première heure de course de nuit et traversées de troupeaux possibles.', 'rules', 'Solo ou relais à trois. Assistance autorisée uniquement à Joux Plane, Bostan et Vercland. Le témoin doit être transmis dans la zone matérialisée.', 'note', 'Les relayeurs 2 et 3 doivent rejoindre leur zone au moins 30 minutes avant l’horaire estimé de passage.')
    ),
    '7a110000-0000-4000-8000-000000001082',
    'Ultra des Cimes',
    '7a110000-0000-4000-8000-000000000002',
    true,
    timezone('utc', now()),
    'complete',
    array[]::text[],
    'solo_and_relay',
    'Ultra alpin disponible en solo ou en relais à trois, avec base de vie et sac de délestage.'
  )
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  location = excluded.location,
  distance_km = excluded.distance_km,
  elevation_gain_m = excluded.elevation_gain_m,
  elevation_loss_m = excluded.elevation_loss_m,
  min_alt_m = excluded.min_alt_m,
  max_alt_m = excluded.max_alt_m,
  source_url = excluded.source_url,
  external_site_url = excluded.external_site_url,
  image_url = excluded.image_url,
  thumbnail_url = excluded.thumbnail_url,
  gpx_path = excluded.gpx_path,
  gpx_hash = excluded.gpx_hash,
  gpx_storage_path = excluded.gpx_storage_path,
  gpx_sha256 = excluded.gpx_sha256,
  is_published = excluded.is_published,
  is_live = excluded.is_live,
  location_text = excluded.location_text,
  start_lat = excluded.start_lat,
  start_lng = excluded.start_lng,
  bounds_min_lat = excluded.bounds_min_lat,
  bounds_min_lng = excluded.bounds_min_lng,
  bounds_max_lat = excluded.bounds_max_lat,
  bounds_max_lng = excluded.bounds_max_lng,
  race_date = excluded.race_date,
  is_public = excluded.is_public,
  has_aid_stations = excluded.has_aid_stations,
  event_id = excluded.event_id,
  organizer_details = excluded.organizer_details,
  edition_group_id = excluded.edition_group_id,
  series_name = excluded.series_name,
  edition_id = excluded.edition_id,
  racebook_is_live = excluded.racebook_is_live,
  racebook_publication_approved_at = excluded.racebook_publication_approved_at,
  data_status = excluded.data_status,
  missing_required_fields = excluded.missing_required_fields,
  participation_mode = excluded.participation_mode,
  notes = excluded.notes;

insert into public.race_aid_stations (
  id,
  race_id,
  name,
  km,
  water_available,
  solid_available,
  assistance_allowed,
  notes,
  order_index,
  needs_review,
  organizer_details
)
values
  ('7a110018-0001-4000-8000-000000000001', '7a110000-0000-4000-8000-000000000018', 'Chalet des Fontaines', 7.2, true, true, false, 'Eau, boisson énergétique, fruits frais et biscuits salés.', 0, false, jsonb_build_object('stationType', 'solid', 'cumulativeElevationGainM', 510, 'cumulativeElevationLossM', 90, 'altitudeM', 1125, 'cutoffTime', '10:45', 'dropBagAvailable', false, 'organizerNote', 'Poste sans assistance extérieure. Remplissage des flasques en libre-service.')),
  ('7a110018-0002-4000-8000-000000000002', '7a110000-0000-4000-8000-000000000018', 'Le Bémont', 13.4, true, true, false, 'Eau, cola, bananes, fromage et pain d’épices.', 1, false, jsonb_build_object('stationType', 'solid', 'cumulativeElevationGainM', 790, 'cumulativeElevationLossM', 420, 'altitudeM', 1080, 'cutoffTime', '12:15', 'dropBagAvailable', false, 'organizerNote', 'Dernier ravitaillement avant la descente finale.')),

  ('7a110042-0001-4000-8000-000000000001', '7a110000-0000-4000-8000-000000000042', 'Plateau de la Mouille', 9.5, true, false, false, 'Point d’eau et boisson énergétique uniquement.', 0, false, jsonb_build_object('stationType', 'water', 'cumulativeElevationGainM', 720, 'cumulativeElevationLossM', 120, 'altitudeM', 1310, 'cutoffTime', '09:45', 'dropBagAvailable', false, 'organizerNote', 'Point rapide : anticiper les besoins solides jusqu’à Joux Plane.')),
  ('7a110042-0002-4000-8000-000000000002', '7a110000-0000-4000-8000-000000000042', 'Col de Joux Plane', 18.6, true, true, true, 'Ravito complet chaud et froid, assistance autorisée.', 1, false, jsonb_build_object('stationType', 'assistance', 'cumulativeElevationGainM', 1320, 'cumulativeElevationLossM', 360, 'altitudeM', 1691, 'cutoffTime', '11:15', 'dropBagAvailable', false, 'organizerNote', 'Assistance limitée à une personne par coureur dans la zone balisée.')),
  ('7a110042-0003-4000-8000-000000000003', '7a110000-0000-4000-8000-000000000042', 'Refuge de Bostan', 28.4, true, true, false, 'Soupe, bouillon, fromage, fruits, barres et boissons.', 2, false, jsonb_build_object('stationType', 'solid', 'cumulativeElevationGainM', 1980, 'cumulativeElevationLossM', 1060, 'altitudeM', 1763, 'cutoffTime', '14:00', 'dropBagAvailable', false, 'organizerNote', 'Zone de quiétude : assistance et musique interdites.')),
  ('7a110042-0004-4000-8000-000000000004', '7a110000-0000-4000-8000-000000000042', 'Vercland', 36.2, true, true, true, 'Dernier ravito complet avant l’arrivée.', 3, false, jsonb_build_object('stationType', 'assistance', 'cumulativeElevationGainM', 2310, 'cumulativeElevationLossM', 1830, 'altitudeM', 920, 'cutoffTime', '15:45', 'dropBagAvailable', false, 'organizerNote', 'Assistance autorisée ; accès accompagnants par navette recommandé.')),

  ('7a110082-0001-4000-8000-000000000001', '7a110000-0000-4000-8000-000000000082', 'La Golèse', 12.0, true, true, false, 'Petit-déjeuner : thé, café, bouillon, bananes et barres.', 0, false, jsonb_build_object('stationType', 'solid', 'cumulativeElevationGainM', 980, 'cumulativeElevationLossM', 140, 'altitudeM', 1670, 'cutoffTime', '08:00', 'dropBagAvailable', false, 'organizerNote', 'Poste isolé sans accès accompagnants.')),
  ('7a110082-0002-4000-8000-000000000002', '7a110000-0000-4000-8000-000000000082', 'Col de Joux Plane – relais 1', 25.5, true, true, true, 'Ravito complet et première zone de passage de relais.', 1, false, jsonb_build_object('stationType', 'assistance', 'cumulativeElevationGainM', 1840, 'cumulativeElevationLossM', 760, 'altitudeM', 1691, 'cutoffTime', '12:00', 'dropBagAvailable', false, 'organizerNote', 'Transmission du témoin dans le couloir orange. Assistance autorisée après la zone relais.')),
  ('7a110082-0003-4000-8000-000000000003', '7a110000-0000-4000-8000-000000000082', 'Base de vie de Bostan', 39.0, true, true, true, 'Repas chaud, espace repos, médical et sac de délestage.', 2, false, jsonb_build_object('stationType', 'life_base', 'cumulativeElevationGainM', 2760, 'cumulativeElevationLossM', 1510, 'altitudeM', 1763, 'cutoffTime', '16:00', 'dropBagAvailable', true, 'organizerNote', 'Sac disponible à l’entrée. Temps de passage conseillé : 20 minutes maximum.')),
  ('7a110082-0004-4000-8000-000000000004', '7a110000-0000-4000-8000-000000000082', 'Vercland – relais 2', 51.5, true, true, true, 'Ravito complet et deuxième zone de passage de relais.', 3, false, jsonb_build_object('stationType', 'assistance', 'cumulativeElevationGainM', 3440, 'cumulativeElevationLossM', 2510, 'altitudeM', 920, 'cutoffTime', '18:30', 'dropBagAvailable', false, 'organizerNote', 'Relayeurs : entrée par le couloir bleu, sortie par la passerelle.')),
  ('7a110082-0005-4000-8000-000000000005', '7a110000-0000-4000-8000-000000000082', 'Lac des Mines d’Or', 65.0, true, true, false, 'Soupe, pommes de terre salées, fromage, fruits et boissons.', 4, false, jsonb_build_object('stationType', 'solid', 'cumulativeElevationGainM', 4380, 'cumulativeElevationLossM', 3220, 'altitudeM', 1390, 'cutoffTime', '20:45', 'dropBagAvailable', false, 'organizerNote', 'Contrôle de la lampe frontale à la sortie du poste.')),
  ('7a110082-0006-4000-8000-000000000006', '7a110000-0000-4000-8000-000000000082', 'Les Allamands', 75.5, true, false, false, 'Eau, cola, thé chaud et fruits frais.', 5, false, jsonb_build_object('stationType', 'water', 'cumulativeElevationGainM', 4930, 'cumulativeElevationLossM', 4290, 'altitudeM', 1096, 'cutoffTime', '22:30', 'dropBagAvailable', false, 'organizerNote', 'Dernier point de contrôle avant l’arrivée ; poste rapide.'))
on conflict (id) do update set
  race_id = excluded.race_id,
  name = excluded.name,
  km = excluded.km,
  water_available = excluded.water_available,
  solid_available = excluded.solid_available,
  assistance_allowed = excluded.assistance_allowed,
  notes = excluded.notes,
  order_index = excluded.order_index,
  needs_review = excluded.needs_review,
  organizer_details = excluded.organizer_details;

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
values
  ('7a110082-1001-4000-8000-000000000001', '7a110000-0000-4000-8000-000000000082', '7a110082-0002-4000-8000-000000000002', 'Col de Joux Plane', 25.5, '08:45–12:00', '12:00', 'Relais 1 → 2. Dépose-minute côté Morzine ; présence du relayeur 30 minutes avant le passage estimé.', 0),
  ('7a110082-1002-4000-8000-000000000002', '7a110000-0000-4000-8000-000000000082', '7a110082-0004-4000-8000-000000000004', 'Vercland', 51.5, '13:00–18:30', '18:30', 'Relais 2 → 3. Accès recommandé par la navette officielle depuis Samoëns.', 1)
on conflict (id) do update set
  race_aid_station_id = excluded.race_aid_station_id,
  name = excluded.name,
  km = excluded.km,
  handover_time = excluded.handover_time,
  cutoff_time = excluded.cutoff_time,
  notes = excluded.notes,
  order_index = excluded.order_index;

with product_assignments(station_id, product_slug, order_index, notes) as (
  values
    ('7a110018-0001-4000-8000-000000000001'::uuid, 'baouw-drink_mix-citron-fleur-de-sureau-45g', 0, 'Préparée à 500 ml.'),
    ('7a110018-0001-4000-8000-000000000001'::uuid, 'baouw-bar-banane-pecan', 1, null),
    ('7a110018-0002-4000-8000-000000000002'::uuid, 'meltonic-boisson-energetique-bio-citron-35g', 0, 'Préparée à 500 ml.'),
    ('7a110018-0002-4000-8000-000000000002'::uuid, 'baouw-gel-abricot-thym', 1, null),
    ('7a110042-0001-4000-8000-000000000001'::uuid, 'baouw-drink_mix-menthe-melisse-45g', 0, 'Préparée à 500 ml.'),
    ('7a110042-0002-4000-8000-000000000002'::uuid, 'meltonic-boisson-energetique-bio-fruits-rouges-35g', 0, 'Préparée à 500 ml.'),
    ('7a110042-0002-4000-8000-000000000002'::uuid, 'baouw-bar-chocolat-noisette', 1, null),
    ('7a110042-0003-4000-8000-000000000003'::uuid, 'baouw-real_food-patate-douce-carotte-poivre-timut', 0, 'Purée salée.'),
    ('7a110042-0003-4000-8000-000000000003'::uuid, 'baouw-gel-peche-the-matcha', 1, null),
    ('7a110042-0004-4000-8000-000000000004'::uuid, 'baouw-drink_mix-citron-fleur-de-sureau-45g', 0, 'Préparée à 500 ml.'),
    ('7a110042-0004-4000-8000-000000000004'::uuid, 'baouw-bar-framboise-pistache', 1, null),
    ('7a110082-0001-4000-8000-000000000001'::uuid, 'baouw-bar-banane-pecan', 0, null),
    ('7a110082-0001-4000-8000-000000000001'::uuid, 'baouw-electrolyte-citron-vert-menthe', 1, 'Pastilles disponibles à l’unité.'),
    ('7a110082-0002-4000-8000-000000000002'::uuid, 'meltonic-boisson-energetique-bio-citron-35g', 0, 'Préparée à 500 ml.'),
    ('7a110082-0002-4000-8000-000000000002'::uuid, 'baouw-gel-fruits-rouges-hibiscus', 1, null),
    ('7a110082-0003-4000-8000-000000000003'::uuid, 'baouw-real_food-cari-de-legumes', 0, 'Purée salée servie à température ambiante.'),
    ('7a110082-0003-4000-8000-000000000003'::uuid, 'baouw-bar-crunchy-cacahuete', 1, null),
    ('7a110082-0004-4000-8000-000000000004'::uuid, 'baouw-drink_mix-pasteque-grenade-45g', 0, 'Préparée à 500 ml.'),
    ('7a110082-0004-4000-8000-000000000004'::uuid, 'baouw-real_food-banane-kiwi-vanille', 1, null),
    ('7a110082-0005-4000-8000-000000000005'::uuid, 'baouw-real_food-patate-douce-carotte-poivre-timut', 0, 'Purée salée.'),
    ('7a110082-0005-4000-8000-000000000005'::uuid, 'baouw-gel-banane-vanille', 1, null),
    ('7a110082-0006-4000-8000-000000000006'::uuid, 'baouw-drink_mix-peche-romarin-45g', 0, 'Préparée à 500 ml.')
)
insert into public.race_aid_station_products (
  race_aid_station_id,
  product_id,
  notes,
  order_index
)
select
  assignment.station_id,
  product_row.id,
  assignment.notes,
  assignment.order_index
from product_assignments assignment
join public.products product_row on product_row.slug = assignment.product_slug
on conflict (race_aid_station_id, product_id) do update set
  notes = excluded.notes,
  order_index = excluded.order_index;
