begin;

-- SaintéLyon 2026 salon (Halle Tony Garnier) organizer stands, researched on
-- 2026-11-23 from each organizer's official site (secondary sources only to
-- fill gaps). New events and formats are created in the organizer "Privé"
-- state: course not public on the web catalog (is_public = false), preview
-- visible, RaceBook not live. Formats whose 2027 date is still provisional are
-- kept as masked drafts. Already-public formats stay public and are only
-- enriched. GPX objects were uploaded beforehand to the private race-gpx bucket
-- under versioned catalog/<event>/2027/<format>-<sha8>.gpx paths; null D+/D-
-- means the organizer has not published a value.

-- Existing private drafts become complete Privé formats: the event and its
-- 2027 edition must be catalog-visible so runners can find the private course.
update public.race_events
set is_live = true
where id in (
  '1bc5599f-1884-4f74-ba50-ae2c1d00e210', -- La Transju'Trails
  'db2cee93-3146-4486-8512-204c49f67101', -- L'Odyssée Beaujolaise
  'c9326ddb-c8e8-43a3-bb83-8616c924fc91'  -- Grand Trail des 2 Roches
);

update public.race_event_editions
set is_visible = true
where edition_year = 2027
  and event_id in (
    '1bc5599f-1884-4f74-ba50-ae2c1d00e210',
    'db2cee93-3146-4486-8512-204c49f67101',
    'c9326ddb-c8e8-43a3-bb83-8616c924fc91'
  );

update public.race_events
set website_url = 'https://grandtrail2roches.com/',
    organizer_details = coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object('officialWebsiteUrl', 'https://grandtrail2roches.com/')
where id = 'c9326ddb-c8e8-43a3-bb83-8616c924fc91';

-- Enrichment of existing formats (ids verified on 2026-11-23).
update public.races race
set elevation_loss_m = 7200,
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '23:00', 'startLocation', 'Cours Paoli, Corte', 'timeZone', 'Europe/Paris'))
where race.id = '5f21812e-9ae0-4587-aa8a-00e7a149d5a8';
update public.races race
set gpx_path = 'catalog/restonica-trail-by-utmb/2027/utc-100m-9f204d9d.gpx', gpx_hash = '9f204d9d9b9e81ee7492829110f1a39922678cf6e528ab6d9a7be713e6d8523f', gpx_storage_path = 'catalog/restonica-trail-by-utmb/2027/utc-100m-9f204d9d.gpx', gpx_sha256 = '9f204d9d9b9e81ee7492829110f1a39922678cf6e528ab6d9a7be713e6d8523f',
      min_alt_m = 413, max_alt_m = 2458.5, start_lat = 42.30906, start_lng = 9.1497,
      bounds_min_lat = 42.20383, bounds_min_lng = 8.86658, bounds_max_lat = 42.37211, bounds_max_lng = 9.15126
where race.id = '5f21812e-9ae0-4587-aa8a-00e7a149d5a8' and race.gpx_storage_path is null;
update public.races race
set elevation_loss_m = 7200
where race.id = '448fe033-d004-4429-87a7-41d2bdb1b0fd';
update public.races race
set gpx_path = 'catalog/restonica-trail-by-utmb/2027/utc-100m-9f204d9d.gpx', gpx_hash = '9f204d9d9b9e81ee7492829110f1a39922678cf6e528ab6d9a7be713e6d8523f', gpx_storage_path = 'catalog/restonica-trail-by-utmb/2027/utc-100m-9f204d9d.gpx', gpx_sha256 = '9f204d9d9b9e81ee7492829110f1a39922678cf6e528ab6d9a7be713e6d8523f',
      min_alt_m = 413, max_alt_m = 2458.5, start_lat = 42.30906, start_lng = 9.1497,
      bounds_min_lat = 42.20383, bounds_min_lng = 8.86658, bounds_max_lat = 42.37211, bounds_max_lng = 9.15126
where race.id = '448fe033-d004-4429-87a7-41d2bdb1b0fd' and race.gpx_storage_path is null;
update public.races race
set elevation_loss_m = 7200
where race.id = 'df8cf938-2319-4fe7-9d28-867af1de2e5b';
update public.races race
set gpx_path = 'catalog/restonica-trail-by-utmb/2027/utc-100m-9f204d9d.gpx', gpx_hash = '9f204d9d9b9e81ee7492829110f1a39922678cf6e528ab6d9a7be713e6d8523f', gpx_storage_path = 'catalog/restonica-trail-by-utmb/2027/utc-100m-9f204d9d.gpx', gpx_sha256 = '9f204d9d9b9e81ee7492829110f1a39922678cf6e528ab6d9a7be713e6d8523f',
      min_alt_m = 413, max_alt_m = 2458.5, start_lat = 42.30906, start_lng = 9.1497,
      bounds_min_lat = 42.20383, bounds_min_lng = 8.86658, bounds_max_lat = 42.37211, bounds_max_lng = 9.15126
where race.id = 'df8cf938-2319-4fe7-9d28-867af1de2e5b' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '02:00', 'startLocation', 'Cours Paoli, Corte', 'timeZone', 'Europe/Paris'))
where race.id = 'f2a0f731-4318-48f4-bd27-7cfdf8ca3bdf';
update public.races race
set gpx_path = 'catalog/restonica-trail-by-utmb/2027/rt-100k-6e051370.gpx', gpx_hash = '6e0513705791e6f2a2dfee291dca4c26f6f02780b0a5477a9ef288ffaf4ba9df', gpx_storage_path = 'catalog/restonica-trail-by-utmb/2027/rt-100k-6e051370.gpx', gpx_sha256 = '6e0513705791e6f2a2dfee291dca4c26f6f02780b0a5477a9ef288ffaf4ba9df',
      min_alt_m = 408, max_alt_m = 2228.7, start_lat = 42.30868, start_lng = 9.14987,
      bounds_min_lat = 42.20383, bounds_min_lng = 8.93779, bounds_max_lat = 42.32649, bounds_max_lng = 9.15261
where race.id = 'f2a0f731-4318-48f4-bd27-7cfdf8ca3bdf' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '05:00', 'startLocation', 'Cours Paoli, Corte', 'timeZone', 'Europe/Paris'))
where race.id = '69f2590b-1972-4fee-a507-c68ccd5e1fe1';
update public.races race
set gpx_path = 'catalog/restonica-trail-by-utmb/2027/pm-50k-8ec68a72.gpx', gpx_hash = '8ec68a72ff58cfd70d1adf19fcc93a2412d3f408bf34ef9ffc1ca945061ae78b', gpx_storage_path = 'catalog/restonica-trail-by-utmb/2027/pm-50k-8ec68a72.gpx', gpx_sha256 = '8ec68a72ff58cfd70d1adf19fcc93a2412d3f408bf34ef9ffc1ca945061ae78b',
      min_alt_m = 388, max_alt_m = 1553, start_lat = 42.30832, start_lng = 9.15002,
      bounds_min_lat = 42.30514, bounds_min_lng = 9.14763, bounds_max_lat = 42.37087, bounds_max_lng = 9.27215
where race.id = '69f2590b-1972-4fee-a507-c68ccd5e1fe1' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '05:30', 'startLocation', 'Cours Paoli, Corte', 'timeZone', 'Europe/Paris'))
where race.id = 'be0ab100-845a-47f8-8c3d-b9b02bb6263f';
update public.races race
set gpx_path = 'catalog/restonica-trail-by-utmb/2027/tt-50k-ee4e930f.gpx', gpx_hash = 'ee4e930f46bd2d5113daa4f4c001034c52c7660eb71e8683abbc9bbf8e404b7d', gpx_storage_path = 'catalog/restonica-trail-by-utmb/2027/tt-50k-ee4e930f.gpx', gpx_sha256 = 'ee4e930f46bd2d5113daa4f4c001034c52c7660eb71e8683abbc9bbf8e404b7d',
      min_alt_m = 408, max_alt_m = 1817, start_lat = 42.30868, start_lng = 9.14987,
      bounds_min_lat = 42.27703, bounds_min_lng = 9.03725, bounds_max_lat = 42.32649, bounds_max_lng = 9.15261
where race.id = 'be0ab100-845a-47f8-8c3d-b9b02bb6263f' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '18:00', 'startLocation', 'Rond-point de la Mairie, Corte', 'timeZone', 'Europe/Paris'))
where race.id = '93250a6b-31ee-463c-a7e0-b6a48e9e3d9c';
update public.races race
set gpx_path = 'catalog/restonica-trail-by-utmb/2027/gt-20k-d0e83f2a.gpx', gpx_hash = 'd0e83f2abe1160af9aa09faa686fab501ac17ec4d687c106a5593cf264d55202', gpx_storage_path = 'catalog/restonica-trail-by-utmb/2027/gt-20k-d0e83f2a.gpx', gpx_sha256 = 'd0e83f2abe1160af9aa09faa686fab501ac17ec4d687c106a5593cf264d55202',
      min_alt_m = 387, max_alt_m = 812.3, start_lat = 42.30768, start_lng = 9.1504,
      bounds_min_lat = 42.30514, bounds_min_lng = 9.14763, bounds_max_lat = 42.33473, bounds_max_lng = 9.21719
where race.id = '93250a6b-31ee-463c-a7e0-b6a48e9e3d9c' and race.gpx_storage_path is null;
update public.races race
set 
where race.id = '1aa693c2-ef9d-472d-adc6-25cd859520c0';
update public.races race
set gpx_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/ultra-100m-893ed928.gpx', gpx_hash = '893ed928df692bc3c6fe7c09e5009c2b3784da20a8eb3d8d8797d446026b6a3c', gpx_storage_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/ultra-100m-893ed928.gpx', gpx_sha256 = '893ed928df692bc3c6fe7c09e5009c2b3784da20a8eb3d8d8797d446026b6a3c',
      min_alt_m = 529, max_alt_m = 1428, start_lat = 44.95979, start_lng = 3.5439,
      bounds_min_lat = 44.89342, bounds_min_lng = 3.5439, bounds_max_lat = 45.06754, bounds_max_lng = 3.88449
