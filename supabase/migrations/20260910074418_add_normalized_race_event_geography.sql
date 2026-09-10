-- Normalized event geography is the source of truth for exact country,
-- region, department and city filters. `location` remains the runner-facing
-- label, while latitude/longitude represent the event's anchor city rather
-- than a claim that the whole route is contained inside that municipality.
alter table public.race_events
  add column if not exists location_city text,
  add column if not exists location_city_code text,
  add column if not exists location_department text,
  add column if not exists location_department_code text,
  add column if not exists location_region text,
  add column if not exists location_region_code text,
  add column if not exists location_country text,
  add column if not exists location_country_code text,
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision;

alter table public.race_events
  drop constraint if exists race_events_location_country_code_check,
  add constraint race_events_location_country_code_check
    check (
      location_country_code is null
      or location_country_code ~ '^[A-Z]{2}$'
    ),
  drop constraint if exists race_events_location_latitude_check,
  add constraint race_events_location_latitude_check
    check (
      location_latitude is null
      or location_latitude between -90 and 90
    ),
  drop constraint if exists race_events_location_longitude_check,
  add constraint race_events_location_longitude_check
    check (
      location_longitude is null
      or location_longitude between -180 and 180
    ),
  drop constraint if exists race_events_location_coordinates_pair_check,
  add constraint race_events_location_coordinates_pair_check
    check (
      (location_latitude is null) = (location_longitude is null)
    );

create index if not exists race_events_location_region_code_idx
  on public.race_events (location_region_code)
  where location_region_code is not null;

create index if not exists race_events_location_department_code_idx
  on public.race_events (location_department_code)
  where location_department_code is not null;

create index if not exists race_events_location_city_code_idx
  on public.race_events (location_city_code)
  where location_city_code is not null;

create index if not exists race_events_location_coordinates_idx
  on public.race_events (location_latitude, location_longitude)
  where location_latitude is not null and location_longitude is not null;

comment on column public.race_events.location_city is
  'Normalized anchor-city name used for geographic catalog filters.';
comment on column public.race_events.location_city_code is
  'Stable locality identifier; French events use the INSEE commune code.';
comment on column public.race_events.location_department is
  'Normalized second-level administrative area; department for French events.';
comment on column public.race_events.location_department_code is
  'Stable second-level administrative-area code; department code for French events.';
comment on column public.race_events.location_region is
  'Normalized first-level administrative area; region for French events.';
comment on column public.race_events.location_region_code is
  'Stable first-level administrative-area code; region code for French events.';
comment on column public.race_events.location_country is
  'Normalized country display name.';
comment on column public.race_events.location_country_code is
  'ISO 3166-1 alpha-2 country code.';
comment on column public.race_events.location_latitude is
  'Latitude of the event anchor city, used for approximate nearby-city discovery.';
comment on column public.race_events.location_longitude is
  'Longitude of the event anchor city, used for approximate nearby-city discovery.';

create or replace function public.clear_stale_race_event_geography()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.location is distinct from old.location
    and row(
      new.location_city,
      new.location_city_code,
      new.location_department,
      new.location_department_code,
      new.location_region,
      new.location_region_code,
      new.location_country,
      new.location_country_code,
      new.location_latitude,
      new.location_longitude
    ) is not distinct from row(
      old.location_city,
      old.location_city_code,
      old.location_department,
      old.location_department_code,
      old.location_region,
      old.location_region_code,
      old.location_country,
      old.location_country_code,
      old.location_latitude,
      old.location_longitude
    )
  then
    new.location_city := null;
    new.location_city_code := null;
    new.location_department := null;
    new.location_department_code := null;
    new.location_region := null;
    new.location_region_code := null;
    new.location_country := null;
    new.location_country_code := null;
    new.location_latitude := null;
    new.location_longitude := null;
  end if;

  return new;
end;
$$;

comment on function public.clear_stale_race_event_geography() is
  'Clears curated geography when a location label changes without a matching normalized update.';

revoke execute on function public.clear_stale_race_event_geography()
  from public, anon, authenticated;

drop trigger if exists clear_stale_race_event_geography
  on public.race_events;
create trigger clear_stale_race_event_geography
before update of location on public.race_events
for each row
execute function public.clear_stale_race_event_geography();

