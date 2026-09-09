begin;

-- Curated official-source snapshot for public catalog/SEO pages.
-- A trace and elevation are enrichment: NULL means that the organiser has not
-- published a value we can safely use. Never substitute a fabricated zero.
create temporary table _seo_events (
  name text primary key,
  location text not null,
  website_url text not null,
  start_date date not null,
  end_date date not null
) on commit drop;

insert into _seo_events (name, location, website_url, start_date, end_date) values
  ('Toussi''trail', 'Toussieux', 'https://toussitrail.fr/', date '2026-11-08', date '2026-11-08'),
  ('Trail du Loup Blanc', 'Guéret — forêt de Chabrières', 'https://trailduloupblanc.fr/', date '2026-12-12', date '2026-12-12'),
  ('Topo Athletic Bibracte Ultra Trail', 'Musée de Bibracte — Saint-Léger-sous-Beuvray', 'https://www.bibracteultratrail.fr/', date '2026-11-13', date '2026-11-13'),
  ('Trail du Soleil Levens', 'Levens', 'https://raidedhec.fr/trail-du-soleil-levens/', date '2026-11-29', date '2026-11-29'),
  ('Trail Les Mathes - La Palmyre', 'Les Mathes — La Palmyre', 'https://www.trail-lesmathes-lapalmyre.com/', date '2027-01-10', date '2027-01-10'),
  ('HOKA Les Templiers', 'Millau, Aveyron', 'https://www.festivaldestempliers.com/', date '2026-10-18', date '2026-10-18'),
  ('Trail de l''Épine', 'La Motte-Servolex, Savoie', 'https://traildelepine.fr/', date '2026-11-01', date '2026-11-01'),
  ('Ultra Trail des Fontaines', 'Le Montat, Lot', 'https://www.utdf.fr/', date '2027-02-06', date '2027-02-07'),
  ('La Foulée des Ducs', 'La Clayette, Saône-et-Loire', 'https://fouleedesducs.fr/', date '2027-02-27', date '2027-02-28'),
  ('La Sauta Roc', 'Saint-Guilhem-le-Désert, Hérault', 'https://www.lasautaroc.fr/', date '2027-02-21', date '2027-02-21'),
  ('ASICS SaintéLyon', 'Saint-Étienne — Lyon', 'https://www.saintelyon.com/', date '2026-11-28', date '2026-11-29');

insert into public.race_events (
  name, location, website_url, race_date, is_live, organizer_details
)
select
  source.name,
  source.location,
  source.website_url,
  source.start_date,
  true,
  jsonb_build_object(
    'officialWebsiteUrl', source.website_url,
    'dateRange', jsonb_build_object('endDate', source.end_date::text),
    'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-09-09')
  )
from _seo_events source
where not exists (
  select 1 from public.race_events existing
  where lower(existing.name) = lower(source.name)
);

update public.race_events event
set location = source.location,
    website_url = source.website_url,
    race_date = source.start_date,
    is_live = true,
    organizer_details = coalesce(event.organizer_details, '{}'::jsonb)
      || jsonb_build_object(
        'officialWebsiteUrl', source.website_url,
        'dateRange', jsonb_build_object('endDate', source.end_date::text),
        'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-09-09')
      )
from _seo_events source
where lower(event.name) = lower(source.name);

insert into public.race_event_editions (
  event_id, edition_year, start_date, end_date, is_current, is_visible
)
select event.id, extract(year from source.start_date)::smallint,
       source.start_date, source.end_date, true, true
from _seo_events source
join public.race_events event on lower(event.name) = lower(source.name)
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_current = true,
    is_visible = true;

create temporary table _seo_races (
  event_name text not null,
  slug text primary key,
  name text not null,
  race_date date not null,
  location text not null,
  distance_km numeric not null,
  elevation_gain_m numeric,
  source_url text not null,
  participation_mode text not null default 'solo'
) on commit drop;