where race.id = '1aa693c2-ef9d-472d-adc6-25cd859520c0' and race.gpx_storage_path is null;
update public.races race
set 
where race.id = '6d585447-f398-4e3a-b360-d7cb5d7e2d05';
update public.races race
set gpx_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/grand-trail-100k-f8186799.gpx', gpx_hash = 'f8186799c35eb3645f9e5bd040208976e51f0ffcf328953c52d3a2c36f0ed9d3', gpx_storage_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/grand-trail-100k-f8186799.gpx', gpx_sha256 = 'f8186799c35eb3645f9e5bd040208976e51f0ffcf328953c52d3a2c36f0ed9d3',
      min_alt_m = 610, max_alt_m = 1428, start_lat = 44.96903, start_lng = 3.64606,
      bounds_min_lat = 44.89517, bounds_min_lng = 3.64271, bounds_max_lat = 45.04557, bounds_max_lng = 3.88448
where race.id = '6d585447-f398-4e3a-b360-d7cb5d7e2d05' and race.gpx_storage_path is null;
update public.races race
set 
where race.id = 'c7b83fb3-02ea-459c-b753-c03d4ba959dc';
update public.races race
set gpx_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/monistrail-50k-982cd894.gpx', gpx_hash = '982cd89443e5307e6f1ee99f88dbe45e604e1c8837fa01335eb84cec78758d90', gpx_storage_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/monistrail-50k-982cd894.gpx', gpx_sha256 = '982cd89443e5307e6f1ee99f88dbe45e604e1c8837fa01335eb84cec78758d90',
      min_alt_m = 613, max_alt_m = 1426, start_lat = 44.96879, start_lng = 3.64653,
      bounds_min_lat = 44.93698, bounds_min_lng = 3.64267, bounds_max_lat = 45.04558, bounds_max_lng = 3.88449
where race.id = 'c7b83fb3-02ea-459c-b753-c03d4ba959dc' and race.gpx_storage_path is null;
update public.races race
set 
where race.id = 'fff944aa-93e4-412c-b766-30713ae7db74';
update public.races race
set gpx_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/chibottes-20k-cf84a884.gpx', gpx_hash = 'cf84a884e960428cf24d25eea58e63bc354aa6729dfb142e84e0ee4fabe0102b', gpx_storage_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/chibottes-20k-cf84a884.gpx', gpx_sha256 = 'cf84a884e960428cf24d25eea58e63bc354aa6729dfb142e84e0ee4fabe0102b',
      min_alt_m = 628, max_alt_m = 894, start_lat = 44.9673, start_lng = 3.88298,
      bounds_min_lat = 44.96715, bounds_min_lng = 3.84883, bounds_max_lat = 45.04557, bounds_max_lng = 3.90838
where race.id = 'fff944aa-93e4-412c-b766-30713ae7db74' and race.gpx_storage_path is null;
update public.races race
set 
where race.id = '429f6f0f-0404-4487-9c64-821c61249ad7';
update public.races race
set gpx_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/12-du-dolaizon-61af5b7f.gpx', gpx_hash = '61af5b7f3008f387814c74b31b634e7c9f4a3bd96dc957938d17e3ce67f42691', gpx_storage_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/12-du-dolaizon-61af5b7f.gpx', gpx_sha256 = '61af5b7f3008f387814c74b31b634e7c9f4a3bd96dc957938d17e3ce67f42691',
      min_alt_m = 628, max_alt_m = 912, start_lat = 44.99702, start_lng = 3.82146,
      bounds_min_lat = 44.99702, bounds_min_lng = 3.81993, bounds_max_lat = 45.04557, bounds_max_lng = 3.88448
where race.id = '429f6f0f-0404-4487-9c64-821c61249ad7' and race.gpx_storage_path is null;
update public.races race
set location_text = 'Solignac-sur-Loire, Haute-Loire, France',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) - 'startTimeVerification' || jsonb_build_object('startTime', '07:40', 'timeZone', 'Europe/Paris')),
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '561bb3e8-53aa-4e64-ac78-74836c8b9777';
update public.races race
set gpx_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/rando-28km-2ec4b1e0.gpx', gpx_hash = '2ec4b1e0a5d1b0df052fad2bdc12d93fd03fc5f1e22275cc6bd79878320f518f', gpx_storage_path = 'catalog/trail-du-saint-jacques-by-utmb/2027/rando-28km-2ec4b1e0.gpx', gpx_sha256 = '2ec4b1e0a5d1b0df052fad2bdc12d93fd03fc5f1e22275cc6bd79878320f518f',
      min_alt_m = 628, max_alt_m = 894, start_lat = 44.9673, start_lng = 3.88298,
      bounds_min_lat = 44.96715, bounds_min_lng = 3.84883, bounds_max_lat = 45.04557, bounds_max_lng = 3.90838
where race.id = '561bb3e8-53aa-4e64-ac78-74836c8b9777' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '17:00', 'startLocation', 'Mayres-Savel (plage)', 'timeZone', 'Europe/Paris'))
where race.id = 'c11557de-4c33-4fd0-b9d4-8c2e0cd7b38e';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/trail-du-drac-14km-5b5c2bdf.gpx', gpx_hash = '5b5c2bdfb9ff5913ce547f33af56c7f6cd802473257974b7849b13402b7d9234', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/trail-du-drac-14km-5b5c2bdf.gpx', gpx_sha256 = '5b5c2bdfb9ff5913ce547f33af56c7f6cd802473257974b7849b13402b7d9234',
      min_alt_m = 484, max_alt_m = 927, start_lat = 44.87766, start_lng = 5.69051,
      bounds_min_lat = 44.84822, bounds_min_lng = 5.69042, bounds_max_lat = 44.87816, bounds_max_lng = 5.7158
where race.id = 'c11557de-4c33-4fd0-b9d4-8c2e0cd7b38e' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '08:30', 'startLocation', 'Monteynard', 'timeZone', 'Europe/Paris'))
where race.id = '7afd569a-087f-4645-be15-59e55ccbf1f3';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/le-petit-train-28km-c1948c5c.gpx', gpx_hash = 'c1948c5c83aec19686fb0723b8aded5a49ba67cf731ddc5c425b1dbcda2cc4cf', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/le-petit-train-28km-c1948c5c.gpx', gpx_sha256 = 'c1948c5c83aec19686fb0723b8aded5a49ba67cf731ddc5c425b1dbcda2cc4cf',
      min_alt_m = 534, max_alt_m = 1550, start_lat = 44.96562, start_lng = 5.69887,
      bounds_min_lat = 44.90688, bounds_min_lng = 5.69008, bounds_max_lat = 44.98171, bounds_max_lng = 5.78314
where race.id = '7afd569a-087f-4645-be15-59e55ccbf1f3' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '09:15', 'startLocation', 'La Mine Image, La Motte-d''Aveillans', 'timeZone', 'Europe/Paris'))
where race.id = 'b8e99e9e-938f-4ac1-b69d-25c93f36e9d1';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/mine-express-14km-f36738e7.gpx', gpx_hash = 'f36738e7b7a65638af0a104a1a6bca2b4425e1ff2a0b0b614bc6b56b714665ef', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/mine-express-14km-f36738e7.gpx', gpx_sha256 = 'f36738e7b7a65638af0a104a1a6bca2b4425e1ff2a0b0b614bc6b56b714665ef',
      min_alt_m = 869, max_alt_m = 1550, start_lat = 44.96034, start_lng = 5.74272,
      bounds_min_lat = 44.90688, bounds_min_lng = 5.73433, bounds_max_lat = 44.96034, bounds_max_lng = 5.78314
where race.id = 'b8e99e9e-938f-4ac1-b69d-25c93f36e9d1' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '19:15', 'startLocation', 'Prunières', 'timeZone', 'Europe/Paris'))
where race.id = '86948048-782e-403e-9361-969fdedee188';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/le-3e-poste-16km-6c92ac59.gpx', gpx_hash = '6c92ac59dccd5506a17c364edd5a195a38e8dec8060778f20c9b9238d971cd64', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/le-3e-poste-16km-6c92ac59.gpx', gpx_sha256 = '6c92ac59dccd5506a17c364edd5a195a38e8dec8060778f20c9b9238d971cd64',
      min_alt_m = 837, max_alt_m = 1204, start_lat = 44.89399, start_lng = 5.75954,
      bounds_min_lat = 44.89183, bounds_min_lng = 5.74145, bounds_max_lat = 44.96092, bounds_max_lng = 5.78316
where race.id = '86948048-782e-403e-9361-969fdedee188' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '19:15', 'startLocation', 'Prunières', 'timeZone', 'Europe/Paris'))
where race.id = 'aa5b8523-0e3c-4655-a772-02e6dfd82377';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/le-3e-poste-16km-6c92ac59.gpx', gpx_hash = '6c92ac59dccd5506a17c364edd5a195a38e8dec8060778f20c9b9238d971cd64', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/le-3e-poste-16km-6c92ac59.gpx', gpx_sha256 = '6c92ac59dccd5506a17c364edd5a195a38e8dec8060778f20c9b9238d971cd64',
      min_alt_m = 837, max_alt_m = 1204, start_lat = 44.89399, start_lng = 5.75954,
      bounds_min_lat = 44.89183, bounds_min_lng = 5.74145, bounds_max_lat = 44.96092, bounds_max_lng = 5.78316
