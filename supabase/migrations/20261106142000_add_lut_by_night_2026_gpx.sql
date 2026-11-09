begin;

-- Official GPX files downloaded on 2026-11-06 from the 10 km, 20 km and
-- 30 km format pages at https://lutbynight.com/races/. The 10 km Rando page
-- exposes no downloadable GPX URL and deliberately remains unchanged.
create temporary table _lut_by_night_gpx (
  slug text primary key,
  gpx_storage_path text not null,
  gpx_sha256 text not null,
  elevation_loss_m numeric not null,
  min_alt_m numeric not null,
  max_alt_m numeric not null,
  start_lat numeric not null,
  start_lng numeric not null,
  bounds_min_lat numeric not null,
  bounds_min_lng numeric not null,
  bounds_max_lat numeric not null,
  bounds_max_lng numeric not null
) on commit drop;

insert into _lut_by_night_gpx values
  (
    'lut-by-night-10km-2026',
    'catalog/lut-by-night/2026/10km-aa05eee5.gpx',
    'aa05eee5421de4e2e4386fbcc1a0f4f7063fc343ff5754090595941b09228e85',
    449, 171, 293, 45.75908, 4.82405, 45.75247, 4.80881, 45.77223, 4.82676
  ),
  (
    'lut-by-night-20km-2026',
    'catalog/lut-by-night/2026/20km-279e6849.gpx',
    '279e684928a618358224c74ae88c1808bf1fb16b4da3a2ee835ac7a4624187ba',
    740, 167, 309, 45.75908, 4.82406, 45.73722, 4.80077, 45.77224, 4.83181
  ),
  (
    'lut-by-night-30km-2026',
    'catalog/lut-by-night/2026/30km-22cff8e8.gpx',
    '22cff8e8dad9f2b11addc9a9d0943daf2c605ad78d5add63b53dd62166b1e039',
    1054, 167, 309, 45.75908, 4.82406, 45.71891, 4.78019, 45.77224, 4.83181
  );

do $$
declare
  updated_count integer;
begin
  update public.races race
  set gpx_path = source.gpx_storage_path,
      gpx_hash = source.gpx_sha256,
      gpx_storage_path = source.gpx_storage_path,
      gpx_sha256 = source.gpx_sha256,
      elevation_loss_m = source.elevation_loss_m,
      min_alt_m = source.min_alt_m,
      max_alt_m = source.max_alt_m,
      start_lat = source.start_lat,
      start_lng = source.start_lng,
      bounds_min_lat = source.bounds_min_lat,
      bounds_min_lng = source.bounds_min_lng,
      bounds_max_lat = source.bounds_max_lat,
      bounds_max_lng = source.bounds_max_lng
  from _lut_by_night_gpx source
  join public.race_events event
    on lower(event.name) = lower('Radiance Mutuelle LUT By Night')
  where race.slug = source.slug
    and race.event_id = event.id
    and race.race_date = date '2026-11-07';

  get diagnostics updated_count = row_count;
  if updated_count <> 3 then
    raise exception 'Expected to enrich 3 LUT By Night 2026 formats, updated %', updated_count;
  end if;
end;
$$;

commit;
