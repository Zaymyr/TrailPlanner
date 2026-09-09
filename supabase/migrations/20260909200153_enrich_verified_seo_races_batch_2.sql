begin;

-- Second curated official-source batch for public catalog/SEO pages.
-- Distance and elevation are copied only when the organiser publishes them.
create temporary table _seo_events_batch_2 (
  name text primary key,
  location text not null,
  website_url text not null,
  start_date date not null,
  end_date date not null
) on commit drop;

insert into _seo_events_batch_2 (name, location, website_url, start_date, end_date) values
  ('Trail Glazig', 'Plourhan, Côtes-d''Armor', 'https://www.trail-glazig.com/', date '2027-02-06', date '2027-02-07'),
  ('Ménestrail', 'Moncontour, Côtes-d''Armor', 'https://menestrail.bzh/', date '2026-12-05', date '2026-12-05'),
  ('Mafate Trail Tour', 'Grand Îlet — Mafate, La Réunion', 'https://www.randorunoi.com/', date '2026-11-28', date '2026-11-28'),
  ('Masters — Randorun OI', 'Les Makes, La Réunion', 'https://www.randorunoi.com/', date '2026-12-13', date '2026-12-13'),
  ('La Foulée des Ducs', 'La Clayette, Saône-et-Loire', 'https://fouleedesducs.fr/', date '2027-02-27', date '2027-02-28');

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
from _seo_events_batch_2 source
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
from _seo_events_batch_2 source
where lower(event.name) = lower(source.name);

insert into public.race_event_editions (
  event_id, edition_year, start_date, end_date, is_current, is_visible
)
select event.id, extract(year from source.start_date)::smallint,
       source.start_date, source.end_date, true, true
from _seo_events_batch_2 source
join public.race_events event on lower(event.name) = lower(source.name)
on conflict (event_id, edition_year) do update
set start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_current = true,
    is_visible = true;

create temporary table _seo_races_batch_2 (
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

insert into _seo_races_batch_2 (
  event_name, slug, name, race_date, location, distance_km,
  elevation_gain_m, source_url, participation_mode
) values
  ('Trail Glazig', 'trail-glazig-5-km-2027', 'Trail Glazig — 5 km', date '2027-02-06', 'Plourhan, Côtes-d''Armor', 5, 47, 'https://www.trail-glazig.com/trail-5k', 'solo'),
  ('Trail Glazig', 'noz-trail-10-km-2027', 'Noz Trail — 10 km', date '2027-02-06', 'Plourhan, Côtes-d''Armor', 10, 172, 'https://www.trail-glazig.com/noz-trail-10k', 'solo'),
  ('Trail Glazig', 'noz-trail-20-km-2027', 'Noz Trail — 20 km', date '2027-02-06', 'Plourhan, Côtes-d''Armor', 20, 397, 'https://www.trail-glazig.com/noz-trail-20k', 'solo'),
  ('Trail Glazig', 'trail-merrell-32-km-2027', 'Trail Merrell — 32 km', date '2027-02-07', 'Plourhan, Côtes-d''Armor', 32, 501, 'https://www.trail-glazig.com/trail-merrell-32k', 'solo'),
  ('Trail Glazig', 'super-trail-volvo-62-km-2027', 'Super Trail Volvo — 62 km', date '2027-02-07', 'Plourhan, Côtes-d''Armor', 62, 1138, 'https://www.trail-glazig.com/super-trailvolvo-62k', 'solo'),
  ('Ménestrail', 'grand-menestrail-56-km-2026', 'Grand Menestrail — 56 km', date '2026-12-05', 'Moncontour, Côtes-d''Armor', 56, 2100, 'https://menestrail.bzh/le_grand_menestrail/', 'solo'),
  ('Mafate Trail Tour', 'mafate-trail-38-km-2026', 'Mafate Trail — 38 km', date '2026-11-28', 'Grand Îlet — Mafate, La Réunion', 38, 2100, 'https://www.randorunoi.com/', 'solo'),
  ('Mafate Trail Tour', 'mafate-trail-tour-55-km-2026', 'Mafate Trail Tour — 55 km', date '2026-11-28', 'Grand Îlet — Mafate, La Réunion', 55, 3600, 'https://www.randorunoi.com/', 'solo'),
  ('Mafate Trail Tour', 'ultra-mafate-trail-tour-70-km-2026', 'Ultra Mafate Trail Tour — 70 km', date '2026-11-28', 'Grand Îlet — Mafate, La Réunion', 70, 4800, 'https://www.randorunoi.com/', 'solo'),
  ('Masters — Randorun OI', 'masters-randorun-22-km-2026', 'Masters — 22 km', date '2026-12-13', 'Les Makes, La Réunion', 22, 1500, 'https://www.randorunoi.com/', 'solo'),
  ('La Foulée des Ducs', 'foulee-des-ducs-13-km-2027', 'La Foulée des Ducs — 13 km', date '2027-02-27', 'Château de Montrouant', 13, 200, 'https://fouleedesducs.fr/les-epreuves/', 'solo'),
  ('La Foulée des Ducs', 'foulee-des-ducs-28-km-2027', 'La Foulée des Ducs — 28 km', date '2027-02-27', 'Le Sordet', 28, 700, 'https://fouleedesducs.fr/les-epreuves/', 'solo');

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
from _seo_races_batch_2 source
join public.race_events event on lower(event.name) = lower(source.event_name)
join public.race_event_editions edition
  on edition.event_id = event.id
 and edition.edition_year = extract(year from source.race_date)::smallint
where not exists (
  select 1 from public.races existing where existing.slug = source.slug
);

-- Correct the already seeded 45 km format: the organiser publishes it as a relay.
update public.races race
set participation_mode = 'relay',
    location = 'Château de La Clayette',
    location_text = 'Château de La Clayette',
    source_url = 'https://fouleedesducs.fr/les-epreuves/',
    external_site_url = 'https://fouleedesducs.fr/les-epreuves/',
    updated_at = now()
from public.race_events event
where race.event_id = event.id
  and lower(event.name) = lower('La Foulée des Ducs')
  and race.slug = 'foulee-des-ducs-45-km-2027';

-- Enrich existing formats without replacing their more precise GPX metrics.
update public.race_events
set location = 'Nice Côte d''Azur',
    website_url = 'https://nice.utmb.world/fr/races',
    organizer_details = coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object(
        'officialWebsiteUrl', 'https://nice.utmb.world/fr/races',
        'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-09-09')
      )