where race.id = 'aa5b8523-0e3c-4655-a772-02e6dfd82377' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '09:00', 'startLocation', 'Treffort (base nautique)', 'timeZone', 'Europe/Paris'))
where race.id = 'f5f9eafb-cc1e-4948-9429-b0d416429615';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/trail-de-cote-rouge-27km-6f3bb054.gpx', gpx_hash = '6f3bb0547986ae671c8ee9a84423a4407732306a1c586fe1cb64f1cf1b159a14', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/trail-de-cote-rouge-27km-6f3bb054.gpx', gpx_sha256 = '6f3bb0547986ae671c8ee9a84423a4407732306a1c586fe1cb64f1cf1b159a14',
      min_alt_m = 484, max_alt_m = 1053, start_lat = 44.90542, start_lng = 5.67245,
      bounds_min_lat = 44.86721, bounds_min_lng = 5.6348, bounds_max_lat = 44.92064, bounds_max_lng = 5.67731
where race.id = 'f5f9eafb-cc1e-4948-9429-b0d416429615' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '17:00', 'startLocation', 'Treffort (base nautique)', 'timeZone', 'Europe/Paris'))
where race.id = '061c5336-3d90-41bf-89a4-2f93fe013481';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/trail-de-lebron-16km-63514793.gpx', gpx_hash = '635147937af6337696119e0d4f11a5ea09add3c9e7eda0398ca66b98022893ef', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/trail-de-lebron-16km-63514793.gpx', gpx_sha256 = '635147937af6337696119e0d4f11a5ea09add3c9e7eda0398ca66b98022893ef',
      min_alt_m = 484, max_alt_m = 847, start_lat = 44.90524, start_lng = 5.67246,
      bounds_min_lat = 44.86721, bounds_min_lng = 5.65834, bounds_max_lat = 44.90852, bounds_max_lng = 5.67731
where race.id = '061c5336-3d90-41bf-89a4-2f93fe013481' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '04:30', 'startLocation', 'La Mure', 'timeZone', 'Europe/Paris'))
where race.id = '37fbd9cf-9b29-40d9-8811-5cb6c0bbb84e';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/la-grande-course-68km-9aecf7e3.gpx', gpx_hash = '9aecf7e3aca67545dfdabe397007c05e375a5dd572251301a739187aacc386f6', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/la-grande-course-68km-9aecf7e3.gpx', gpx_sha256 = '9aecf7e3aca67545dfdabe397007c05e375a5dd572251301a739187aacc386f6',
      min_alt_m = 484, max_alt_m = 1768, start_lat = 44.90666, start_lng = 5.78435,
      bounds_min_lat = 44.86237, bounds_min_lng = 5.6704, bounds_max_lat = 44.97591, bounds_max_lng = 5.78542
where race.id = '37fbd9cf-9b29-40d9-8811-5cb6c0bbb84e' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '04:30', 'startLocation', 'La Mure', 'timeZone', 'Europe/Paris'))
where race.id = '7f762fc7-94ca-4fd0-8d4a-e884872549c5';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/la-grande-course-68km-9aecf7e3.gpx', gpx_hash = '9aecf7e3aca67545dfdabe397007c05e375a5dd572251301a739187aacc386f6', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/la-grande-course-68km-9aecf7e3.gpx', gpx_sha256 = '9aecf7e3aca67545dfdabe397007c05e375a5dd572251301a739187aacc386f6',
      min_alt_m = 484, max_alt_m = 1768, start_lat = 44.90666, start_lng = 5.78435,
      bounds_min_lat = 44.86237, bounds_min_lng = 5.6704, bounds_max_lat = 44.97591, bounds_max_lng = 5.78542
where race.id = '7f762fc7-94ca-4fd0-8d4a-e884872549c5' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '06:30', 'startLocation', 'Treffort (base nautique)', 'timeZone', 'Europe/Paris'))
where race.id = '22f51bd7-6494-47be-903e-6b0a51bc35dc';
update public.races race
set gpx_path = 'catalog/trail-passerelles-monteynard/2027/maratrail-44km-9a82cea4.gpx', gpx_hash = '9a82cea48f6480dad85f3a5bf862eaf48717a587a808e838256044c03b5f468c', gpx_storage_path = 'catalog/trail-passerelles-monteynard/2027/maratrail-44km-9a82cea4.gpx', gpx_sha256 = '9a82cea48f6480dad85f3a5bf862eaf48717a587a808e838256044c03b5f468c',
      min_alt_m = 484, max_alt_m = 1768, start_lat = 44.90522, start_lng = 5.67219,
      bounds_min_lat = 44.86237, bounds_min_lng = 5.66921, bounds_max_lat = 44.91914, bounds_max_lng = 5.74053
where race.id = '22f51bd7-6494-47be-903e-6b0a51bc35dc' and race.gpx_storage_path is null;
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '09:30', 'startLocation', 'Mayres-Savel (plage)', 'timeZone', 'Europe/Paris'))
where race.id = '16b7cc81-cbe0-48e4-80e7-2d047f5c7de0';
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '09:00', 'startLocation', 'Seyssins (parc François Mitterrand)', 'timeZone', 'Europe/Paris'))
where race.id = '8879f8da-a8e4-4f8c-a733-65e3800d3ad7';
update public.races race
set distance_km = 174.9,
    elevation_gain_m = 11370,
    elevation_loss_m = 11416,
    source_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-180-challenge', external_site_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-180-challenge',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '08:00', 'startLocation', 'Seyssins (parc François Mitterrand)', 'timeZone', 'Europe/Paris'))
where race.id = '0a8bc5e2-d53c-4ab2-a3f1-e78e9a6cb070';
update public.races race
set name = 'Ut4M 100 Master BC',
    elevation_gain_m = 5579,
    elevation_loss_m = 5777,
    source_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-100-master-bc', external_site_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-100-master-bc',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '07:00', 'startLocation', 'Uriage (parc d''Uriage)', 'timeZone', 'Europe/Paris'))
where race.id = '50012bf3-69ee-477b-a760-84183670bc7d';
update public.races race
set distance_km = 81.1,
    elevation_gain_m = 6127,
    elevation_loss_m = 4306,
    source_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-80-challenge', external_site_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-80-challenge',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '09:00', 'startLocation', 'Seyssins (parc François Mitterrand)', 'timeZone', 'Europe/Paris'))
where race.id = 'f2a6f5a4-a139-4dcb-9a96-91062c677638';
update public.races race
set distance_km = 43.8,
    elevation_gain_m = 2970,
    elevation_loss_m = 2863,
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '08:00', 'startLocation', 'Seyssins (parc François Mitterrand)', 'timeZone', 'Europe/Paris'))
where race.id = '99043a59-437e-43f6-baa6-9ee1be791361';
update public.races race
set distance_km = 46.5,
    elevation_gain_m = 3204,
    elevation_loss_m = 3022,
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '08:00', 'startLocation', 'Saint-Georges-de-Commiers', 'timeZone', 'Europe/Paris'))
where race.id = 'f55ab183-5e7c-4d3c-9e16-e78f85a4ace8';
update public.races race
set distance_km = 46.5,
    elevation_gain_m = 2796,
    elevation_loss_m = 3058,
    source_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-50-belledonne', external_site_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-50-belledonne',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '07:40', 'startLocation', 'Rioupéroux', 'timeZone', 'Europe/Paris'))
where race.id = 'bb604487-8a89-4f80-8b31-1b0b2d74c7be';
update public.races race
set source_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-40-chartreuse', external_site_url = 'https://ut4m.fr/fr/courses/les-14-courses/ut4m-40-chartreuse',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '07:00', 'startLocation', 'Saint-Nazaire-les-Eymes (salle Cartier Millon)', 'timeZone', 'Europe/Paris'))
where race.id = 'b74c0aa5-c122-49c3-a293-dd6176e98c46';
update public.races race
set distance_km = 20.6,
    elevation_gain_m = 1785,
    elevation_loss_m = 878,
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '09:00', 'startLocation', 'Seyssins (parc François Mitterrand)', 'timeZone', 'Europe/Paris'))
where race.id = 'b8704709-3db0-4fae-8cdf-dda656ba3507';
update public.races race
set distance_km = 22.1,
    elevation_gain_m = 1739,
    elevation_loss_m = 1280,
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '08:20', 'startLocation', 'Laffrey (prairie de la Rencontre)', 'timeZone', 'Europe/Paris'))
where race.id = '1202fb5e-9516-4cd3-bb65-41d7767c9738';
update public.races race
set elevation_gain_m = 1957,
    elevation_loss_m = 711,
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '10:00', 'startLocation', 'Uriage (parc d''Uriage)', 'timeZone', 'Europe/Paris'))
where race.id = '290cbccb-3b1f-411a-9bfa-85c64016d07d';
update public.races race
set organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '22:00', 'startLocation', 'Le Sappey-en-Chartreuse', 'timeZone', 'Europe/Paris'))
where race.id = 'fccf60a4-be39-4512-93b3-b73ab6fb669a';
update public.races race
set elevation_gain_m = 1028,
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '08:50', 'startLocation', 'Seyssins (parc François Mitterrand)', 'timeZone', 'Europe/Paris'))
where race.id = '6896897c-fa12-4004-91d1-fe5f83c25cf1';
update public.races race
set location_text = 'Champagnole, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = 'd18cae34-28cf-4dde-bdcd-ba7915b9d08f';
update public.races race
set location_text = 'Les Rousses, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '93186f08-905a-40ed-8b9f-b61a4e748061';
update public.races race
set location_text = 'Les Rousses, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = 'df14dd83-ae61-40e3-9401-ca35858280c9';
update public.races race
set distance_km = 66,
    location_text = 'Les Rousses, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '7951eb43-296b-473f-ad7e-c1040b7f153a';