insert into _seo_races (
  event_name, slug, name, race_date, location, distance_km,
  elevation_gain_m, source_url, participation_mode
) values
  ('Toussi''trail', 'toussi-trail-5-km-2026', 'Toussi''trail — 5 km', date '2026-11-08', 'Toussieux', 5, 30, 'https://toussitrail.fr/wp-content/uploads/2026/08/ReglementToussitrail-2026.pdf', 'solo'),
  ('Toussi''trail', 'toussi-trail-12-km-2026', 'Toussi''trail — 12 km', date '2026-11-08', 'Toussieux', 12, 150, 'https://toussitrail.fr/wp-content/uploads/2026/08/ReglementPoussitrail-2026.pdf', 'solo'),
  ('Trail du Loup Blanc', 'trail-du-loup-blanc-120-km-2026', 'Trail du Loup Blanc — 120 km', date '2026-12-12', 'Guéret — forêt de Chabrières', 120, 3500, 'https://trailduloupblanc.fr/', 'solo'),
  ('Topo Athletic Bibracte Ultra Trail', 'bibracte-ultra-trail-185-km-2026', 'L''Ultra des Druides', date '2026-11-13', 'Musée de Bibracte — Saint-Léger-sous-Beuvray', 185, 5500, 'https://www.bibracteultratrail.fr/courses/lultra-des-druides', 'solo'),
  ('Trail du Soleil Levens', 'trail-du-soleil-levens-60-km-2026', 'Trail du Soleil Levens — 60 km', date '2026-11-29', 'Levens', 60, 3580, 'https://raidedhec.fr/trail-du-soleil-levens/', 'solo'),
  ('Trail Les Mathes - La Palmyre', 'trail-les-mathes-la-palmyre-25-km-2027', 'Trail Les Mathes - La Palmyre — 25 km', date '2027-01-10', 'Les Mathes — La Palmyre', 25, 250, 'https://www.trail-lesmathes-lapalmyre.com/25km', 'solo'),
  ('Trail Les Mathes - La Palmyre', 'trail-les-mathes-la-palmyre-11-km-2027', 'Trail Les Mathes - La Palmyre — 11 km', date '2027-01-10', 'Les Mathes — La Palmyre', 11, 100, 'https://www.trail-lesmathes-lapalmyre.com/11km', 'solo'),
  ('HOKA Les Templiers', 'grand-trail-des-templiers-2026', 'Grand Trail des Templiers', date '2026-10-18', 'Millau, Aveyron', 80.7, 3443, 'https://www.festivaldestempliers.com/courses/grand-trail-des-templiers', 'solo'),
  ('Trail de l''Épine', 'trail-de-l-epine-epinette-2026', 'L''Épinette', date '2026-11-01', 'La Motte-Servolex, Savoie', 10, 250, 'https://traildelepine.fr/', 'solo'),
  ('Trail de l''Épine', 'trail-de-l-epine-sorpi-2026', 'La Sorpi', date '2026-11-01', 'La Motte-Servolex, Savoie', 16, 450, 'https://traildelepine.fr/', 'solo'),
  ('Trail de l''Épine', 'trail-de-l-epine-crete-2026', 'La Crête', date '2026-11-01', 'La Motte-Servolex, Savoie', 24, 1100, 'https://traildelepine.fr/', 'solo'),
  ('Ultra Trail des Fontaines', 'ultra-trail-des-fontaines-105-km-2027', 'Ultra Trail des Fontaines — 105 km', date '2027-02-06', 'Le Montat, Lot', 105, 4000, 'https://www.utdf.fr/courses/ultra-trail-des-fontaines', 'solo'),
  ('Ultra Trail des Fontaines', 'grand-trail-du-chevalier-69-km-2027', 'Grand Trail du Chevalier', date '2027-02-06', 'Mont Saint-Cyr, Cahors — Le Montat', 69, 2800, 'https://www.utdf.fr/courses/gtc', 'solo'),
  ('La Foulée des Ducs', 'foulee-des-ducs-45-km-2027', 'La Foulée des Ducs — 45 km', date '2027-02-27', 'Château de La Clayette', 45, 1300, 'https://fouleedesducs.fr/les-epreuves/', 'solo'),
  ('La Sauta Roc', 'la-sauta-roc-26-km-2027', 'La Sauta Roc — 26 km', date '2027-02-21', 'Saint-Guilhem-le-Désert, Hérault', 26, 1200, 'https://www.lasautaroc.fr/?p=2009', 'solo'),
  ('La Sauta Roc', 'la-sauta-roc-15-km-2027', 'La Sauta Roc — 15 km', date '2027-02-21', 'Saint-Guilhem-le-Désert, Hérault', 15, 650, 'https://www.lasautaroc.fr/?p=2009', 'solo'),
  ('ASICS SaintéLyon', 'asics-saintelyon-80-km-2026', 'SaintéLyon — 80 km', date '2026-11-28', 'Saint-Étienne — Lyon', 80, null, 'https://www.saintelyon.com/races/80km-saintelyon', 'solo'),
  ('ASICS SaintéLyon', 'asics-saintexpress-45-km-2026', 'SaintExpress — 45 km', date '2026-11-28', 'Sainte-Catherine — Lyon', 45, null, 'https://www.saintelyon.com/races/45km-saint-express', 'solo'),
  ('ASICS SaintéLyon', 'asics-saintevia-35-km-2026', 'SaintéVia — 35 km', date '2026-11-28', 'Mornant — Lyon', 35, 630, 'https://www.saintelyon.com/en/races/saintevia', 'solo'),
  ('ASICS SaintéLyon', 'asics-saintesprint-24-km-2026', 'SaintéSprint — 24 km', date '2026-11-28', 'Soucieu-en-Jarrest — Lyon', 24, null, 'https://www.saintelyon.com/races/14km-saintesprint', 'solo');

