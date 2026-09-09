-- Catalog SEO completeness is intentionally smaller than RaceBook richness:
-- elevation and a route are useful enrichment, not publication prerequisites.

alter table public.races
  alter column elevation_gain_m drop not null,
  alter column elevation_gain_m drop default,
  alter column gpx_path drop not null,
  alter column gpx_hash drop not null;

update public.races
set elevation_gain_m = null,
    missing_required_fields = array_remove(missing_required_fields, 'elevation_gain_m')
where 'elevation_gain_m' = any(missing_required_fields);

update public.races
set gpx_path = null,
    gpx_hash = null
where gpx_storage_path is null
  and coalesce(gpx_hash, '') like 'pending:%';

alter table public.races
  drop constraint if exists races_missing_required_fields_check,
  drop constraint if exists races_complete_has_no_missing_required_fields,
  drop constraint if exists races_missing_distance_uses_sentinel,
  drop constraint if exists races_missing_elevation_gain_uses_sentinel,
  drop constraint if exists races_missing_date_is_null;

alter table public.races
  add constraint races_missing_required_fields_check
    check (
      array_position(missing_required_fields, null) is null
      and missing_required_fields <@ array['race_date', 'location', 'distance_km', 'source_url']::text[]
    ),
  add constraint races_complete_has_no_missing_required_fields
    check (data_status <> 'complete' or cardinality(missing_required_fields) = 0),
  add constraint races_missing_distance_uses_sentinel
    check (not ('distance_km' = any(missing_required_fields)) or distance_km = 0),
  add constraint races_missing_date_is_null
    check (not ('race_date' = any(missing_required_fields)) or race_date is null);

-- A declarative complete-row CHECK can be added only after the legacy catalog
-- has been backfilled. Until then, this column-scoped trigger enforces the new
-- minimum on inserts and on writes that change completeness/publication fields,
-- while unrelated legacy edits (for example notes) remain possible.

create or replace function public.enforce_race_catalog_completeness()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  computed_missing text[] := array[]::text[];
begin
  if 'elevation_gain_m' = any(coalesce(new.missing_required_fields, array[]::text[])) then
    new.elevation_gain_m := null;
  end if;
  if new.gpx_storage_path is null and coalesce(new.gpx_hash, '') like 'pending:%' then
    new.gpx_path := null;
    new.gpx_hash := null;
  end if;
  if new.race_date is null then computed_missing := array_append(computed_missing, 'race_date'); end if;
  if new.distance_km is null or new.distance_km <= 0 then computed_missing := array_append(computed_missing, 'distance_km'); end if;
  if coalesce(nullif(btrim(new.location_text), ''), nullif(btrim(new.location), '')) is null then
    computed_missing := array_append(computed_missing, 'location');
  end if;
  if coalesce(nullif(btrim(new.source_url), ''), nullif(btrim(new.external_site_url), '')) is null then
    computed_missing := array_append(computed_missing, 'source_url');
  end if;

  new.missing_required_fields := computed_missing;
  if cardinality(computed_missing) > 0 then
    new.data_status := 'draft';
    new.is_live := false;
    new.racebook_is_live := false;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_race_catalog_completeness on public.races;
create trigger enforce_race_catalog_completeness
before insert or update of name, slug, race_date, location, location_text, distance_km,
  source_url, external_site_url, data_status, missing_required_fields, is_live, racebook_is_live
on public.races
for each row execute function public.enforce_race_catalog_completeness();

comment on column public.races.data_status is
  'Catalog completeness marker. Complete formats require name, slug, date, location, positive distance, and a source; elevation and GPX remain optional.';
comment on column public.races.missing_required_fields is
  'Unknown fields from the source-backed catalog minimum: race_date, location, distance_km, or source_url. Elevation and GPX are optional.';
comment on column public.races.elevation_gain_m is
  'Optional published elevation gain in metres. NULL means unknown and must never be replaced by a fabricated zero.';