update public.races race
set location_text = 'Morbier, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = 'e43da4d7-2d52-4f77-9cbf-f76d8d211fee';
update public.races race
set location_text = 'Les Rousses, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '37b9e932-eedd-4a94-9d0f-885374b3f14a';
update public.races race
set distance_km = 17,
    location_text = 'Les Tuffes, Les Rousses, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '2b99acf0-2b7d-4107-aefe-12312f01ea4c';
update public.races race
set distance_km = 17,
    location_text = 'Les Tuffes, Les Rousses, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '2a44a6b9-ffdd-4a26-a02f-cddf1ce6921d';
update public.races race
set location_text = 'Les Rousses, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '2ea47627-559d-44ea-b8da-219876a13cfe';
update public.races race
set location_text = 'Les Rousses, Jura, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = 'f78bc572-851e-430d-be56-0aa6037e9319';
update public.races race
set elevation_loss_m = 4264,
    location_text = 'Château de Montmelas, Montmelas-Saint-Sorlin, Rhône, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '27941789-5b48-4c43-8e0a-4d904d70a80d';
update public.races race
set elevation_loss_m = 2722,
    location_text = 'Château de Varennes, Quincié-en-Beaujolais, Rhône, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '57ec9074-5a05-4fcc-8c76-9c75af4a0622';
update public.races race
set elevation_loss_m = 1913,
    location_text = 'Chénelette, Rhône, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = 'dc9fb49e-c439-4925-8da1-a9e94337b7f9';
update public.races race
set name = 'Trail Mathusalem 33 km',
    elevation_loss_m = 1322,
    location_text = 'Fleurie, Rhône, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '2dc476ba-82c3-4896-bfec-a56b4e1bbfc9';
update public.races race
set name = 'Trail Jéroboam 21 km',
    elevation_loss_m = 876,
    location_text = 'Fleurie, Rhône, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '86294783-e683-409f-9249-9cfa809aaa27';
update public.races race
set name = 'Trail Magnum 12 km',
    elevation_loss_m = 376,
    location_text = 'Fleurie, Rhône, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '75d9ecb2-0b56-40b6-a84b-6eaef01f07c2';
update public.races race
set name = 'Marche nordique La Madone 12 km',
    elevation_loss_m = 376,
    location_text = 'Fleurie, Rhône, France',
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '1be06da1-61c2-4b13-ae43-6d295a6cfb1b';
update public.races race
set name = 'Grand Trail des 2 Roches — 60 km',
    location_text = 'Domaine de Champgrenon, Charnay-lès-Mâcon, Saône-et-Loire, France',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '19:00', 'startLocation', 'Domaine de Champgrenon, Charnay-lès-Mâcon', 'timeZone', 'Europe/Paris')),
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = 'bb4c2742-97c3-4ec9-b3a8-bb4863c19984';
update public.races race
set name = 'Grand Trail des 2 Roches — 42 km',
    location_text = 'Domaine de Champgrenon, Charnay-lès-Mâcon, Saône-et-Loire, France',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '19:45', 'startLocation', 'Domaine de Champgrenon, Charnay-lès-Mâcon', 'timeZone', 'Europe/Paris')),
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '21814f5b-c594-40c2-8a34-95d62708677c';
update public.races race
set name = 'Grand Trail des 2 Roches — 29 km',
    location_text = 'Domaine de Champgrenon, Charnay-lès-Mâcon, Saône-et-Loire, France',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '20:30', 'startLocation', 'Domaine de Champgrenon, Charnay-lès-Mâcon', 'timeZone', 'Europe/Paris')),
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = 'dee7151b-fe0b-478e-8597-12bb45cc4f8e';
update public.races race
set name = 'Grand Trail des 2 Roches — 13 km',
    location_text = 'Domaine de Champgrenon, Charnay-lès-Mâcon, Saône-et-Loire, France',
    organizer_details = coalesce(race.organizer_details, '{}'::jsonb)
      || jsonb_build_object('schedule', coalesce(race.organizer_details->'schedule', '{}'::jsonb) || jsonb_build_object('startTime', '21:15', 'startLocation', 'Domaine de Champgrenon, Charnay-lès-Mâcon', 'timeZone', 'Europe/Paris')),
    data_status = 'complete', is_live = false, is_public = false, racebook_preview_is_visible = true, racebook_is_live = false
where race.id = '3689f9ff-9767-47d4-9a65-cf9059e87262';

-- New private Ut4M formats published on ut4m.fr for 2027.
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ut4m-100-master-vt-2027', 'Ut4M 100 Master VT', 'Seyssins (parc François Mitterrand), Isère, France', 'Seyssins (parc François Mitterrand), Isère, France', 90.7, 6241, 5953,
  'https://ut4m.fr/fr/courses/ut4m-master-100-vt', 'https://ut4m.fr/fr/courses/ut4m-master-100-vt', false, false, false, false,
  true, false, date '2027-07-16', false, '99fe553b-6057-40c8-82a9-6ccdb2d8aa76'::uuid,
  gen_random_uuid(), 'Ut4M 100 Master VT', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '09:00', 'startLocation', 'Seyssins (parc François Mitterrand)', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ut4m-100-master-vt-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ut4m-jeunes-2027', 'Ut4M Jeunes', 'Chamrousse, Isère, France', 'Chamrousse, Isère, France', 8.6, 635, 635,
  'https://ut4m.fr/fr/courses/ut4m-jeunes', 'https://ut4m.fr/fr/courses/ut4m-jeunes', false, false, false, false,
  true, false, date '2027-07-17', false, '99fe553b-6057-40c8-82a9-6ccdb2d8aa76'::uuid,
  gen_random_uuid(), 'Ut4M Jeunes', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '10:00', 'startLocation', 'Chamrousse', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ut4m-jeunes-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ut4m-randonnee-2027', 'Randonnée Ut4M', 'Col de Vence, Isère, France', 'Col de Vence, Isère, France', 9.4, 167, 726,
  'https://ut4m.fr/fr/courses/randonnee-ut4m', 'https://ut4m.fr/fr/courses/randonnee-ut4m', false, false, false, false,
  true, false, date '2027-07-18', false, '99fe553b-6057-40c8-82a9-6ccdb2d8aa76'::uuid,
  gen_random_uuid(), 'Randonnée Ut4M', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startLocation', 'Col de Vence', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ut4m-randonnee-2027');

-- Lozère Trail
insert into public.race_events (
  name, location, description, website_url, race_date, is_live, organizer_details,
  location_city, location_department, location_department_code, location_region,
  location_region_code, location_country, location_country_code
)
select 'Lozère Trail', 'Chanac, Lozère, France', 'Trail en Lozère entre les Gorges du Tarn et les Grands Causses, avec départs à Sainte-Énimie et à Chanac, du 12 km à l''ultra de 110 km en deux étapes.', 'https://www.lozeretrail.com/', date '2027-05-15', true,
  jsonb_build_object(
    'officialWebsiteUrl', 'https://www.lozeretrail.com/',
    'dateRange', jsonb_build_object('endDate', '2027-05-16'),
    'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026')
  ),
  'Chanac', 'Lozère', '48', 'Occitanie', '76', 'France', 'FR'
where not exists (select 1 from public.race_events existing where lower(existing.name) = lower('Lozère Trail'));

insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current, is_visible)
select event.id, 2027, date '2027-05-15', date '2027-05-16', true, true
from public.race_events event
where lower(event.name) = lower('Lozère Trail')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date, end_date = excluded.end_date;

insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'lozere-trail-ultra-110-km-2027', 'Ultra Lozère 110 km (2 étapes)', 'Sainte-Énimie, Lozère, France', 'Sainte-Énimie, Lozère, France', 110, 5600, 0,
  'https://www.lozeretrail.com/110-km/', 'https://www.lozeretrail.com/110-km/', false, false, false, false,
  true, false, date '2027-05-15', false, (select id from public.race_events where lower(name) = lower('Lozère Trail')),
  gen_random_uuid(), 'Ultra Lozère 110 km (2 étapes)', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '06:00', 'startLocation', 'Sainte-Énimie', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'note', 'Deux étapes : 56 km (D+ 3200) le samedi puis 54 km (D+ 2400) le dimanche, arrivée à Chanac.'))