insert into public.races (
  slug, name, location, location_text, distance_km, elevation_gain_m,
  source_url, external_site_url, is_published, is_live, race_date,
  is_public, has_aid_stations, event_id, edition_group_id, series_name,
  edition_id, racebook_is_live, data_status, missing_required_fields,
  participation_mode
)
select
  source.slug,
  source.name,
  source.location,
  source.location,
  source.distance_km,
  source.elevation_gain_m,
  source.source_url,
  source.source_url,
  true,
  true,
  source.race_date,
  true,
  false,
  event.id,
  gen_random_uuid(),
  source.name,
  edition.id,
  false,
  'complete',
  array[]::text[],
  source.participation_mode
from _seo_races source
join public.race_events event on lower(event.name) = lower(source.event_name)
join public.race_event_editions edition
  on edition.event_id = event.id
 and edition.edition_year = extract(year from source.race_date)::smallint
where not exists (
  select 1 from public.races existing where existing.slug = source.slug
);

-- Enrich the existing Grand Raid rows. Their GPX-derived distance and elevation
-- are more precise than the rounded official labels, so only missing identity,
-- date, location and source metadata are updated.
update public.race_events
set location = 'La Réunion',
    website_url = 'https://www.grandraid-reunion.com/',
    race_date = date '2026-10-15',
    is_live = true,
    organizer_details = coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object(
        'officialWebsiteUrl', 'https://www.grandraid-reunion.com/',
        'dateRange', jsonb_build_object('endDate', '2026-10-18'),
        'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-09-09')
      )
where lower(name) = lower('GRAND RAID RÉUNION 2026');

insert into public.race_event_editions (
  event_id, edition_year, start_date, end_date, is_current, is_visible
)
select id, 2026, date '2026-10-15', date '2026-10-18', true, true
from public.race_events
where lower(name) = lower('GRAND RAID RÉUNION 2026')
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_current = true,
    is_visible = true;

create temporary table _grand_raid_formats (
  slug text primary key,
  race_date date not null,
  location text not null,
  source_url text not null,
  participation_mode text not null
) on commit drop;

insert into _grand_raid_formats values
  ('diagonale-des-fous-te0e', date '2026-10-15', 'Saint-Pierre — Saint-Denis, La Réunion', 'https://www.grandraid-reunion.com/fr/les-courses/la-diagonale-des-fous/', 'solo'),
  ('trail-de-bourbon-2026-jdhw', date '2026-10-16', 'Cilaos — Saint-Denis, La Réunion', 'https://www.grandraid-reunion.com/fr/les-courses/le-trail-de-bourbon/', 'solo'),
  ('mascareignes-c9gk', date '2026-10-16', 'Hell-Bourg — Saint-Denis, La Réunion', 'https://www.grandraid-reunion.com/fr/les-courses/la-mascareignes/', 'solo'),
  ('m-tis-trail-reunion-pubt', date '2026-10-17', 'La Réunion', 'https://www.grandraid-reunion.com/fr/accueil/actualites/1924', 'solo'),
  ('relais-zembrocal-trail-2026-7o6l', date '2026-10-15', 'La Réunion', 'https://www.grandraid-reunion.com/fr/accueil/actualites/1924', 'relay');

update public.races race
set race_date = source.race_date,
    location = source.location,
    location_text = source.location,
    source_url = source.source_url,
    external_site_url = source.source_url,
    edition_id = edition.id,
    is_published = true,
    is_live = true,
    is_public = true,
    data_status = 'complete',
    missing_required_fields = array[]::text[],
    participation_mode = source.participation_mode
from _grand_raid_formats source
join public.race_events event
  on lower(event.name) = lower('GRAND RAID RÉUNION 2026')
join public.race_event_editions edition
  on edition.event_id = event.id and edition.edition_year = 2026
where race.slug = source.slug
  and race.event_id = event.id;

do $$
declare
  inserted_count integer;
  grand_raid_count integer;
begin
  select count(*) into inserted_count
  from public.races
  where slug in (select slug from _seo_races)
    and is_live and is_public and data_status = 'complete';

  if inserted_count <> 20 then
    raise exception 'Expected 20 curated SEO formats, found %', inserted_count;
  end if;

  select count(*) into grand_raid_count
  from public.races race
  join public.race_events event on event.id = race.event_id
  where lower(event.name) = lower('GRAND RAID RÉUNION 2026')
    and race.slug in (select slug from _grand_raid_formats)
    and race.race_date is not null
    and race.is_live and race.is_public;

  if grand_raid_count <> 5 then
    raise exception 'Expected 5 enriched Grand Raid formats, found %', grand_raid_count;
  end if;
end;
$$;

commit;