where lower(name) = lower('Nice Côte d''Azur by UTMB®');

create temporary table _nice_formats_batch_2 (
  slug text primary key,
  location text not null,
  source_url text not null
) on commit drop;

insert into _nice_formats_batch_2 values
  ('ultra-trail-m-tropole-nice-c-te-d-azur-100m-a788', 'Auron — Nice', 'https://nice.utmb.world/races/nice-100m'),
  ('roubion-nice-100k-ge52', 'Roubion — Nice', 'https://nice.utmb.world/races/nice-100k');

update public.races race
set location = source.location,
    location_text = source.location,
    source_url = source.source_url,
    external_site_url = source.source_url,
    updated_at = now()
from _nice_formats_batch_2 source
join public.race_events event
  on lower(event.name) = lower('Nice Côte d''Azur by UTMB®')
where race.event_id = event.id
  and race.slug = source.slug;

update public.race_events
set location = 'Port-sur-Saône',
    website_url = 'https://trail-terresdesaone.fr/',
    organizer_details = coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object(
        'officialWebsiteUrl', 'https://trail-terresdesaone.fr/',
        'catalogSource', jsonb_build_object('kind', 'official', 'verifiedAt', '2026-09-09')
      )
where lower(name) = lower('Trail des Terres de Saône');

update public.races race
set source_url = 'https://trail-terresdesaone.fr/',
    external_site_url = 'https://trail-terresdesaone.fr/',
    updated_at = now()
from public.race_events event
where race.event_id = event.id
  and lower(event.name) = lower('Trail des Terres de Saône')
  and race.slug in (
    'organizer-import-44cd683589c1496d98abbc9767c6be60',
    'organizer-import-958e7ecb2cae4ef8872c5e871d0dccd3',
    'organizer-import-fdbb5c5f71d14e4e942a639e4247bfb8',
    'organizer-import-2a5281fd1ac14ff0bf5da685d4683e54'
  );

do $$
declare
  inserted_count integer;
  enriched_count integer;
begin
  select count(*) into inserted_count
  from public.races
  where slug in (select slug from _seo_races_batch_2)
    and is_live and is_public and data_status = 'complete';

  if inserted_count <> 12 then
    raise exception 'Expected 12 curated SEO formats, found %', inserted_count;
  end if;

  select count(*) into enriched_count
  from public.races
  where (
      slug in (select slug from _nice_formats_batch_2)
      or slug in (
        'organizer-import-44cd683589c1496d98abbc9767c6be60',
        'organizer-import-958e7ecb2cae4ef8872c5e871d0dccd3',
        'organizer-import-fdbb5c5f71d14e4e942a639e4247bfb8',
        'organizer-import-2a5281fd1ac14ff0bf5da685d4683e54',
        'foulee-des-ducs-45-km-2027'
      )
    )
    and source_url is not null;

  if enriched_count <> 7 then
    raise exception 'Expected 7 enriched existing formats, found %', enriched_count;
  end if;
end;
$$;

commit;