where not exists (select 1 from public.races existing where existing.slug = 'lozere-trail-ultra-110-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'lozere-trail-skyrace-gorges-du-tarn-25-km-2027', 'SkyRace Gorges du Tarn 25 km', 'Sainte-Énimie, Lozère, France', 'Sainte-Énimie, Lozère, France', 25, 1900, 0,
  'https://www.lozeretrail.com/epreuves/skyrace-gorges-du-tarn-25km/', 'https://www.lozeretrail.com/epreuves/skyrace-gorges-du-tarn-25km/', false, false, false, false,
  true, false, date '2027-05-15', false, (select id from public.race_events where lower(name) = lower('Lozère Trail')),
  gen_random_uuid(), 'SkyRace Gorges du Tarn 25 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '10:00', 'startLocation', 'Sainte-Énimie', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026)),
  'catalog/lozere-trail/2027/skyrace-gorges-du-tarn-25km-80f739ce.gpx', '80f739ced0fab221a489ee487b8d323e091128dc6df933b2aa859624d1c6be53', 'catalog/lozere-trail/2027/skyrace-gorges-du-tarn-25km-80f739ce.gpx', '80f739ced0fab221a489ee487b8d323e091128dc6df933b2aa859624d1c6be53', 470, 991, 44.36574, 3.41056,
  44.33852, 3.4074, 44.37348, 3.48226
where not exists (select 1 from public.races existing where existing.slug = 'lozere-trail-skyrace-gorges-du-tarn-25-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'lozere-trail-2-rivieres-52-km-2027', 'Lozère Trail 2 Rivières 52 km', 'Sainte-Énimie, Lozère, France', 'Sainte-Énimie, Lozère, France', 52, 2400, 0,
  'https://www.lozeretrail.com/52-km/', 'https://www.lozeretrail.com/52-km/', false, false, false, false,
  true, false, date '2027-05-16', false, (select id from public.race_events where lower(name) = lower('Lozère Trail')),
  gen_random_uuid(), 'Lozère Trail 2 Rivières 52 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '08:00', 'startLocation', 'Sainte-Énimie', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026)),
  'catalog/lozere-trail/2027/lozere-trail-2-rivieres-52km-604d376c.gpx', '604d376ced44742f29938870ca148234a182671fef89a06c99bba0c7451cf9df', 'catalog/lozere-trail/2027/lozere-trail-2-rivieres-52km-604d376c.gpx', '604d376ced44742f29938870ca148234a182671fef89a06c99bba0c7451cf9df', 466, 1028, 44.36551, 3.41026,
  44.31457, 3.34644, 44.46781, 3.42055
where not exists (select 1 from public.races existing where existing.slug = 'lozere-trail-2-rivieres-52-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'lozere-trail-25-km-2027', 'Lozère Trail 25 km', 'Chanac, Lozère, France', 'Chanac, Lozère, France', 25, 1100, 0,
  'https://www.lozeretrail.com/26-km/', 'https://www.lozeretrail.com/26-km/', false, false, false, false,
  true, false, date '2027-05-16', false, (select id from public.race_events where lower(name) = lower('Lozère Trail')),
  gen_random_uuid(), 'Lozère Trail 25 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '09:00', 'startLocation', 'Chanac', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026)),
  'catalog/lozere-trail/2027/lozere-trail-25km-a267c3ae.gpx', 'a267c3ae5c86126bb4d27f7a7fb37b5e23ea46410cd089eb1025464ae68147fb', 'catalog/lozere-trail/2027/lozere-trail-25km-a267c3ae.gpx', 'a267c3ae5c86126bb4d27f7a7fb37b5e23ea46410cd089eb1025464ae68147fb', 619.8, 997, 44.465250000000005, 3.34669,
  44.46399, 3.2950500000000003, 44.50057, 3.3492300000000004
where not exists (select 1 from public.races existing where existing.slug = 'lozere-trail-25-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'lozere-trail-salta-bartas-12-km-2027', 'Salta Bartas 12 km', 'Chanac, Lozère, France', 'Chanac, Lozère, France', 12, 500, 0,
  'https://www.lozeretrail.com/13-km/', 'https://www.lozeretrail.com/13-km/', false, false, false, false,
  true, false, date '2027-05-16', false, (select id from public.race_events where lower(name) = lower('Lozère Trail')),
  gen_random_uuid(), 'Salta Bartas 12 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '09:30', 'startLocation', 'Chanac', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026)),
  'catalog/lozere-trail/2027/salta-bartas-12km-abe703f3.gpx', 'abe703f3cd4c3315767494a3b3c274ad02dce874f24f8c6c01a7eaccd1f5d6cd', 'catalog/lozere-trail/2027/salta-bartas-12km-abe703f3.gpx', 'abe703f3cd4c3315767494a3b3c274ad02dce874f24f8c6c01a7eaccd1f5d6cd', 647.9, 930.2, 44.465250000000005, 3.34669,
  44.464020000000005, 3.3008900000000003, 44.474720000000005, 3.34669
where not exists (select 1 from public.races existing where existing.slug = 'lozere-trail-salta-bartas-12-km-2027');

-- Marathon de la Bière
insert into public.race_events (
  name, location, description, website_url, race_date, is_live, organizer_details,
  location_city, location_department, location_department_code, location_region,
  location_region_code, location_country, location_country_code
)
select 'Marathon de la Bière', 'Montbrison, Loire, France', 'Week-end de course à pied à Montbrison, au cœur du Forez, avec trois trails de 11 à 28 km, des courses sur route et une randonnée solidaire.', 'https://lemarathondelabiere.com/', date '2027-05-14', true,
  jsonb_build_object(
    'officialWebsiteUrl', 'https://lemarathondelabiere.com/',
    'dateRange', jsonb_build_object('endDate', '2027-05-17'),
    'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026')
  ),
  'Montbrison', 'Loire', '42', 'Auvergne-Rhône-Alpes', '84', 'France', 'FR'
where not exists (select 1 from public.race_events existing where lower(existing.name) = lower('Marathon de la Bière'));

insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current, is_visible)
select event.id, 2027, date '2027-05-14', date '2027-05-17', true, true
from public.race_events event
where lower(event.name) = lower('Marathon de la Bière')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date, end_date = excluded.end_date;

insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'marathon-de-la-biere-trail-28-km-2027', 'Trail 28 km', 'Espace des Jacquins, Montbrison, Loire, France', 'Espace des Jacquins, Montbrison, Loire, France', 28, 1000, 0,
  'https://lemarathondelabiere.com/trails/', 'https://lemarathondelabiere.com/trails/', false, false, false, false,
  true, false, date '2027-05-15', false, (select id from public.race_events where lower(name) = lower('Marathon de la Bière')),
  gen_random_uuid(), 'Trail 28 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '08:00', 'startLocation', 'Espace des Jacquins', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'marathon-de-la-biere-trail-28-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'marathon-de-la-biere-trail-18-km-2027', 'Trail 18 km', 'Espace des Jacquins, Montbrison, Loire, France', 'Espace des Jacquins, Montbrison, Loire, France', 18, 500, 0,
  'https://lemarathondelabiere.com/trails/', 'https://lemarathondelabiere.com/trails/', false, false, false, false,
  true, false, date '2027-05-15', false, (select id from public.race_events where lower(name) = lower('Marathon de la Bière')),
  gen_random_uuid(), 'Trail 18 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '08:30', 'startLocation', 'Espace des Jacquins', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'marathon-de-la-biere-trail-18-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'marathon-de-la-biere-trail-11-km-2027', 'Trail 11 km', 'Espace des Jacquins, Montbrison, Loire, France', 'Espace des Jacquins, Montbrison, Loire, France', 11, 200, 0,
  'https://lemarathondelabiere.com/trails/', 'https://lemarathondelabiere.com/trails/', false, false, false, false,
  true, false, date '2027-05-15', false, (select id from public.race_events where lower(name) = lower('Marathon de la Bière')),
  gen_random_uuid(), 'Trail 11 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '08:45', 'startLocation', 'Espace des Jacquins', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'marathon-de-la-biere-trail-11-km-2027');

-- Saint So Course (2027 date provisional: formats stay masked drafts)
insert into public.race_events (
  name, location, description, website_url, race_date, is_live, organizer_details,
  location_city, location_department, location_department_code, location_region,
  location_region_code, location_country, location_country_code
)
select 'Saint So Course', 'Saint-Sorlin-en-Bugey, Ain, France', 'Trail organisé à Saint-Sorlin-en-Bugey (Ain), avec trois parcours de 11, 23 et 42 km au départ du foyer rural.', 'https://www.saintsocourse.com/', date '2027-09-18', true,
  jsonb_build_object(
    'officialWebsiteUrl', 'https://www.saintsocourse.com/',
    'dateRange', jsonb_build_object('endDate', '2027-09-18'),
    'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'provisionalDate', true)
  ),
  'Saint-Sorlin-en-Bugey', 'Ain', '01', 'Auvergne-Rhône-Alpes', '84', 'France', 'FR'
where not exists (select 1 from public.race_events existing where lower(existing.name) = lower('Saint So Course'));

insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current, is_visible)
select event.id, 2027, date '2027-09-18', date '2027-09-18', true, true
from public.race_events event
where lower(event.name) = lower('Saint So Course')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date, end_date = excluded.end_date;

insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'saint-so-course-maratrail-des-cretes-42-km-2027', 'Le Maratrail des Crêtes 42 km', 'Foyer rural, Saint-Sorlin-en-Bugey, Ain, France', 'Foyer rural, Saint-Sorlin-en-Bugey, Ain, France', 42, 2100, 0,
  'https://www.saintsocourse.com/42km', 'https://www.saintsocourse.com/42km', false, false, false, false,
  false, false, date '2027-09-18', false, (select id from public.race_events where lower(name) = lower('Saint So Course')),
  gen_random_uuid(), 'Le Maratrail des Crêtes 42 km', 'draft', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '08:15', 'startLocation', 'Foyer rural', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026, 'provisionalDate', true)),
  'catalog/saint-so-course/2027/42km-maratrail-des-cretes-b2b0e2cc.gpx', 'b2b0e2cc4de3dd4578d7c734085f8d476f20be5233a466452f25b07fec9ccaff', 'catalog/saint-so-course/2027/42km-maratrail-des-cretes-b2b0e2cc.gpx', 'b2b0e2cc4de3dd4578d7c734085f8d476f20be5233a466452f25b07fec9ccaff', 198, 981, 45.88481, 5.3703,
  45.85359, 5.36785, 45.9234, 5.46378