-- Administrative names, codes and commune-centre coordinates were verified
-- against geo.api.gouv.fr on 2026-09-10. Event/format anchors were checked
-- against the official organizer pages already stored as catalog sources.
with geography (
  event_name,
  display_location,
  city,
  city_code,
  department,
  department_code,
  region,
  region_code,
  country,
  country_code,
  latitude,
  longitude
) as (
  values
    (
      'MaXi-Race Annecy',
      'Annecy, Haute-Savoie, Auvergne-Rhône-Alpes, France',
      'Annecy', '74010', 'Haute-Savoie', '74',
      'Auvergne-Rhône-Alpes', '84', 'France', 'FR',
      45.9024::double precision, 6.1264::double precision
    ),
    (
      'Schneider Electric Marathon De Paris',
      'Paris, Île-de-France, France',
      'Paris', '75056', 'Paris', '75',
      'Île-de-France', '11', 'France', 'FR',
      48.8589::double precision, 2.3470::double precision
    ),
    (
      'GRAND RAID RÉUNION 2026',
      'La Réunion, France',
      'Saint-Denis', '97411', 'La Réunion', '974',
      'La Réunion', '04', 'France', 'FR',
      -20.9434::double precision, 55.4444::double precision
    ),
    (
      'HOKA UTMB Mont-Blanc',
      'Chamonix-Mont-Blanc, Haute-Savoie, Auvergne-Rhône-Alpes, France',
      'Chamonix-Mont-Blanc', '74056', 'Haute-Savoie', '74',
      'Auvergne-Rhône-Alpes', '84', 'France', 'FR',
      45.9296::double precision, 6.9291::double precision
    ),
    (
      'Les Foulées Fleurinoises',
      'Fleurieux-sur-l''Arbresle, Rhône, Auvergne-Rhône-Alpes, France',
      'Fleurieux-sur-l''Arbresle', '69086', 'Rhône', '69',
      'Auvergne-Rhône-Alpes', '84', 'France', 'FR',
      45.8406::double precision, 4.6484::double precision
    ),
    (
      'Nice Côte d''Azur by UTMB®',
      'Nice, Alpes-Maritimes, Provence-Alpes-Côte d''Azur, France',
      'Nice', '06088', 'Alpes-Maritimes', '06',
      'Provence-Alpes-Côte d''Azur', '93', 'France', 'FR',
      43.7032::double precision, 7.2528::double precision
    ),
    (
      'Trail Alsace by UTMB',
      'Obernai, Bas-Rhin, Grand Est, France',
      'Obernai', '67348', 'Bas-Rhin', '67',
      'Grand Est', '44', 'France', 'FR',
      48.4546::double precision, 7.4817::double precision
    ),
    (
      'Trail des rois maudits',
      'Les Andelys, Eure, Normandie, France',
      'Les Andelys', '27016', 'Eure', '27',
      'Normandie', '28', 'France', 'FR',
      49.2391::double precision, 1.4241::double precision
    )
)
update public.race_events as event
set location = source.display_location,
    location_city = source.city,
    location_city_code = source.city_code,
    location_department = source.department,
    location_department_code = source.department_code,
    location_region = source.region,
    location_region_code = source.region_code,
    location_country = source.country,
    location_country_code = source.country_code,
    location_latitude = source.latitude,
    location_longitude = source.longitude,
    organizer_details = case
      when nullif(event.organizer_details -> 'eventLocation' ->> 'lat', '') is not null
       and nullif(event.organizer_details -> 'eventLocation' ->> 'lng', '') is not null
        then coalesce(event.organizer_details, '{}'::jsonb)
      else jsonb_set(
        coalesce(event.organizer_details, '{}'::jsonb),
        '{eventLocation}',
        jsonb_build_object(
          'label', source.display_location,
          'lat', source.latitude,
          'lng', source.longitude,
          'googleMapsUrl', format(
            'https://www.google.com/maps/search/?api=1&query=%s%%2C%s',
            source.latitude,
            source.longitude
          ),
          'source', 'manual'
        ),
        true
      )
    end
from geography as source
where lower(event.name) = lower(source.event_name);

with format_locations (slug, display_location) as (
  values
    ('maxi-race-annecy-2026-100k', 'Annecy, Haute-Savoie, Auvergne-Rhône-Alpes, France'),
    ('maxi-race-annecy-2026-marathon', 'Annecy, Haute-Savoie, Auvergne-Rhône-Alpes, France'),
    ('marathon-de-paris-fbg2', 'Paris, Île-de-France, France'),
    ('trail-de-bourbon-2026-jdhw', 'Cilaos — Saint-Denis, La Réunion, France'),
    ('mascareignes-c9gk', 'Hell-Bourg (Salazie) — Saint-Denis, La Réunion, France'),
    ('m-tis-trail-reunion-pubt', 'Saint-Paul — Saint-Denis, La Réunion, France'),
    ('roubion-nice-100k-ge52', 'Roubion — Nice, Alpes-Maritimes, Provence-Alpes-Côte d''Azur, France'),
    ('utmb-k0i5', 'Chamonix-Mont-Blanc, Haute-Savoie, Auvergne-Rhône-Alpes, France'),
    ('la-fleurinoise-8c17500c', 'Fleurieux-sur-l''Arbresle, Rhône, Auvergne-Rhône-Alpes, France'),
    ('ultra-trail-des-chevaliers-87wp', 'Station du Lac Blanc (Orbey) — Obernai, Grand Est, France'),
    ('60-km-077693a6', 'La Roquette — Les Andelys, Eure, Normandie, France')
)
update public.races as race
set location = source.display_location,
    location_text = source.display_location
from format_locations as source
where race.slug = source.slug;

do $$
declare
  enriched_events integer;
  enriched_formats integer;
begin
  select count(*)
  into enriched_events
  from public.race_events
  where location_country_code = 'FR'
    and location_region_code is not null
    and location_department_code is not null
    and location_city_code is not null
    and location_latitude is not null
    and lower(name) in (
      lower('MaXi-Race Annecy'),
      lower('Schneider Electric Marathon De Paris'),
      lower('GRAND RAID RÉUNION 2026'),
      lower('HOKA UTMB Mont-Blanc'),
      lower('Les Foulées Fleurinoises'),
      lower('Nice Côte d''Azur by UTMB®'),
      lower('Trail Alsace by UTMB'),
      lower('Trail des rois maudits')
    );

  if enriched_events <> 8 then
    raise exception 'Expected 8 normalized race events, found %', enriched_events;
  end if;

  select count(*)
  into enriched_formats
  from public.races
  where slug in (
    'maxi-race-annecy-2026-100k',
    'maxi-race-annecy-2026-marathon',
    'marathon-de-paris-fbg2',
    'trail-de-bourbon-2026-jdhw',
    'mascareignes-c9gk',
    'm-tis-trail-reunion-pubt',
    'roubion-nice-100k-ge52',
    'utmb-k0i5',
    'la-fleurinoise-8c17500c',
    'ultra-trail-des-chevaliers-87wp',
    '60-km-077693a6'
  )
    and location_text is not null;

  if enriched_formats <> 11 then
    raise exception 'Expected 11 normalized format labels, found %', enriched_formats;
  end if;
end;
$$;