where not exists (select 1 from public.races existing where existing.slug = 'saint-so-course-maratrail-des-cretes-42-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'saint-so-course-la-roche-percee-23-km-2027', 'La Roche Percée 23 km', 'Foyer rural, Saint-Sorlin-en-Bugey, Ain, France', 'Foyer rural, Saint-Sorlin-en-Bugey, Ain, France', 23, 1100, 0,
  'https://www.saintsocourse.com/23km', 'https://www.saintsocourse.com/23km', false, false, false, false,
  false, false, date '2027-09-18', false, (select id from public.race_events where lower(name) = lower('Saint So Course')),
  gen_random_uuid(), 'La Roche Percée 23 km', 'draft', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '09:15', 'startLocation', 'Foyer rural', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026, 'provisionalDate', true)),
  'catalog/saint-so-course/2027/23km-la-roche-percee-6c95e88d.gpx', '6c95e88dcae8fbf3542aacf53ae6ee56efb83ac4b40464af50389e74e36720ae', 'catalog/saint-so-course/2027/23km-la-roche-percee-6c95e88d.gpx', '6c95e88dcae8fbf3542aacf53ae6ee56efb83ac4b40464af50389e74e36720ae', 198, 816, 45.88481, 5.3703,
  45.86938, 5.36785, 45.90351, 5.43985
where not exists (select 1 from public.races existing where existing.slug = 'saint-so-course-la-roche-percee-23-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'saint-so-course-la-pouponne-11-km-2027', 'La Pouponne 11 km', 'Foyer rural, Saint-Sorlin-en-Bugey, Ain, France', 'Foyer rural, Saint-Sorlin-en-Bugey, Ain, France', 11, 390, 0,
  'https://www.saintsocourse.com/11km', 'https://www.saintsocourse.com/11km', false, false, false, false,
  false, false, date '2027-09-18', false, (select id from public.race_events where lower(name) = lower('Saint So Course')),
  gen_random_uuid(), 'La Pouponne 11 km', 'draft', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '10:15', 'startLocation', 'Foyer rural', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026, 'provisionalDate', true)),
  'catalog/saint-so-course/2027/11km-la-pouponne-20bfc2af.gpx', '20bfc2afb498e4521050e71b4ab933949ee138a24241ae5613d8f8237623febd', 'catalog/saint-so-course/2027/11km-la-pouponne-20bfc2af.gpx', '20bfc2afb498e4521050e71b4ab933949ee138a24241ae5613d8f8237623febd', 197.8, 378.5, 45.88490995578468, 5.370069947093725,
  45.86500997655094, 5.367879923433065, 45.887669948861, 5.40260992012918
where not exists (select 1 from public.races existing where existing.slug = 'saint-so-course-la-pouponne-11-km-2027');

-- Trail Margeride
insert into public.race_events (
  name, location, description, website_url, race_date, is_live, organizer_details,
  location_city, location_department, location_department_code, location_region,
  location_region_code, location_country, location_country_code
)
select 'Trail Margeride', 'Le Malzieu-Ville, Lozère, France', 'Trail organisé en septembre au Malzieu-Ville, en Margeride, sur les pas de la Bête du Gévaudan, avec quatre courses de 10 à 43 km et une randonnée.', 'https://trail-margeride.org/', date '2027-09-11', true,
  jsonb_build_object(
    'officialWebsiteUrl', 'https://trail-margeride.org/',
    'dateRange', jsonb_build_object('endDate', '2027-09-12'),
    'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026')
  ),
  'Le Malzieu-Ville', 'Lozère', '48', 'Occitanie', '76', 'France', 'FR'
where not exists (select 1 from public.race_events existing where lower(existing.name) = lower('Trail Margeride'));

insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current, is_visible)
select event.id, 2027, date '2027-09-11', date '2027-09-12', true, true
from public.race_events event
where lower(event.name) = lower('Trail Margeride')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date, end_date = excluded.end_date;

insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-margeride-sobre-los-pas-de-la-bestia-43-km-2027', 'Sobre los pas de la Bestia 43 km', 'Le Malzieu-Ville, Lozère, France', 'Le Malzieu-Ville, Lozère, France', 43, 1300, 0,
  'https://trail-margeride.org/45km/', 'https://trail-margeride.org/45km/', false, false, false, false,
  true, false, date '2027-09-12', false, (select id from public.race_events where lower(name) = lower('Trail Margeride')),
  gen_random_uuid(), 'Sobre los pas de la Bestia 43 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '08:00', 'startLocation', 'Le Malzieu-Ville', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2027)),
  'catalog/trail-margeride/2027/43km-sobre-los-pas-de-la-bestia-19092f99.gpx', '19092f99522ddfecca7bbcd739dbd0d4f5db5df5955ad3623fc1ec23a9dcdd69', 'catalog/trail-margeride/2027/43km-sobre-los-pas-de-la-bestia-19092f99.gpx', '19092f99522ddfecca7bbcd739dbd0d4f5db5df5955ad3623fc1ec23a9dcdd69', 858, 1441, 44.85486, 3.33253,
  44.80917, 3.32107, 44.90866, 3.41011
where not exists (select 1 from public.races existing where existing.slug = 'trail-margeride-sobre-los-pas-de-la-bestia-43-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-margeride-lou-pas-del-ase-26-km-2027', 'Lou pas del Ase 26 km', 'Le Malzieu-Ville, Lozère, France', 'Le Malzieu-Ville, Lozère, France', 26, 820, 0,
  'https://trail-margeride.org/24km/', 'https://trail-margeride.org/24km/', false, false, false, false,
  true, false, date '2027-09-12', false, (select id from public.race_events where lower(name) = lower('Trail Margeride')),
  gen_random_uuid(), 'Lou pas del Ase 26 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '09:00', 'startLocation', 'Le Malzieu-Ville', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2027)),
  'catalog/trail-margeride/2027/26km-lou-pas-del-ase-7306143f.gpx', '7306143feba9ce1ef89eff76887990da6f17feca32c97e5625dfa5aee40e3905', 'catalog/trail-margeride/2027/26km-lou-pas-del-ase-7306143f.gpx', '7306143feba9ce1ef89eff76887990da6f17feca32c97e5625dfa5aee40e3905', 857, 1441, 44.85487, 3.33252,
  44.85012, 3.33229, 44.90866, 3.41011
where not exists (select 1 from public.races existing where existing.slug = 'trail-margeride-lou-pas-del-ase-26-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-margeride-lo-clapas-17-km-2027', 'Lo Clapas 17 km', 'Le Malzieu-Ville, Lozère, France', 'Le Malzieu-Ville, Lozère, France', 17, 410, 0,
  'https://trail-margeride.org/15km-randonnee/', 'https://trail-margeride.org/15km-randonnee/', false, false, false, false,
  true, false, date '2027-09-12', false, (select id from public.race_events where lower(name) = lower('Trail Margeride')),
  gen_random_uuid(), 'Lo Clapas 17 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '10:30', 'startLocation', 'Le Malzieu-Ville', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2027)),
  'catalog/trail-margeride/2027/17km-los-clapas-0a3e2d34.gpx', '0a3e2d342c1e5d5763c407b3b74da4a48e30a42344d6f719b5d3d03f79c1417b', 'catalog/trail-margeride/2027/17km-los-clapas-0a3e2d34.gpx', '0a3e2d342c1e5d5763c407b3b74da4a48e30a42344d6f719b5d3d03f79c1417b', 857, 1073, 44.85486, 3.33252,
  44.80917, 3.32107, 44.85505, 3.34888
where not exists (select 1 from public.races existing where existing.slug = 'trail-margeride-lo-clapas-17-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-margeride-veillade-dels-barons-10-km-2027', 'La Veillade dels Barons 10 km (semi-nocturne)', 'Le Malzieu-Ville, Lozère, France', 'Le Malzieu-Ville, Lozère, France', 10, 250, 0,
  'https://trail-margeride.org/10km-semi-nocturne/', 'https://trail-margeride.org/10km-semi-nocturne/', false, false, false, false,
  true, false, date '2027-09-11', false, (select id from public.race_events where lower(name) = lower('Trail Margeride')),
  gen_random_uuid(), 'La Veillade dels Barons 10 km (semi-nocturne)', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '20:00', 'startLocation', 'Le Malzieu-Ville', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2027)),
  'catalog/trail-margeride/2027/10km-veillade-dels-barons-1d145322.gpx', '1d1453220e1d2756ec02eded975325bcf6f0f3a6aba3d6d511d5b2f2dcc324a5', 'catalog/trail-margeride/2027/10km-veillade-dels-barons-1d145322.gpx', '1d1453220e1d2756ec02eded975325bcf6f0f3a6aba3d6d511d5b2f2dcc324a5', 856, 994, 44.85487, 3.33251,
  44.82872, 3.3325, 44.85507, 3.34888
where not exists (select 1 from public.races existing where existing.slug = 'trail-margeride-veillade-dels-barons-10-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-margeride-randonnee-15-km-2027', 'Randonnée Ame mes esclops 15 km', 'Le Malzieu-Ville, Lozère, France', 'Le Malzieu-Ville, Lozère, France', 15, 410, 0,
  'https://trail-margeride.org/15km-randonnee/', 'https://trail-margeride.org/15km-randonnee/', false, false, false, false,
  true, false, date '2027-09-12', false, (select id from public.race_events where lower(name) = lower('Trail Margeride')),
  gen_random_uuid(), 'Randonnée Ame mes esclops 15 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '09:30', 'startLocation', 'Le Malzieu-Ville', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2027)),
  'catalog/trail-margeride/2027/15km-rando-22951799.gpx', '22951799e901653cbe4092f25c94a3419414c009ed2323bb8e3b2d58bffacdd0', 'catalog/trail-margeride/2027/15km-rando-22951799.gpx', '22951799e901653cbe4092f25c94a3419414c009ed2323bb8e3b2d58bffacdd0', 857, 1125, 44.85488, 3.33253,
  44.85011, 3.33135, 44.88674, 3.37615
where not exists (select 1 from public.races existing where existing.slug = 'trail-margeride-randonnee-15-km-2027');

-- Ultra Trail Grand Colombier
insert into public.race_events (
  name, location, description, website_url, race_date, is_live, organizer_details,
  location_city, location_department, location_department_code, location_region,
  location_region_code, location_country, location_country_code
)
select 'Ultra Trail Grand Colombier', 'Culoz-Béon, Ain, France', 'Ultra-trail autour du massif du Grand Colombier, dans le Bugey, du 10 km au 120 km, avec arrivée à Culoz pour la plupart des formats.', 'https://ultratrailgrandcolombier.com/', date '2027-09-25', true,
  jsonb_build_object(
    'officialWebsiteUrl', 'https://ultratrailgrandcolombier.com/',
    'dateRange', jsonb_build_object('endDate', '2027-09-25'),
    'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026')
  ),
  'Culoz-Béon', 'Ain', '01', 'Auvergne-Rhône-Alpes', '84', 'France', 'FR'
where not exists (select 1 from public.race_events existing where lower(existing.name) = lower('Ultra Trail Grand Colombier'));

insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current, is_visible)
select event.id, 2027, date '2027-09-25', date '2027-09-25', true, true
from public.race_events event
where lower(event.name) = lower('Ultra Trail Grand Colombier')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date, end_date = excluded.end_date;

insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ultra-trail-grand-colombier-120-km-2027', 'UTGC 120 km', 'Belley, Ain, France', 'Belley, Ain, France', 120, 5000, 0,
  'https://ultratrailgrandcolombier.com/utgc-120km/', 'https://ultratrailgrandcolombier.com/utgc-120km/', false, false, false, false,
  true, false, date '2027-09-25', false, (select id from public.race_events where lower(name) = lower('Ultra Trail Grand Colombier')),
  gen_random_uuid(), 'UTGC 120 km', 'complete', 'solo_and_relay', jsonb_build_object('schedule', jsonb_build_object('startTime', '03:00', 'startLocation', 'Belley', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ultra-trail-grand-colombier-120-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ultra-trail-grand-colombier-80-km-2027', 'Ultra 80 km', 'Contrevoz, Ain, France', 'Contrevoz, Ain, France', 80, 3300, 3430,
  'https://ultratrailgrandcolombier.com/ultra-80km/', 'https://ultratrailgrandcolombier.com/ultra-80km/', false, false, false, false,
  true, false, date '2027-09-25', false, (select id from public.race_events where lower(name) = lower('Ultra Trail Grand Colombier')),
  gen_random_uuid(), 'Ultra 80 km', 'complete', 'solo_and_relay', jsonb_build_object('schedule', jsonb_build_object('startTime', '06:00', 'startLocation', 'Contrevoz', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ultra-trail-grand-colombier-80-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ultra-trail-grand-colombier-45-km-2027', '45 km by Mac Sport', 'Plateau d''Hauteville, Ain, France', 'Plateau d''Hauteville, Ain, France', 45, 2000, 0,
  'https://ultratrailgrandcolombier.com/45km-mac-sport/', 'https://ultratrailgrandcolombier.com/45km-mac-sport/', false, false, false, false,
  true, false, date '2027-09-25', false, (select id from public.race_events where lower(name) = lower('Ultra Trail Grand Colombier')),
  gen_random_uuid(), '45 km by Mac Sport', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '07:30', 'startLocation', 'Plateau d''Hauteville', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ultra-trail-grand-colombier-45-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ultra-trail-grand-colombier-30-km-2027', 'Trail 30 km', 'Seyssel, Ain, France', 'Seyssel, Ain, France', 30, 1300, 0,
  'https://ultratrailgrandcolombier.com/trail-30km/', 'https://ultratrailgrandcolombier.com/trail-30km/', false, false, false, false,
  true, false, date '2027-09-25', false, (select id from public.race_events where lower(name) = lower('Ultra Trail Grand Colombier')),
  gen_random_uuid(), 'Trail 30 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startLocation', 'Seyssel', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ultra-trail-grand-colombier-30-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ultra-trail-grand-colombier-gravel-run-16-km-2027', 'Gravel Run 16 km', 'Seyssel, Ain, France', 'Seyssel, Ain, France', 16, null, 0,
  'https://ultratrailgrandcolombier.com/gravel-run-16km/', 'https://ultratrailgrandcolombier.com/gravel-run-16km/', false, false, false, false,
  true, false, date '2027-09-25', false, (select id from public.race_events where lower(name) = lower('Ultra Trail Grand Colombier')),
  gen_random_uuid(), 'Gravel Run 16 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startLocation', 'Seyssel', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ultra-trail-grand-colombier-gravel-run-16-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'ultra-trail-grand-colombier-10-km-2027', 'Trail 10 km', 'Culoz-Béon, Ain, France', 'Culoz-Béon, Ain, France', 10, 300, 280,
  'https://ultratrailgrandcolombier.com/trail-10km/', 'https://ultratrailgrandcolombier.com/trail-10km/', false, false, false, false,
  true, false, date '2027-09-25', false, (select id from public.race_events where lower(name) = lower('Ultra Trail Grand Colombier')),
  gen_random_uuid(), 'Trail 10 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startLocation', 'Culoz-Béon', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'ultra-trail-grand-colombier-10-km-2027');

-- Trail du Corbier
insert into public.race_events (
  name, location, description, website_url, race_date, is_live, organizer_details,
  location_city, location_department, location_department_code, location_region,
  location_region_code, location_country, location_country_code
)
select 'Trail du Corbier', 'Le Corbier, Villarembert, Savoie, France', 'Week-end de trail en été au Corbier (Les Sybelles, Maurienne) avec un kilomètre vertical, un trail nocturne et trois trails de 9 à 32 km.', 'https://trailducorbier.com/', date '2027-08-07', true,
  jsonb_build_object(
    'officialWebsiteUrl', 'https://trailducorbier.com/',
    'dateRange', jsonb_build_object('endDate', '2027-08-08'),
    'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026')
  ),
  'Villarembert', 'Savoie', '73', 'Auvergne-Rhône-Alpes', '84', 'France', 'FR'
where not exists (select 1 from public.race_events existing where lower(existing.name) = lower('Trail du Corbier'));

insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current, is_visible)
select event.id, 2027, date '2027-08-07', date '2027-08-08', true, true
from public.race_events event
where lower(event.name) = lower('Trail du Corbier')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date, end_date = excluded.end_date;

insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'trail-du-corbier-trail-des-sybelles-32-km-2027', 'Trail des Sybelles 32 km', 'Front de neige, Le Corbier, Savoie, France', 'Front de neige, Le Corbier, Savoie, France', 32, 2100, 0,
  'https://trailducorbier.com/parcours-trail-des-sybelles/', 'https://trailducorbier.com/parcours-trail-des-sybelles/', false, false, false, false,
  true, false, date '2027-08-08', false, (select id from public.race_events where lower(name) = lower('Trail du Corbier')),
  gen_random_uuid(), 'Trail des Sybelles 32 km', 'complete', 'solo_and_relay', jsonb_build_object('schedule', jsonb_build_object('startTime', '07:30', 'startLocation', 'Front de neige', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'trail-du-corbier-trail-des-sybelles-32-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'trail-du-corbier-trail-du-charvin-16-km-2027', 'Trail du Charvin 16 km', 'Front de neige, Le Corbier, Savoie, France', 'Front de neige, Le Corbier, Savoie, France', 16, 1100, 0,
  'https://trailducorbier.com/parcours-trail-du-charvin/', 'https://trailducorbier.com/parcours-trail-du-charvin/', false, false, false, false,
  true, false, date '2027-08-08', false, (select id from public.race_events where lower(name) = lower('Trail du Corbier')),
  gen_random_uuid(), 'Trail du Charvin 16 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '08:30', 'startLocation', 'Front de neige', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'trail-du-corbier-trail-du-charvin-16-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'trail-du-corbier-trail-de-l-ouillon-9-km-2027', 'Trail de l''Ouillon 9 km', 'Pointe du Corbier, Savoie, France', 'Pointe du Corbier, Savoie, France', 9, 250, 950,
  'https://trailducorbier.com/parcours-trail-de-l-ouillon/', 'https://trailducorbier.com/parcours-trail-de-l-ouillon/', false, false, false, false,
  true, false, date '2027-08-08', false, (select id from public.race_events where lower(name) = lower('Trail du Corbier')),
  gen_random_uuid(), 'Trail de l''Ouillon 9 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '10:00', 'startLocation', 'Pointe du Corbier', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'trail-du-corbier-trail-de-l-ouillon-9-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'trail-du-corbier-kv-de-la-pointe-2027', 'KV de la Pointe', 'Villarembert, Savoie, France', 'Villarembert, Savoie, France', 5.2, 1000, 0,
  'https://trailducorbier.com/parcours-kv-de-la-pointe/', 'https://trailducorbier.com/parcours-kv-de-la-pointe/', false, false, false, false,
  true, false, date '2027-08-07', false, (select id from public.race_events where lower(name) = lower('Trail du Corbier')),
  gen_random_uuid(), 'KV de la Pointe', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '10:00', 'startLocation', 'Villarembert', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'trail-du-corbier-kv-de-la-pointe-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details
)
select 'trail-du-corbier-trail-nocturne-7-km-2027', 'Trail Nocturne 7 km', 'Front de neige, Le Corbier, Savoie, France', 'Front de neige, Le Corbier, Savoie, France', 7.2, 320, 0,
  'https://trailducorbier.com/parcours-trail-nocturne/', 'https://trailducorbier.com/parcours-trail-nocturne/', false, false, false, false,
  true, false, date '2027-08-07', false, (select id from public.race_events where lower(name) = lower('Trail du Corbier')),
  gen_random_uuid(), 'Trail Nocturne 7 km', 'complete', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '21:00', 'startLocation', 'Front de neige', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026'))
where not exists (select 1 from public.races existing where existing.slug = 'trail-du-corbier-trail-nocturne-7-km-2027');

-- Trail de l'Étendard (2027 date provisional: formats stay masked drafts)
insert into public.race_events (
  name, location, description, website_url, race_date, is_live, organizer_details,
  location_city, location_department, location_department_code, location_region,
  location_region_code, location_country, location_country_code
)
select 'Trail de l''Étendard', 'Bourg-d''Oisans — Saint-Sorlin-d''Arves, France', 'Trail de montagne dans le massif des Grandes Rousses, entre Bourg-d''Oisans et Saint-Sorlin-d''Arves, avec des formats de 17 à 65 km.', 'https://www.traildeletendard.com/', date '2027-07-31', true,
  jsonb_build_object(
    'officialWebsiteUrl', 'https://www.traildeletendard.com/',
    'dateRange', jsonb_build_object('endDate', '2027-08-01'),
    'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'provisionalDate', true)
  ),
  'Saint-Sorlin-d''Arves', 'Savoie', '73', 'Auvergne-Rhône-Alpes', '84', 'France', 'FR'
where not exists (select 1 from public.race_events existing where lower(existing.name) = lower('Trail de l''Étendard'));

insert into public.race_event_editions (event_id, edition_year, start_date, end_date, is_current, is_visible)
select event.id, 2027, date '2027-07-31', date '2027-08-01', true, true
from public.race_events event
where lower(event.name) = lower('Trail de l''Étendard')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date, end_date = excluded.end_date;

insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-de-l-etendard-65-km-2027', 'Trail de l''Étendard 65 km', 'Bourg-d''Oisans, Isère, France', 'Bourg-d''Oisans, Isère, France', 65, 3700, 0,
  'https://www.traildeletendard.com/horaires', 'https://www.traildeletendard.com/horaires', false, false, false, false,
  false, false, date '2027-08-01', false, (select id from public.race_events where lower(name) = lower('Trail de l''Étendard')),
  gen_random_uuid(), 'Trail de l''Étendard 65 km', 'draft', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '06:00', 'startLocation', 'Bourg-d''Oisans', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026, 'provisionalDate', true)),
  'catalog/trail-de-l-etendard/2027/65km-643315aa.gpx', '643315aae9f8401bf177e4cd8513e36344316f2fa19dd9b57cf403192739f72f', 'catalog/trail-de-l-etendard/2027/65km-643315aa.gpx', '643315aae9f8401bf177e4cd8513e36344316f2fa19dd9b57cf403192739f72f', 714, 2727, 45.05646, 6.02955,
  45.05475, 6.01948, 45.23869, 6.23032
where not exists (select 1 from public.races existing where existing.slug = 'trail-de-l-etendard-65-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-de-l-etendard-44-km-2027', 'Trail de l''Étendard 44 km', 'Bourg-d''Oisans, Isère, France', 'Bourg-d''Oisans, Isère, France', 44, 3100, 0,
  'https://www.traildeletendard.com/horaires', 'https://www.traildeletendard.com/horaires', false, false, false, false,
  false, false, date '2027-08-01', false, (select id from public.race_events where lower(name) = lower('Trail de l''Étendard')),
  gen_random_uuid(), 'Trail de l''Étendard 44 km', 'draft', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '07:00', 'startLocation', 'Bourg-d''Oisans', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026, 'provisionalDate', true)),
  'catalog/trail-de-l-etendard/2027/44km-8a9d1e85.gpx', '8a9d1e8590ee2436265f97824460218aafb9dd07f5b43456efc3286740bcc5b5', 'catalog/trail-de-l-etendard/2027/44km-8a9d1e85.gpx', '8a9d1e8590ee2436265f97824460218aafb9dd07f5b43456efc3286740bcc5b5', 714, 2727, 45.08183, 6.02273,
  45.08183, 6.01948, 45.21806, 6.23024
where not exists (select 1 from public.races existing where existing.slug = 'trail-de-l-etendard-44-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-de-l-etendard-22-km-2027', 'Trail de l''Étendard 22 km', 'Saint-Sorlin-d''Arves, Savoie, France', 'Saint-Sorlin-d''Arves, Savoie, France', 22, 1600, 0,
  'https://www.traildeletendard.com/horaires', 'https://www.traildeletendard.com/horaires', false, false, false, false,
  false, false, date '2027-08-01', false, (select id from public.race_events where lower(name) = lower('Trail de l''Étendard')),
  gen_random_uuid(), 'Trail de l''Étendard 22 km', 'draft', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '09:00', 'startLocation', 'Saint-Sorlin-d''Arves', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026, 'provisionalDate', true)),
  'catalog/trail-de-l-etendard/2027/22km-62b5ddeb.gpx', '62b5ddebce618cb35565f7260c6da1c7d87b4250e8e69d05209d2089e74a3f8c', 'catalog/trail-de-l-etendard/2027/22km-62b5ddeb.gpx', '62b5ddebce618cb35565f7260c6da1c7d87b4250e8e69d05209d2089e74a3f8c', 1490, 2533, 45.21804, 6.23026,
  45.19385, 6.17288, 45.24045, 6.23764
where not exists (select 1 from public.races existing where existing.slug = 'trail-de-l-etendard-22-km-2027');
insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m, elevation_loss_m,
  source_url, external_site_url, is_published, is_live, is_public, web_catalog_is_live,
  racebook_preview_is_visible, racebook_is_live, race_date, has_aid_stations, event_id,
  edition_group_id, series_name, data_status, participation_mode, organizer_details,
  gpx_path, gpx_hash, gpx_storage_path, gpx_sha256, min_alt_m, max_alt_m, start_lat, start_lng,
  bounds_min_lat, bounds_min_lng, bounds_max_lat, bounds_max_lng
)
select 'trail-de-l-etendard-17-km-2027', 'Trail de l''Étendard 17 km', 'Bourg-d''Oisans, Isère, France', 'Bourg-d''Oisans, Isère, France', 17, 500, 0,
  'https://www.traildeletendard.com/horaires', 'https://www.traildeletendard.com/horaires', false, false, false, false,
  false, false, date '2027-07-31', false, (select id from public.race_events where lower(name) = lower('Trail de l''Étendard')),
  gen_random_uuid(), 'Trail de l''Étendard 17 km', 'draft', 'solo', jsonb_build_object('schedule', jsonb_build_object('startTime', '09:00', 'startLocation', 'Bourg-d''Oisans', 'timeZone', 'Europe/Paris'), 'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-11-23', 'origin', 'salon-saintelyon-2026', 'gpxEditionYear', 2026, 'provisionalDate', true)),
  'catalog/trail-de-l-etendard/2027/17km-acd70cf0.gpx', 'acd70cf00094e6307a882c4d041c19172e8e5f29bd6ee0aeaa9ff9cf36caf08b', 'catalog/trail-de-l-etendard/2027/17km-acd70cf0.gpx', 'acd70cf00094e6307a882c4d041c19172e8e5f29bd6ee0aeaa9ff9cf36caf08b', 717, 1042, 45.05674, 6.02895,
  45.02284, 6.01422, 45.07203, 6.05894
where not exists (select 1 from public.races existing where existing.slug = 'trail-de-l-etendard-17-km-2027');

do $$
declare
  created integer;
begin
  select count(*) into created from public.races
  where slug in ('ut4m-100-master-vt-2027', 'ut4m-jeunes-2027', 'ut4m-randonnee-2027', 'lozere-trail-ultra-110-km-2027', 'lozere-trail-skyrace-gorges-du-tarn-25-km-2027', 'lozere-trail-2-rivieres-52-km-2027', 'lozere-trail-25-km-2027', 'lozere-trail-salta-bartas-12-km-2027', 'marathon-de-la-biere-trail-28-km-2027', 'marathon-de-la-biere-trail-18-km-2027', 'marathon-de-la-biere-trail-11-km-2027', 'saint-so-course-maratrail-des-cretes-42-km-2027', 'saint-so-course-la-roche-percee-23-km-2027', 'saint-so-course-la-pouponne-11-km-2027', 'trail-margeride-sobre-los-pas-de-la-bestia-43-km-2027', 'trail-margeride-lou-pas-del-ase-26-km-2027', 'trail-margeride-lo-clapas-17-km-2027', 'trail-margeride-veillade-dels-barons-10-km-2027', 'trail-margeride-randonnee-15-km-2027', 'ultra-trail-grand-colombier-120-km-2027', 'ultra-trail-grand-colombier-80-km-2027', 'ultra-trail-grand-colombier-45-km-2027', 'ultra-trail-grand-colombier-30-km-2027', 'ultra-trail-grand-colombier-gravel-run-16-km-2027', 'ultra-trail-grand-colombier-10-km-2027', 'trail-du-corbier-trail-des-sybelles-32-km-2027', 'trail-du-corbier-trail-du-charvin-16-km-2027', 'trail-du-corbier-trail-de-l-ouillon-9-km-2027', 'trail-du-corbier-kv-de-la-pointe-2027', 'trail-du-corbier-trail-nocturne-7-km-2027', 'trail-de-l-etendard-65-km-2027', 'trail-de-l-etendard-44-km-2027', 'trail-de-l-etendard-22-km-2027', 'trail-de-l-etendard-17-km-2027')
    and edition_id is not null and is_live = false and racebook_is_live = false and web_catalog_is_live = false;
  if created <> 34 then
    raise exception 'Expected 34 private salon formats, found %', created;
  end if;
end;
$$;

commit;

